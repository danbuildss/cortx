/**
 * Cori status for the CORTX app (admin panel + watchdog). Pure functions —
 * the app reads Cori's tables with the service role and uses these to decide
 * what to show and when to alert.
 */
import type { Classification } from './classify';

const MIN = 60_000;
export const HEARTBEAT_HEALTHY_MS = 10 * MIN;
export const HEARTBEAT_SILENT_MS = 30 * MIN;
export const WATCHDOG_ALERT_COOLDOWN_MS = 6 * 60 * MIN;

export type HeartbeatState = 'not_started' | 'healthy' | 'late' | 'silent';

// Green < 10 min, amber < 30 min, red after that (spec §9)
export function heartbeatState(lastRunAt: Date | null, now: Date): HeartbeatState {
  if (!lastRunAt) return 'not_started';
  const age = now.getTime() - lastRunAt.getTime();
  if (age < HEARTBEAT_HEALTHY_MS) return 'healthy';
  if (age < HEARTBEAT_SILENT_MS) return 'late';
  return 'silent';
}

// Dry runs log their runs as `dry:<kind>`
export function isDryRunKind(kind: string | null | undefined): boolean {
  return !!kind && kind.startsWith('dry:');
}

// ─── Classes, for the panel ─────────────────────────────────────────────────

export const CLASS_LABELS: Record<Classification, string> = {
  eligible: 'Eligible',
  needs_input: 'Needs input',
  pending: 'Waiting for probe',
  already_monitored: 'Already monitored',
  already_listed: 'Already in registry',
  already_submitted: 'Already submitted',
  too_expensive: 'Too expensive',
  unsupported_network: 'Wrong network',
  unsupported_asset: 'Not USDC',
  unsupported_scheme: 'Unsupported payment method',
  not_x402: 'Not x402',
  invalid_terms: 'Invalid payment terms',
  unreachable: 'Unreachable',
  blocked: 'Blocked (unsafe or opted out)',
  gone: 'Gone',
};

// Panel order: what needs attention first
export const CLASS_ORDER: Classification[] = [
  'eligible', 'needs_input', 'pending',
  'already_monitored', 'already_listed', 'already_submitted',
  'too_expensive', 'unsupported_network', 'unsupported_asset', 'unsupported_scheme',
  'not_x402', 'invalid_terms', 'unreachable', 'blocked', 'gone',
];

// ─── "Why eligible", in plain English ───────────────────────────────────────

export function explainReasons(reasons: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const r of reasons ?? []) {
    const [key, ...rest] = r.split(':');
    const value = rest.join(':');
    switch (key) {
      case 'network': out.push(value === 'base' ? 'Base ✓' : `Network ${value} ✗`); break;
      case 'asset': out.push(value === 'usdc' ? 'USDC ✓' : `Asset ${value} ✗`); break;
      case 'scheme': out.push(value === 'exact' ? 'Standard payment ✓' : `Payment method ${value} ✗`); break;
      case 'price': {
        if (value.includes('>')) { const [p, cap] = value.split('>'); out.push(`$${p} per call, over the $${cap} cap ✗`); }
        else if (value === 'invalid') out.push('No valid price ✗');
        else out.push(`$${value} per call ✓`);
        break;
      }
      case 'probe':
        if (value === 'ok') out.push('Free check passed ✓');
        else if (value === 'pending') out.push('Free check pending');
        else if (value.startsWith('retrying')) out.push(`Free check failed, retrying ${value.replace('retrying', '')}`);
        else out.push(`Free check: ${value.replace(/_/g, ' ')} ✗`);
        break;
      case 'input':
        if (value === 'get') out.push('Callable with GET ✓');
        else if (value === 'bazaar_example') out.push('Example input from Bazaar ✓');
        else out.push('POST with no example input — a paid check would need one');
        break;
      case 'facilitator': out.push(value === 'published' ? 'Publishes its facilitator' : 'Facilitator not published'); break;
      case 'linked': out.push({ service: 'Already monitored by CORTX', registry: 'Already in the registry', submission: 'Already submitted' }[value] ?? `Linked: ${value}`); break;
      case 'blocked': out.push(`Blocked: ${value.replace(/_/g, ' ')}`); break;
      case 'gone': out.push('Gone from sources and unreachable for 7+ days'); break;
      case 'terms': out.push('Payment terms invalid ✗'); break;
      default: break; // unknown reasons are omitted rather than shown raw
    }
  }
  return out;
}

// ─── Discovery events, for the activity list ───────────────────────────────

export function describeEvent(event: string, details: Record<string, unknown> | null | undefined): string {
  const d = details ?? {};
  const usd = (v: unknown) => (typeof v === 'number' ? `$${v}` : '?');
  switch (event) {
    case 'first_seen': return `first seen via ${d.source === 'cdp_bazaar' ? 'Coinbase Bazaar' : String(d.source ?? 'a source')}`;
    case 'listing_changed': return d.new_source ? `also listed by ${String(d.new_source)}` : 'listing changed';
    case 'price_changed': return `price changed ${usd(d.from)} → ${usd(d.to)}`;
    case 'terms_changed': return 'payment terms changed';
    case 'probe_status_changed':
      if (d.to === 'ok') return d.from ? 'free check passed again' : 'free check passed';
      return `free check: ${String(d.to).replace(/_/g, ' ')}`;
    case 'classification_changed': return `now: ${(CLASS_LABELS[d.to as Classification] ?? String(d.to)).toLowerCase()}`;
    case 'queued': return 'added to review queue';
    case 'approved': return 'approved into the registry';
    case 'rejected': return d.reason ? `rejected: ${String(d.reason)}` : 'rejected';
    case 'reappeared': return 'reappeared';
    case 'disappeared': return 'disappeared from sources';
    default: return event.replace(/_/g, ' ');
  }
}

// ─── Watchdog (runs in the CORTX cron) ──────────────────────────────────────

export type WatchdogState = { down: boolean; last_alert_at: string | null };
export type WatchdogDecision = { send: 'down' | 'recovered' | null; next: WatchdogState };

/**
 * Alert once when Cori goes silent (> 30 min), repeat at most every 6 h while
 * it stays silent, and send one "back" message when it recovers. Nothing
 * before Cori's first run.
 */
export function watchdogDecision(lastRunAt: Date | null, state: WatchdogState | null, now: Date): WatchdogDecision {
  const current: WatchdogState = state ?? { down: false, last_alert_at: null };
  const hb = heartbeatState(lastRunAt, now);
  if (hb === 'not_started') return { send: null, next: current };

  if (hb === 'silent') {
    const last = current.last_alert_at ? Date.parse(current.last_alert_at) : 0;
    if (!current.down || now.getTime() - last >= WATCHDOG_ALERT_COOLDOWN_MS) {
      return { send: 'down', next: { down: true, last_alert_at: now.toISOString() } };
    }
    return { send: null, next: current };
  }

  if (current.down) return { send: 'recovered', next: { down: false, last_alert_at: current.last_alert_at } };
  return { send: null, next: current };
}

export function parseWatchdogState(raw: string | null | undefined): WatchdogState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<WatchdogState>;
    return { down: v.down === true, last_alert_at: typeof v.last_alert_at === 'string' ? v.last_alert_at : null };
  } catch {
    return null;
  }
}

export function minutesSince(d: Date, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
}
