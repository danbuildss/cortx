import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CATEGORIES = ['AI / Inference', 'Data / Search', 'Media / Generation', 'Finance / Payments', 'Developer Tools', 'Other'];

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/submissions — public, no auth required
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const endpoint_url    = typeof body.endpoint_url   === 'string' ? body.endpoint_url.trim()   : '';
  const name            = typeof body.name           === 'string' ? body.name.trim()           : '';
  const description     = typeof body.description    === 'string' ? body.description.trim()    : null;
  const x_handle        = typeof body.x_handle       === 'string' ? body.x_handle.trim()       : null;
  const website_url     = typeof body.website_url    === 'string' ? body.website_url.trim()    : null;
  const category        = typeof body.category       === 'string' ? body.category.trim()       : null;
  const submitter_email = typeof body.submitter_email === 'string' ? body.submitter_email.trim() : null;

  if (!endpoint_url) return NextResponse.json({ error: 'endpoint_url is required' }, { status: 400 });
  if (!name)         return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // Basic URL validation — not a full SSRF check (endpoint isn't fetched here)
  try {
    const u = new URL(endpoint_url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'endpoint_url must be a valid URL' }, { status: 400 });
  }

  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  if (submitter_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitter_email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const db = serviceClient();

  // Prevent duplicate pending submissions for the same URL
  const { data: existing } = await db
    .from('endpoint_submissions')
    .select('id')
    .eq('endpoint_url', endpoint_url)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This endpoint already has a pending submission.' }, { status: 409 });
  }

  const { error } = await db.from('endpoint_submissions').insert({
    endpoint_url,
    name,
    description:     description     || null,
    x_handle:        x_handle        || null,
    website_url:     website_url     || null,
    category:        category        || null,
    submitter_email: submitter_email || null,
  });

  if (error) {
    console.error('[submissions] insert error:', error.message);
    return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
