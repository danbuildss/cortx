import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

// POST /api/services/verify
// body: { serviceId: string, action: 'init' | 'confirm' }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { serviceId, action } = await req.json();
  if (!serviceId || !action) {
    return NextResponse.json({ error: 'serviceId and action are required' }, { status: 400 });
  }

  // Fetch the service and confirm ownership
  const { data: service, error: fetchError } = await supabase
    .from('services')
    .select('id, url, verification_token, verification_status')
    .eq('id', serviceId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  if (action === 'init') {
    const token = `cortx-verify-${randomBytes(12).toString('hex')}`;
    const { error } = await supabase
      .from('services')
      .update({ verification_token: token, verification_status: 'pending' })
      .eq('id', serviceId);

    if (error) return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    return NextResponse.json({ token });
  }

  if (action === 'confirm') {
    if (!service.verification_token) {
      return NextResponse.json({ error: 'No token generated yet. Call init first.' }, { status: 400 });
    }

    // Fetch the endpoint and look for the token in the response
    let found = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(service.url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'CORTX-Verify/1.0' },
      });
      clearTimeout(timeout);

      // Check headers
      const headerVal = res.headers.get('x-cortx-verify') ?? res.headers.get('x-cortx-verification');
      if (headerVal === service.verification_token) {
        found = true;
      }

      // Check body (capped at 64KB)
      if (!found) {
        const body = await res.text().catch(() => '');
        if (body.includes(service.verification_token)) {
          found = true;
        }
      }
    } catch {
      return NextResponse.json({ error: 'Could not reach the endpoint. Make sure it is reachable.' }, { status: 422 });
    }

    if (!found) {
      return NextResponse.json({ verified: false, error: 'Token not found in response headers or body.' }, { status: 422 });
    }

    const { error } = await supabase
      .from('services')
      .update({ verification_status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', serviceId);

    if (error) return NextResponse.json({ error: 'Failed to save verification' }, { status: 500 });
    return NextResponse.json({ verified: true });
  }

  return NextResponse.json({ error: 'action must be init or confirm' }, { status: 400 });
}
