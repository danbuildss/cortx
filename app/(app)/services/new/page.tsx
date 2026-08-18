import { createClient } from '@/lib/supabase/server';
import { OnboardWizard } from './_components/onboard-wizard';

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialTelegramConnected = false;
  let hasWallet = false;
  if (user) {
    const [{ data: tg }, { data: profile }] = await Promise.all([
      supabase
        .from('telegram_connections')
        .select('chat_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('cortx_wallet_address')
        .eq('id', user.id)
        .maybeSingle(),
    ]);
    initialTelegramConnected = tg != null;
    hasWallet = !!(profile?.cortx_wallet_address);
  }

  return <OnboardWizard initialTelegramConnected={initialTelegramConnected} hasWallet={hasWallet} />;
}
