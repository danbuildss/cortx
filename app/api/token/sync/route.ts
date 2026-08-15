import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTokenBalance, getTier } from '@/lib/token';

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('cortx_wallet_address')
    .eq('id', user.id)
    .maybeSingle();

  const wallet = profile?.cortx_wallet_address;
  if (!wallet) return NextResponse.json({ error: 'No wallet address saved' }, { status: 400 });

  let balanceWei: bigint;
  try {
    balanceWei = await getTokenBalance(wallet);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const tier = getTier(balanceWei);
  const balanceTokens = Number(balanceWei) / 1e18;

  await supabase
    .from('profiles')
    .update({
      cortx_token_balance: balanceTokens,
      cortx_tier: tier,
      cortx_balance_synced_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  return NextResponse.json({ balance: balanceTokens, tier });
}
