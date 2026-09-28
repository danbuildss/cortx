// Per-host politeness (spec §6): at most one request per host every
// `minIntervalMs`, and at most `maxPerHour` per host per rolling hour.
export class HostLimiter {
  private last = new Map<string, number>();
  private recent = new Map<string, number[]>();
  private busy = new Set<string>();

  private readonly minIntervalMs: number;
  private readonly maxPerHour: number;
  private readonly now: () => number;

  constructor(minIntervalMs: number, maxPerHour: number, now: () => number = Date.now) {
    this.minIntervalMs = minIntervalMs;
    this.maxPerHour = maxPerHour;
    this.now = now;
  }

  /**
   * Try to reserve a request slot for `host`.
   * Returns 0 if reserved now, a positive number of ms to wait before trying
   * again, or -1 if the hourly cap is used up (reschedule, don't wait).
   */
  reserve(host: string): number {
    const t = this.now();
    const hourAgo = t - 3_600_000;
    const recent = (this.recent.get(host) ?? []).filter((x) => x > hourAgo);
    this.recent.set(host, recent);
    if (recent.length >= this.maxPerHour) return -1;
    if (this.busy.has(host)) return Math.max(this.minIntervalMs, 50);
    const wait = (this.last.get(host) ?? 0) + this.minIntervalMs - t;
    if (wait > 0) return wait;
    this.busy.add(host);
    this.last.set(host, t);
    recent.push(t);
    return 0;
  }

  release(host: string): void {
    this.busy.delete(host);
    this.last.set(host, this.now());
  }
}
