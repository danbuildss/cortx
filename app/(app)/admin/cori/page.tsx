// /admin/cori: Cori's own page. Is it alive, what's waiting for review, what
// it knows, what it did recently. Owner only.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { heartbeatState } from '@/lib/cori/status';
import { adminServiceClient, loadCoriOverview } from '../cori-data';
import { CoriActivity, CoriErrors, CoriKnows, CoriStatusCard, coriCard, coriLabel } from '../cori-panel';
import { CoriCandidateCard } from '../cori-candidate';
import { CoriKnownProjects, CoriWatching } from '../cori-watching';

const ADMIN_USER_ID = process.env.CORTX_ADMIN_USER_ID ?? '';

export default async function CoriPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== ADMIN_USER_ID) redirect('/overview');

  const { runs, totalDiscovered, companies, companiesSiteOk, events, classCounts, candidates, quietCandidates, watching, partnersMissing, loadedAt: now } = await loadCoriOverview(adminServiceClient());
  const started = heartbeatState(runs[0] ? new Date(runs[0].started_at) : null, new Date(now)) !== 'not_started';

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Cori</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.6 }}>
            Finds real companies selling paid AI services and checks them for free, every day. Never pays for anything. Approve = watch it privately; nothing is public until you publish it.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '4px 10px', background: 'rgba(239,68,68,0.08)', color: 'var(--status-critical)', border: '1px solid rgba(239,68,68,0.18)' }}>
          Owner only
        </span>
      </div>

      <CoriStatusCard runs={runs} totalDiscovered={totalDiscovered} companies={companies} companiesSiteOk={companiesSiteOk} now={now} />

      {(started || candidates.length > 0) && (
        <>
          <div style={coriCard}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={coriLabel}>Waiting for you</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: candidates.length > 0 ? 'var(--status-degraded)' : 'var(--text-dim)' }}>
                {candidates.length} to review
              </span>
            </div>
            {candidates.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                Nothing to review. New finds show up here.
              </div>
            ) : candidates.map((c, i) => <CoriCandidateCard key={c.id} c={c} last={i === candidates.length - 1} />)}
            {quietCandidates > 0 && (
              <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
                {quietCandidates} more hidden: they stopped answering. They come back if they start answering again.
              </div>
            )}
          </div>

          <CoriWatching watching={watching} now={now} />
          <CoriKnownProjects partners={partnersMissing} />

          <CoriKnows classCounts={classCounts} totalDiscovered={totalDiscovered} />
          <CoriErrors runs={runs} now={now} />
          <CoriActivity events={events} />
        </>
      )}
    </div>
  );
}
