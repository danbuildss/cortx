import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendDiscordAlert } from '@/lib/discord';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: conn } = await supabase
    .from('discord_connections')
    .select('webhook_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!conn?.webhook_url) {
    return NextResponse.json({ error: 'No Discord connection' }, { status: 404 });
  }

  await sendDiscordAlert(
    conn.webhook_url,
    '✅ **CORTX test alert** — your Discord alerts are working correctly.'
  );
  return NextResponse.json({ ok: true });
}
