// Cori's facts for one candidate in the pending-submissions list: price,
// network, why it's eligible, where and when it was first seen. Reads the
// candidate_metadata Cori wrote when it queued the service.
import { explainReasons } from '@/lib/cori/status';

type Meta = {
  classification?: string;
  reasons?: string[];
  network?: string | null;
  price_usdc?: number | null;
  x402_version?: number | null;
  http_method?: string;
  first_seen_at?: string;
  sources?: string[];
  evidence_state?: string;
};

const SOURCE_NAMES: Record<string, string> = { cdp_bazaar: 'Coinbase Bazaar' };

function networkName(n: string | null | undefined): string {
  if (n === 'base' || n === 'eip155:8453') return 'Base';
  return n ?? '—';
}

export function CoriBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.05em',
      background: 'rgba(15,118,110,0.14)', color: '#2dd4bf', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      Cori
    </span>
  );
}

export function CoriCandidateDetails({ metadata }: { metadata: unknown }) {
  const m = (metadata && typeof metadata === 'object' ? metadata : {}) as Meta;
  const needsInput = m.classification === 'needs_input';
  const facts = [
    m.price_usdc != null ? `$${m.price_usdc} per call` : null,
    networkName(m.network),
    m.x402_version ? `x402 v${m.x402_version}` : null,
    m.http_method ?? null,
  ].filter(Boolean).join(' · ');
  // The needs-input warning is shown on its own line above, so don't repeat it
  const why = explainReasons(m.reasons).filter((r) => !r.startsWith('Facilitator') && !r.startsWith('POST with no example'));
  const firstSeen = m.first_seen_at ? new Date(m.first_seen_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const sources = (m.sources ?? []).map((s) => SOURCE_NAMES[s] ?? s).join(', ');

  return (
    <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.6, maxWidth: 420 }}>
      <div style={{ color: 'var(--text-secondary)' }}>{facts}</div>
      {needsInput && (
        <div style={{ color: 'var(--status-degraded)' }}>
          Needs input: POST service with no example input. A paid check would need one.
        </div>
      )}
      {why.length > 0 && (
        <div style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-dim)' }}>{needsInput ? 'Checks: ' : 'Why eligible: '}</span>{why.join(' · ')}
        </div>
      )}
      <div style={{ color: 'var(--text-dim)' }}>
        {firstSeen && <>First seen {firstSeen}</>}
        {sources && <> via {sources}</>}
        {' · '}Observed (not verified)
      </div>
    </div>
  );
}
