import { createClient } from '@/lib/supabase/server';
import { TelegramConnect, DiscordConnect } from './_components/alerts-client';

export default async function AlertSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: telegramConn }, { data: discordConn }] = await Promise.all([
    supabase
      .from('telegram_connections')
      .select('chat_id, username, connected_at, active, on_open, on_severity_increase, on_resolve')
      .eq('user_id', user?.id ?? '')
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('discord_connections')
      .select('webhook_url, connected_at, on_open, on_severity_increase, on_resolve')
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),
  ]);

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Alert settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Connect Telegram or Discord to receive incident alerts across all your monitored services.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
        alignItems: 'start',
      }}>
        <TelegramConnect initialConnection={telegramConn ?? null} />
        <DiscordConnect initialConnection={discordConn ?? null} />
      </div>
    </div>
  );
}
