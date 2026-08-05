import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase failed to initialize (e.g. missing env vars) — fall through to redirect
  }

  if (!user) redirect('/login');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar email={user.email ?? ''} />
      <main style={{ flex: 1, overflowY: 'auto', background: '#000000' }}>
        {children}
      </main>
    </div>
  );
}
