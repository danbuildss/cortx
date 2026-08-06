import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramAlert } from '@/lib/telegram';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate webhook secret — reject anything without it
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = body?.message as Record<string, unknown> | undefined;
  if (!message) return NextResponse.json({ ok: true });

  const chat = message.chat as Record<string, unknown> | undefined;
  const from = message.from as Record<string, unknown> | undefined;
  const text = typeof message.text === 'string' ? message.text : '';
  const chatId = String(chat?.id ?? '');
  const username = typeof from?.username === 'string' ? from.username : null;

  // Only handle /start {token}
  if (!text.startsWith('/start ')) return NextResponse.json({ ok: true });
  const token = text.slice(7).trim();
  if (!token || !chatId) return NextResponse.json({ ok: true });

  const db = serviceClient();

  // Look up token — must exist, unused, not expired
  const { data: tokenRow } = await db
    .from('telegram_link_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
    await sendTelegramAlert(chatId, '❌ This link has expired or already been used. Generate a new one from the CORTX dashboard.');
    return NextResponse.json({ ok: true });
  }

  // Mark token used
  await db
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  // Upsert connection (one per user)
  await db
    .from('telegram_connections')
    .upsert(
      {
        user_id: tokenRow.user_id,
        chat_id: chatId,
        username,
        connected_at: new Date().toISOString(),
        active: true,
        on_open: true,
        on_severity_increase: true,
        on_resolve: true,
      },
      { onConflict: 'user_id' }
    );

  // Confirm to user in Telegram
  await sendTelegramAlert(
    chatId,
    '✅ <b>CORTX connected!</b>\nYou\'ll receive incident alerts here.\n\n<i>Tip: You can adjust which alerts fire in your CORTX dashboard → Alert settings.</i>'
  );

  return NextResponse.json({ ok: true });
}
