import { createClient } from '@/lib/supabase/server';
import { AccountForm } from './_components/account-client';
import { TokenSection } from './_components/token-section';
import { TIER_LABELS, TIER_LIMITS } from '@/lib/token';
import type { Tier } from '@/lib/token';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, cortx_wallet_address, cortx_token_balance, cortx_tier, is_admin, cortx_balance_synced_at')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  const { count: serviceCount } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user?.id ?? '')
    .is('deleted_at', null);

  const tier = (profile?.cortx_tier ?? 'free') as Tier;
  const isAdmin = profile?.is_admin ?? false;
  const limit = isAdmin ? null : TIER_LIMITS[tier];

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Account
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Manage your display name and account details.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
        alignItems: 'start',
      }}>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
          borderRadius: 8, padding: '24px',
        }}>
          <AccountForm
            initialDisplayName={profile?.display_name ?? null}
            email={user?.email ?? ''}
          />
        </div>

        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
          borderRadius: 8, padding: '24px',
        }}>
          <TokenSection
            initialWallet={profile?.cortx_wallet_address ?? null}
            balance={profile?.cortx_token_balance ?? 0}
            tier={tier}
            tierLabel={isAdmin ? 'Admin' : TIER_LABELS[tier]}
            isAdmin={isAdmin}
            serviceCount={serviceCount ?? 0}
            serviceLimit={limit}
            syncedAt={profile?.cortx_balance_synced_at ?? null}
          />
        </div>
      </div>
    </div>
  );
}
