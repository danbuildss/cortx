// Politeness (spec §9, §17): per host, at most one request at a time, every
// `minIntervalMs`, at most `maxPerHour` per rolling hour and `maxPerDay` per
// rolling day (B3: company-first — one big host can't take all the checks);
// across all hosts, at most `globalMaxPerHour` per rolling hour.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export class HostLimiter {
  private last = new Map<string, number>();
  private recent = new Map<string, number[]>();
  private busy = new Set<string>();
  private global: number[] = [];

  private readonly minIntervalMs: number;
  private readonly maxPerHour: number;
  private readonly maxPerDay: number;
  private readonly globalMaxPerHour: number;
  private readonly now: () => number;

  constructor(minIntervalMs: number, maxPerHour: number, opts: { globalMaxPerHour?: number; maxPerDay?: number; now?: () => number } = {}) {
    this.minIntervalMs = minIntervalMs;
    this.maxPerHour = maxPerHour;
    this.maxPerDay = opts.maxPerDay ?? Infinity;
    this.globalMaxPerHour = opts.globalMaxPerHour ?? Infinity;
    this.now = opts.now ?? Date.now;
  }

  private recentFor(host: string): number[] {
    const dayAgo = this.now() - DAY;
    const recent = (this.recent.get(host) ?? []).filter((x) => x > dayAgo);
    this.recent.set(host, recent);
    return recent;
  }

  /** Hosts that used up their hourly or daily allowance — skip them when picking work */
  cappedHosts(): string[] {
    const hourAgo = this.now() - HOUR;
    return [...this.recent.keys()].filter((h) => {
      const r = this.recentFor(h);
      return r.length >= this.maxPerDay || r.filter((x) => x > hourAgo).length >= this.maxPerHour;
    });
  }

  /** Probes still allowed in the current rolling hour, across all hosts */
  globalRemaining(): number {
    const hourAgo = this.now() - HOUR;
    this.global = this.global.filter((x) => x > hourAgo);
    return Math.max(0, this.globalMaxPerHour - this.global.length);
  }

  /**
   * Try to reserve a request slot for `host`.
   * Returns 0 if reserved now, a positive number of ms to wait before trying
   * again, or -1 if an hourly cap is used up (reschedule, don't wait).
   */
  reserve(host: string, opts: { counted?: boolean } = {}): number {
    const counted = opts.counted ?? true;
    const t = this.now();
    const hourAgo = t - HOUR;
    const recent = this.recentFor(host);
    const lastHour = recent.filter((x) => x > hourAgo).length;
    if (counted && (lastHour >= this.maxPerHour || recent.length >= this.maxPerDay || this.globalRemaining() === 0)) return -1;
    if (this.busy.has(host)) return Math.max(this.minIntervalMs, 50);
    const wait = (this.last.get(host) ?? 0) + this.minIntervalMs - t;
    if (wait > 0) return wait;
    this.busy.add(host);
    this.last.set(host, t);
    // Website checks (Q1) are polite (one at a time, spaced) but don't use up probe allowances
    if (counted) {
      recent.push(t);
      this.global.push(t);
    }
    return 0;
  }

  release(host: string): void {
    this.busy.delete(host);
    this.last.set(host, this.now());
  }
}
