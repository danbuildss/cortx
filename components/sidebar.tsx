'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppTheme } from './app-theme-provider';

const NAV = [
  { label: 'Overview', href: '/overview' },
  { label: 'Incidents', href: '/incidents' },
];

const SETTINGS_NAV = [
  { label: 'Alert settings', href: '/settings/alerts' },
];

interface SidebarProps {
  email: string;
  openIncidents?: number;
}

export function Sidebar({ email, openIncidents = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggle } = useAppTheme();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Wordmark */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="26" height="20" viewBox="0 0 80 60" fill="none" aria-hidden="true">
          <circle cx="23" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
          <circle cx="57" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
          <line x1="7" y1="30" x2="33" y2="30" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 23 A7 7 0 0 1 40 37" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="30" r="5" fill="var(--text-primary)" />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          CORTX
        </span>
      </div>

      <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 12px' }} />

      {/* Main nav */}
      <nav style={{ padding: '8px 8px', flex: 1 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`app-nav-link${isActive(item.href) ? ' active' : ''}`}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.label}
              {item.href === '/incidents' && openIncidents > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  background: 'var(--status-critical)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '1px 6px',
                  lineHeight: '16px',
                }}>
                  {openIncidents}
                </span>
              )}
            </span>
          </Link>
        ))}

        <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '8px 4px' }} />

        {SETTINGS_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`app-nav-link${isActive(item.href) ? ' active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 12px' }} />

      {/* User + theme toggle + sign out */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={signOut}
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          >
            Sign out
          </button>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: '1px solid var(--border-mid)',
              borderRadius: 6, cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 13,
              transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-mid)';
            }}
          >
            {theme === 'dark' ? '☀' : '◑'}
          </button>
        </div>
      </div>
    </aside>
  );
}
