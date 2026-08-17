import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isValidDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      /^(ptb\.|canary\.)?discord(app)?\.com$/.test(parsed.hostname) &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { webhookUrl } = await req.json();
  if (!webhookUrl || !isValidDiscordWebhook(webhookUrl)) {
    return NextResponse.json({ error: 'Invalid Discord webhook URL' }, { status: 400 });
  }

  const { error } = await supabase.from('discord_connections').upsert({
    user_id: user.id,
    webhook_url: webhookUrl,
    connected_at: new Date().toISOString(),
    on_open: true,
    on_severity_increase: true,
    on_resolve: true,
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
