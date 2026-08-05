import { createClient } from '@/lib/supabase/server';
import { AlertsClient } from './_components/alerts-client';

export default async function AlertSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: services }, { data: configs }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),

    supabase
      .from('alert_configs')
      .select('id, service_id, destination, enabled, on_open, on_severity_increase, on_resolve')
      .order('created_at', { ascending: true }),
  ]);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>
          Alert settings
        </h1>
        <p style={{ fontSize: 13, color: '#555' }}>
          Configure Telegram notifications per service. Alerts fire when an incident opens, escalates, or resolves.
        </p>
      </div>

      <AlertsClient
        services={services ?? []}
        configs={configs ?? []}
        userId={user?.id ?? ''}
      />
    </div>
  );
}
