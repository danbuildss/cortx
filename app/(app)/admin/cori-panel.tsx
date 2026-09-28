// Cori panel on the admin page: is the agent alive, what has it found, what
// did it do recently. Server-rendered from Cori's tables (read with the
// service role); no client state.
import {
  CLASS_LABELS,
  CLASS_ORDER,
  describeEvent,
  heartbeatState,
  isDryRunKind,
  type HeartbeatState,
} from '@/lib/cori/status';
import type { Classification } from '@/lib/cori/classify';

export type CoriRun = { kind: string; started_at: string; ok: boolean | null; stats: Record<string, unknown> | null; error: string | null };
export type CoriEvent = {
  at: string;
  event: string;
  details: Record<string, unknown> | null;
  discovered_services: { service_name: string | null; canonical_url: string } | null;
};

const STATE: Record<HeartbeatState, { label: string; color: string }> = {
  healthy: { label: 'Running', color: 'var(--status-ok)' },
  late: { label: 'Late', color: 'var(--status-degraded)' },
  silent: { label: 'Silent', color: 'var(--status-critical)' },
  not_started: { label: 'Not started yet', color: 'var(--text-dim)' },
};

const ATTENTION = new Set<Classification>(['eligible', 'needs_input']);

function ago(ts: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function time(ts: string): string {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function CoriPanel({
  runs,
  classCounts,
  totalDiscovered,
  events,
  now,
}: {
  runs: CoriRun[];
  classCounts: Partial<Record<Classification, number>>;
  totalDiscovered: number;
  events: CoriEvent[];
  now: number;
}) {
  const last = runs[0] ?? null;
  const state = heartbeatState(last ? new Date(last.started_at) : null, new Date(now));
  const dry = isDryRunKind(last?.kind);
  const discovery = runs.find((r) => r.kind.includes('discover:')) ?? null;
  const dStats = (discovery?.stats ?? {}) as { items?: number; new_services?: number; total?: number | null };
  const recentErrors = runs.filter((r) => r.ok === false).slice(0, 3);

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 };
  const section: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' };
  const label: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 8 };

  return (
    <div style={card}>
      <div style={{ ...section, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cori</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>autonomous discovery · no payments</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE[state].color, display: 'inline-block' }} />
          <span style={{ color: STATE[state].color, fontWeight: 600 }}>{STATE[state].label}</span>
          {last && <span style={{ color: 'var(--text-muted)' }}>· last report {ago(last.started_at, now)}</span>}
          {last && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
              background: dry ? 'rgba(217,119,6,0.12)' : 'rgba(34,197,94,0.10)', color: dry ? '#d97706' : 'var(--status-ok)',
            }}>{dry ? 'Dry run' : 'Live'}</span>
          )}
        </div>
      </div>

      {state === 'not_started' ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Cori hasn&apos;t run yet. It starts once the Cori server is set up (Phase D).
        </div>
      ) : (
        <>
          <div style={{ ...section, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Last Bazaar scan </span>
            {discovery ? (
              <>
                {ago(discovery.started_at, now)} ·{' '}
                {discovery.ok === false
                  ? <span style={{ color: 'var(--status-critical)' }}>failed: {discovery.error ?? 'unknown error'}</span>
                  : <>{(dStats.items ?? 0).toLocaleString()} listings · {(dStats.new_services ?? 0).toLocaleString()} new</>}
              </>
            ) : 'none yet'}
            <span style={{ color: 'var(--text-dim)' }}> · {totalDiscovered.toLocaleString()} services known</span>
          </div>

          <div style={section}>
            <div style={label}>What Cori knows</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 24px' }}>
              {CLASS_ORDER.filter((c) => (classCounts[c] ?? 0) > 0 || ATTENTION.has(c)).map((c) => (
                <div key={c} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
                  <span style={{ color: ATTENTION.has(c) ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: ATTENTION.has(c) ? 500 : 400 }}>{CLASS_LABELS[c]}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: ATTENTION.has(c) && (classCounts[c] ?? 0) > 0 ? 'var(--status-ok)' : 'var(--text-secondary)', fontWeight: 600 }}>
                    {(classCounts[c] ?? 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {recentErrors.length > 0 && (
            <div style={section}>
              <div style={label}>Recent errors</div>
              {recentErrors.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--status-critical)', padding: '2px 0' }}>
                  {r.kind} · {ago(r.started_at, now)} · <span style={{ color: 'var(--text-muted)' }}>{r.error ?? 'failed'}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '12px 16px' }}>
            <div style={label}>Recent activity</div>
            {events.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing yet.</div>
            ) : events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '3px 0', alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 11 }}>{time(e.at)}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                  {e.discovered_services?.service_name ?? e.discovered_services?.canonical_url ?? 'Unknown service'}
                </span>
                <span style={{ color: 'var(--text-secondary)', minWidth: 0 }}>{describeEvent(e.event, e.details)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
