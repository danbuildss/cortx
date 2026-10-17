import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramAlert } from '@/lib/telegram';

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: conn } = await supabase
    .from('telegram_connections')
    .select('chat_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }

  const sent = await sendTelegramAlert(
    conn.chat_id,
    '🔔 <b>Test alert from CORTX</b>\nYour Telegram connection is working correctly.'
  );
  // Only say "sent" when Telegram accepted it (Oct 17: a dead bot token showed "Sent!")
  if (!sent.ok) return NextResponse.json({ error: sent.reason }, { status: 502 });

  return NextResponse.json({ ok: true });
}
