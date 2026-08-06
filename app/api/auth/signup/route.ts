import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { email, password, inviteCode } = await req.json();

  if (!email || !password || !inviteCode) {
    return NextResponse.json({ error: 'Email, password, and invite code are required.' }, { status: 400 });
  }

  // Use service role to check/claim the invite code — bypasses RLS
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Atomically claim the code — only succeeds if it exists and is unused
  const { data: claimed, error: claimError } = await service
    .from('invite_codes')
    .update({ used_by: email, used_at: new Date().toISOString() })
    .eq('code', inviteCode.trim().toUpperCase())
    .is('used_at', null)
    .select('id')
    .single();

  if (claimError || !claimed) {
    return NextResponse.json({ error: 'Invalid or already used invite code.' }, { status: 400 });
  }

  // Code is valid — create the account
  const supabase = await createClient();
  const { error: signUpError } = await supabase.auth.signUp({ email, password });

  if (signUpError) {
    // Roll back the code claim so it can be reused
    await service
      .from('invite_codes')
      .update({ used_by: null, used_at: null })
      .eq('id', claimed.id);

    if (signUpError.message.toLowerCase().includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 400 });
    }
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
