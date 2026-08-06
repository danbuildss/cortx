import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { AppThemeProvider } from '@/components/app-theme-provider';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  let openIncidents = 0;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const { count } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'acknowledged']);
      openIncidents = count ?? 0;
    }
  } catch {
    // Supabase unavailable — fall through to redirect
  }

  if (!user) redirect('/login');

  return (
    <>
      {/* Inline script prevents flash of wrong theme before React hydrates */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('cortx-app-theme');if(t)document.documentElement.setAttribute('data-theme',t);})();`,
        }}
      />
      <AppThemeProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar email={user!.email ?? ''} openIncidents={openIncidents} />
          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-page)' }}>
            {children}
          </main>
        </div>
      </AppThemeProvider>
    </>
  );
}
