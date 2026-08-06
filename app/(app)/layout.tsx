import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { AppThemeProvider } from '@/components/app-theme-provider';
import { FeedbackWidget } from '@/components/feedback-widget';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  let openIncidents = 0;
  let displayName: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const [{ count }, { data: profile }] = await Promise.all([
        supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'acknowledged']),
        supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle(),
      ]);
      openIncidents = count ?? 0;
      displayName = profile?.display_name ?? null;
    }
  } catch {
    // Supabase unavailable — fall through to redirect
  }

  if (!user) redirect('/login');

  const sharedNavProps = {
    email: user!.email ?? '',
    displayName,
    userId: user!.id,
    openIncidents,
  };

  return (
    <>
      {/* Inline script prevents flash of wrong theme before React hydrates */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('cortx-app-theme');if(t)document.documentElement.setAttribute('data-theme',t);})();`,
        }}
      />
      <AppThemeProvider>
        {/* Mobile top bar (hidden on desktop via CSS) */}
        <MobileNav {...sharedNavProps} />

        {/* App shell — full height on desktop, minus top bar on mobile */}
        <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          {/* Desktop sidebar (hidden on mobile via CSS) */}
          <Sidebar {...sharedNavProps} />

          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-page)' }}>
            {children}
          </main>
        </div>

        <FeedbackWidget />
      </AppThemeProvider>
    </>
  );
}
