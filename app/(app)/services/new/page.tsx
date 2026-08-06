import { createClient } from '@/lib/supabase/server';
import { OnboardWizard } from './_components/onboard-wizard';

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialTelegramConnected = false;
  if (user) {
    const { data } = await supabase
      .from('telegram_connections')
      .select('chat_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    initialTelegramConnected = data != null;
  }

  return <OnboardWizard initialTelegramConnected={initialTelegramConnected} />;
}
