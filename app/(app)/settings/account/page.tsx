import { createClient } from '@/lib/supabase/server';
import { AccountForm } from './_components/account-client';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  return (
    <div style={{ padding: '32px 40px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Account
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Manage your display name and account details.
        </p>
      </div>

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
        borderRadius: 8, padding: '24px',
      }}>
        <AccountForm
          initialDisplayName={profile?.display_name ?? null}
          email={user?.email ?? ''}
        />
      </div>
    </div>
  );
}
