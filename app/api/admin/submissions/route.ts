import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_USER_ID = process.env.CORTX_ADMIN_USER_ID ?? '';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== ADMIN_USER_ID) return null;
  return user;
}

// GET /api/admin/submissions?status=pending|approved|rejected
export async function GET(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') ?? 'pending';

  const db = serviceClient();
  const { data, error } = await db
    .from('endpoint_submissions')
    .select('id, endpoint_url, name, description, x_handle, website_url, category, submitter_email, submitted_at, status, reviewed_at, rejection_reason, seed_id')
    .eq('status', status)
    .order('submitted_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

// PATCH /api/admin/submissions
// body: { id, action: 'approve' | 'reject', rejection_reason?: string }
export async function PATCH(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const id     = typeof body.id     === 'string' ? body.id     : '';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!id)     return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const db = serviceClient();

  // Fetch the submission
  const { data: sub, error: fetchErr } = await db
    .from('endpoint_submissions')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .single();

  if (fetchErr || !sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  if (action === 'reject') {
    const rejection_reason = typeof body.rejection_reason === 'string' ? body.rejection_reason.trim() : null;
    const { error } = await db
      .from('endpoint_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id, rejection_reason })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordCoriDecision(db, sub.discovered_service_id, 'rejected', { submission_id: id, reason: rejection_reason });
    if (sub.source === 'cori_scout') await setCoriCompany(db, id, { rejected_at: new Date().toISOString(), watching: false });
    return NextResponse.json({ success: true });
  }

  // Cori's company cards (Q2, Oct 10): approve = Watching. Private, re-checked
  // by Cori every day; nothing goes on the public registry until there's
  // evidence (paid monitoring), and the founder publishes it.
  if (sub.source === 'cori_scout') {
    const now = new Date().toISOString();
    const { error } = await db
      .from('endpoint_submissions')
      .update({ status: 'approved', reviewed_at: now, reviewed_by: user.id })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await setCoriCompany(db, id, { watching: true, approved_at: now, rejected_at: null });
    await recordCoriDecision(db, sub.discovered_service_id, 'approved', { submission_id: id, watching: true });
    return NextResponse.json({ success: true, watching: true });
  }

  // approve: create a registry_seeds row, then update submission
  const { data: seed, error: seedErr } = await db
    .from('registry_seeds')
    .insert({
      name:        sub.name,
      endpoint_url: sub.endpoint_url,
      description: sub.description,
      x_handle:    sub.x_handle,
      website_url: sub.website_url,
      category:    sub.category,
      status:      'unknown',
      is_verified: false,
    })
    .select('id')
    .single();

  if (seedErr || !seed) {
    console.error('[admin/submissions] seed insert failed:', seedErr?.message);
    return NextResponse.json({ error: 'Failed to create registry entry' }, { status: 500 });
  }

  const { error: updateErr } = await db
    .from('endpoint_submissions')
    .update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      seed_id:     seed.id,
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  await recordCoriDecision(db, sub.discovered_service_id, 'approved', { submission_id: id, seed_id: seed.id }, seed.id);
  return NextResponse.json({ success: true, seed_id: seed.id });
}

// Cori company cards: the review decision on the company row (Watching / rejected)
async function setCoriCompany(
  db: ReturnType<typeof serviceClient>,
  submissionId: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    // discovered_companies isn't in the generated Supabase types
    await (db as unknown as { from: (t: string) => { update: (f: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } } })
      .from('discovered_companies')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('linked_submission_id', submissionId);
  } catch (err) {
    console.error('[admin/submissions] Cori company update failed:', err instanceof Error ? err.message : err);
  }
}

// Cori candidates: write the review decision back into Cori's memory so it
// stops treating an approved service as a candidate and records the history.
// Never fails the review itself.
async function recordCoriDecision(
  db: ReturnType<typeof serviceClient>,
  discoveredServiceId: string | null | undefined,
  event: 'approved' | 'rejected',
  details: Record<string, unknown>,
  seedId?: string
): Promise<void> {
  if (!discoveredServiceId) return;
  try {
    if (event === 'approved' && seedId) {
      await db.from('discovered_services').update({
        linked_seed_id: seedId,
        classification: 'already_listed',
        classification_reasons: ['linked:registry'],
        next_probe_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', discoveredServiceId);
    }
    await db.from('discovery_events').insert({ discovered_service_id: discoveredServiceId, event, details });
  } catch (err) {
    console.error('[admin/submissions] Cori link-back failed:', err instanceof Error ? err.message : err);
  }
}
