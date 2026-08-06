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
  { label: 'Account', href: '/settings/account' },
];

interface SidebarProps {
  email: string;
  displayName: string | null;
  openIncidents?: number;
}

function initials(displayName: string | null, email: string): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

export function Sidebar({ email, displayName, openIncidents = 0 }: SidebarProps) {
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

  const avatarLetters = initials(displayName, email);
  const label = displayName || email;

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

      {/* Account section */}
      <div style={{ padding: '12px 12px 14px' }}>
        <Link
          href="/settings/account"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 7,
            textDecoration: 'none',
            background: isActive('/settings/account') ? 'var(--bg-hover)' : 'transparent',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive('/settings/account') ? 'var(--bg-hover)' : 'transparent'; }}
        >
          {/* Avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            {avatarLetters}
          </div>
          {/* Name + email */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName || email.split('@')[0]}
            </div>
            {displayName && (
              <div style={{
                fontSize: 11, color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {email}
              </div>
            )}
          </div>
        </Link>

        {/* Sign out + theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, padding: '0 4px' }}>
          <button
            onClick={signOut}
            style={{
              fontSize: 12, color: 'var(--text-secondary)',
              background: 'none', border: 'none', padding: '4px 6px',
              cursor: 'pointer', borderRadius: 4,
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
