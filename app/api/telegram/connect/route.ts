import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { error } = await supabase
    .from('telegram_link_tokens')
    .insert({ user_id: user.id, token, expires_at: expiresAt.toISOString() });

  if (error) {
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
  }

  const deepLinkUrl = `https://t.me/${botUsername}?start=${token}`;
  return NextResponse.json({ deepLinkUrl });
}
