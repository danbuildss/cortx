import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const displayName = body.display_name;
  if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
    return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 });
  }

  const walletAddress = body.cortx_wallet_address;
  if (walletAddress !== undefined && walletAddress !== null) {
    if (typeof walletAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = {};
  if (displayName !== undefined) update.display_name = displayName ?? null;
  if (walletAddress !== undefined) update.cortx_wallet_address = walletAddress ?? null;

  if (Object.keys(update).length > 0) {
    await supabase.from('profiles').update(update).eq('id', user.id);
  }

  return NextResponse.json({ ok: true });
}
