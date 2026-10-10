// Q2 sections of the Cori page: companies you approved (Watching, re-checked
// by Cori every day) and known x402 projects Cori hasn't found an endpoint for.
import type { Partner } from '@/lib/cori/partners';
import { coriCard, coriLabel } from './cori-panel';
import { ago, PartnerBadge } from './cori-candidate';
import type { CoriWatched } from './cori-data';
import { partnerFor } from '@/lib/cori/partners';

function newServiceHref(url: string | null, name: string | null): string {
  const q = new URLSearchParams();
  if (url) q.set('url', url);
  if (name) q.set('name', name);
  return `/services/new?${q.toString()}`;
}

export function CoriWatching({ watching, now }: { watching: CoriWatched[]; now: number }) {
  return (
    <div style={coriCard}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={coriLabel}>Watching</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{watching.length} companies · checked free every day · private</span>
      </div>
      {watching.length === 0 ? (
        <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          Companies you approve appear here. Cori checks them every day; start paid monitoring to build public evidence.
        </div>
      ) : watching.map((w, i) => {
        const partner = partnerFor(w.domain);
        const m = (w.candidate_metadata ?? {}) as { services_total?: number; price_min?: number | null; price_max?: number | null };
        const state = w.alive === false
          ? { text: `Went quiet ${ago(w.quiet_since, now) ?? ''}`.trim(), color: 'var(--status-critical)' }
          : w.alive === true
            ? { text: `Answering · checked ${ago(w.last_alive_at, now)}`, color: 'var(--status-ok)' }
            : { text: 'First daily check pending', color: 'var(--text-dim)' };
        return (
          <div key={w.domain} style={{ padding: '12px 16px', borderBottom: i === watching.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{partner?.name ?? w.name ?? w.domain}</span>
              {partner && <PartnerBadge />}
              <span style={{ fontSize: 11, color: state.color }}>● {state.text}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              <a href={`https://${w.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>{w.domain} ↗</a>
              {m.services_total != null && <> · {m.services_total} paid service{m.services_total === 1 ? '' : 's'}</>}
              {m.price_min != null && m.price_max != null && <> · ${m.price_min}{m.price_max !== m.price_min ? `–$${m.price_max}` : ''} per call</>}
            </div>
            <a href={newServiceHref(w.endpoint_url, partner?.name ?? w.name)} style={{
              display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', textDecoration: 'none',
            }}>Start paid monitoring →</a>
          </div>
        );
      })}
    </div>
  );
}

export function CoriKnownProjects({ partners }: { partners: Partner[] }) {
  if (partners.length === 0) return null;
  return (
    <details style={coriCard}>
      <summary style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={coriLabel}>Known x402 projects, no endpoint found yet</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{partners.length}</span>
      </summary>
      <div style={{ padding: '0 16px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 8px' }}>
          On the x402.org ecosystem list, but not (yet) in the Coinbase Bazaar, so Cori can&apos;t check them by itself.
          Add one by hand if you know its paid endpoint.
        </p>
        {partners.map((p) => (
          <div key={p.slug} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '3px 0' }}>
            <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}>{p.name} ↗</a>
            <span style={{ color: 'var(--text-dim)', overflowWrap: 'anywhere' }}>{p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}</span>
            <a href={newServiceHref(null, p.name)} style={{ color: 'var(--text-secondary)' }}>Add by hand</a>
          </div>
        ))}
      </div>
    </details>
  );
}
