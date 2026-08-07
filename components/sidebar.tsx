'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppTheme } from './app-theme-provider';

// ── Icons ──────────────────────────────────────────────────
function OverviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1"/>
      <rect x="9.5" y="1.5" width="5" height="5" rx="1"/>
      <rect x="1.5" y="9.5" width="5" height="5" rx="1"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1"/>
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="3.5" rx="1"/>
      <rect x="1.5" y="9.5" width="13" height="3.5" rx="1"/>
      <circle cx="4" cy="4.75" r="0.6" fill="currentColor" stroke="none"/>
      <circle cx="4" cy="11.25" r="0.6" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IncidentsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L14.5 13.5H1.5L8 2Z"/>
      <line x1="8" y1="7" x2="8" y2="10"/>
      <circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function StatusPagesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M5.5 8 C5.5 4.5 6.5 2.5 8 2.5 S10.5 4.5 10.5 8 S9.5 13.5 8 13.5 S5.5 11.5 5.5 8Z"/>
      <line x1="2.2" y1="8" x2="13.8" y2="8"/>
    </svg>
  );
}

function AlertsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.2 12.5a1.9 1.9 0 0 0 3.6 0"/>
      <path d="M3.5 6.5a4.5 4.5 0 0 1 9 0v2.8l1.3 1.9H2.2L3.5 9.3V6.5Z"/>
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5.5" r="3"/>
      <path d="M2.5 14.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/>
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2 4v4c0 3.3 2.5 5.8 6 6.5 3.5-.7 6-3.2 6-6.5V4L8 1.5Z"/>
      <polyline points="5.5,8 7,9.5 10.5,6"/>
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V7"/>
      <path d="M7.5 1.5H10.5V4.5"/>
      <line x1="10.5" y1="1.5" x2="5.5" y2="6.5"/>
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────
interface SidebarProps {
  email: string;
  displayName: string | null;
  userId: string;
  openIncidents?: number;
  isAdmin?: boolean;
}

// ── Helpers ────────────────────────────────────────────────
function initials(displayName: string | null, email: string): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

// ── Component ──────────────────────────────────────────────
export function Sidebar({ email, displayName, userId, openIncidents = 0, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggle } = useAppTheme();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function isActive(href: string, activePath?: string) {
    const check = activePath ?? href;
    return pathname === check || pathname.startsWith(check + '/');
  }

  const avatarLetters = initials(displayName, email);

  const mainNav = [
    { label: 'Overview', href: '/overview', icon: <OverviewIcon /> },
    { label: 'Services', href: '/services', icon: <ServicesIcon /> },
    { label: 'Incidents', href: '/incidents', icon: <IncidentsIcon /> },
    { label: 'Status Pages', href: `/status/${userId}`, icon: <StatusPagesIcon />, external: true },
  ];

  const settingsNav = [
    { label: 'Alerts', href: '/settings/alerts', icon: <AlertsIcon /> },
    { label: 'Account', href: '/settings/account', icon: <AccountIcon /> },
  ];

  return (
    <aside
      className="sidebar-el"
      style={{
        width: 224,
        minWidth: 224,
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
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="24" height="18" viewBox="0 0 80 60" fill="none" aria-hidden="true">
          <circle cx="23" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
          <circle cx="57" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
          <line x1="7" y1="30" x2="33" y2="30" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 23 A7 7 0 0 1 40 37" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="30" r="5" fill="var(--text-primary)" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          CORTX
        </span>
      </div>

      <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 10px' }} />

      {/* Main nav */}
      <nav style={{ padding: '6px 6px', flex: 1 }}>
        {mainNav.map((item) => {
          const active = item.external ? false : isActive(item.href, (item as { activePath?: string }).activePath);
          return item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="app-nav-link"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ flexShrink: 0, opacity: 0.7 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ opacity: 0.4 }}><ExternalIcon /></span>
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`app-nav-link${active ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.label === 'Incidents' && openIncidents > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  background: 'var(--status-critical)',
                  color: '#fff',
                  borderRadius: 99,
                  padding: '1px 5px',
                  lineHeight: '15px',
                }}>
                  {openIncidents}
                </span>
              )}
            </Link>
          );
        })}

        <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '6px 4px' }} />

        {settingsNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-nav-link${active ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '6px 4px' }} />
            <Link
              href="/admin"
              className={`app-nav-link${isActive('/admin') ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ flexShrink: 0, opacity: isActive('/admin') ? 1 : 0.55 }}><AdminIcon /></span>
              <span style={{ flex: 1 }}>Admin</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em',
                background: 'rgba(239,68,68,0.12)', color: 'var(--status-critical)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>OWNER</span>
            </Link>
          </>
        )}
      </nav>

      <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '0 10px' }} />

      {/* Account section */}
      <div style={{ padding: '10px 10px 12px' }}>
        <Link
          href="/settings/account"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 8px', borderRadius: 7,
            textDecoration: 'none',
            background: isActive('/settings/account') ? 'var(--bg-hover)' : 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive('/settings/account') ? 'var(--bg-hover)' : 'transparent'; }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            {avatarLetters}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, padding: '0 2px' }}>
          <button
            onClick={signOut}
            style={{
              fontSize: 11, color: 'var(--text-secondary)',
              background: 'none', border: 'none', padding: '4px 6px',
              cursor: 'pointer', borderRadius: 4, transition: 'color 0.1s',
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
              width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: '1px solid var(--border-mid)',
              borderRadius: 6, cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 12,
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
