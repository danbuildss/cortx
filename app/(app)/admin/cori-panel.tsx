// Cori sections for the admin UI: the slim line on /admin and the blocks of
// the /admin/cori page. Server-rendered from Cori's tables (read with the
// service role); no client state.
import Link from 'next/link';
import {
  CLASS_LABELS,
  CLASS_ORDER,
  HEARTBEAT_DISPLAY,
  describeEvent,
  heartbeatState,
  isDryRunKind,
} from '@/lib/cori/status';
import type { Classification } from '@/lib/cori/classify';
import type { CoriNav } from './cori-data';

export type CoriRun = { kind: string; started_at: string; ok: boolean | null; stats: Record<string, unknown> | null; error: string | null };
export type CoriEvent = {
  at: string;
  event: string;
  details: Record<string, unknown> | null;
  discovered_services: { service_name: string | null; canonical_url: string } | null;
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

export const coriCard: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 };
const section: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' };
export const coriLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

// ─── /admin: one slim line ──────────────────────────────────────────────────

export function CoriAdminLine({ nav }: { nav: CoriNav | null }) {
  const state = nav?.state ?? 'not_started';
  const d = HEARTBEAT_DISPLAY[state];
  return (
    <Link href="/admin/cori" style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', textDecoration: 'none',
      background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8,
      padding: '10px 16px', marginBottom: 16, fontSize: 12,
    }}>
      <span style={coriLabel}>Cori</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: d.color, fontWeight: 600 }}>
        <Dot color={d.color} />{d.label}
      </span>
      {nav && nav.waiting > 0 && (
        <span style={{ color: 'var(--text-secondary)' }}>· <strong style={{ color: 'var(--status-degraded)' }}>{nav.waiting}</strong> waiting for review</span>
      )}
      <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontWeight: 500 }}>Open Cori →</span>
    </Link>
  );
}

// ─── /admin/cori blocks ─────────────────────────────────────────────────────

export function CoriStatusCard({ runs, totalDiscovered, now }: { runs: CoriRun[]; totalDiscovered: number; now: number }) {
  const last = runs[0] ?? null;
  const state = heartbeatState(last ? new Date(last.started_at) : null, new Date(now));
  const d = HEARTBEAT_DISPLAY[state];
  const dry = isDryRunKind(last?.kind);
  const discovery = runs.find((r) => r.kind.includes('discover:')) ?? null;
  const dStats = (discovery?.stats ?? {}) as { items?: number; new_services?: number };

  return (
    <div style={coriCard}>
      <div style={{ ...section, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <Dot color={d.color} size={9} />
        <span style={{ color: d.color, fontWeight: 600 }}>{d.label}</span>
        {last && <span style={{ color: 'var(--text-muted)' }}>· last report {ago(last.started_at, now)}</span>}
        {last && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
            background: dry ? 'rgba(217,119,6,0.12)' : 'rgba(34,197,94,0.10)', color: dry ? '#d97706' : 'var(--status-ok)',
          }}>{dry ? 'Dry run' : 'Live'}</span>
        )}
      </div>
      {state === 'not_started' ? (
        <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
          Cori hasn&apos;t run yet. It starts once the Cori server is set up (Phase D).
        </div>
      ) : (
        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
      )}
    </div>
  );
}

export function CoriKnows({ classCounts, totalDiscovered }: { classCounts: Partial<Record<Classification, number>>; totalDiscovered: number }) {
  return (
    <div style={coriCard}>
      <div style={{ ...section, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={coriLabel}>What Cori knows</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{totalDiscovered.toLocaleString()} services</span>
      </div>
      <div style={{ padding: '8px 16px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2px 24px' }}>
        {CLASS_ORDER.filter((c) => (classCounts[c] ?? 0) > 0 || ATTENTION.has(c)).map((c) => {
          const n = classCounts[c] ?? 0;
          const attention = ATTENTION.has(c);
          return (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: attention ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: attention ? 500 : 400 }}>{CLASS_LABELS[c]}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: attention && n > 0 ? 'var(--status-ok)' : 'var(--text-secondary)' }}>
                {n.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CoriErrors({ runs, now }: { runs: CoriRun[]; now: number }) {
  const errors = runs.filter((r) => r.ok === false).slice(0, 5);
  if (errors.length === 0) return null;
  return (
    <div style={coriCard}>
      <div style={section}><span style={coriLabel}>Recent errors</span></div>
      <div style={{ padding: '8px 16px 12px' }}>
        {errors.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--status-critical)', padding: '3px 0', overflowWrap: 'anywhere' }}>
            {r.kind} · {ago(r.started_at, now)} · <span style={{ color: 'var(--text-muted)' }}>{r.error ?? 'failed'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoriActivity({ events }: { events: CoriEvent[] }) {
  return (
    <div style={coriCard}>
      <div style={section}><span style={coriLabel}>Recent activity</span></div>
      {events.length === 0 ? (
        <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)' }}>Nothing yet.</div>
      ) : events.map((e, i) => (
        <div key={i} style={{ padding: '8px 16px', borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)', fontSize: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', minWidth: 0 }}>
            <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 11 }}>{time(e.at)}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.discovered_services?.service_name ?? e.discovered_services?.canonical_url ?? 'Unknown service'}
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 2, overflowWrap: 'anywhere' }}>{describeEvent(e.event, e.details)}</div>
        </div>
      ))}
    </div>
  );
}
