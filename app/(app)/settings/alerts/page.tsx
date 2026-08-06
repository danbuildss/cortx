import { createClient } from '@/lib/supabase/server';
import { TelegramConnect } from './_components/alerts-client';

export default async function AlertSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: connection } = await supabase
    .from('telegram_connections')
    .select('chat_id, username, connected_at, active, on_open, on_severity_increase, on_resolve')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)
    .maybeSingle();

  return (
    <div style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Alert settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Connect Telegram to receive incident alerts across all your monitored services.
        </p>
      </div>

      <TelegramConnect initialConnection={connection ?? null} />
    </div>
  );
}
