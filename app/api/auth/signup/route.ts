import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error: signUpError } = await supabase.auth.signUp({ email, password });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 400 });
    }
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
