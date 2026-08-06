'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppTheme } from './app-theme-provider';

interface MobileNavProps {
  email: string;
  displayName: string | null;
  userId: string;
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

export function MobileNav({ email, displayName, userId, openIncidents = 0 }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggle } = useAppTheme();

  // Close drawer when the route changes — syncing UI state with router is a valid effect use case
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
  }

  function isActive(href: string, activePath?: string) {
    const check = activePath ?? href;
    return pathname === check || pathname.startsWith(check + '/');
  }

  const avatarLetters = initials(displayName, email);

  const mainNav = [
    { label: 'Overview',     href: '/overview',            activePath: undefined },
    { label: 'Services',     href: '/services',            activePath: undefined },
    { label: 'Incidents',    href: '/incidents',           activePath: undefined, badge: openIncidents || null },
    { label: 'Status Pages', href: `/status/${userId}`,   activePath: undefined, external: true },
  ];
  const settingsNav = [
    { label: 'Alerts',   href: '/settings/alerts' },
    { label: 'Account',  href: '/settings/account' },
  ];

  const navLinkStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', fontSize: 16, borderRadius: 8,
    textDecoration: 'none', marginBottom: 2,
    transition: 'background 0.1s',
  };

  return (
    <>
      {/* Top bar — display controlled by CSS media query */}
      <header
        className="mobile-nav-bar"
        style={{
          display: 'none',
          position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
          height: 48, padding: '0 14px',
          background: 'var(--sidebar-bg)',
          borderBottom: '1px solid var(--sidebar-border)',
          alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="22" height="16" viewBox="0 0 80 60" fill="none" aria-hidden="true">
            <circle cx="23" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
            <circle cx="57" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
            <line x1="7" y1="30" x2="33" y2="30" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 23 A7 7 0 0 1 40 37" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="40" cy="30" r="5" fill="var(--text-primary)" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>CORTX</span>
        </div>

        {/* Right side: incidents badge + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {openIncidents > 0 && !open && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: 'var(--status-critical)', color: '#fff',
              borderRadius: 99, padding: '2px 7px',
            }}>
              {openIncidents}
            </span>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            style={{
              width: 36, height: 36, borderRadius: 7,
              border: '1px solid var(--border-default)',
              background: open ? 'var(--bg-hover)' : 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-primary)', fontSize: open ? 16 : 18,
              transition: 'background 0.1s',
            }}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Full-screen nav drawer */}
      {open && (
        <div style={{
          position: 'fixed', top: 48, left: 0, right: 0, bottom: 0,
          zIndex: 99, background: 'var(--sidebar-bg)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          {/* Main nav */}
          <nav style={{ padding: '10px 10px 0' }}>
            {mainNav.map((item) => {
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...navLinkStyle, color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {item.label}
                    <span style={{ fontSize: 12, opacity: 0.4 }}>↗</span>
                  </a>
                );
              }
              const active = isActive(item.href, item.activePath);
              return (
                <Link
                  key={item.href + (item.activePath ?? '')}
                  href={item.href}
                  style={{
                    ...navLinkStyle,
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--bg-hover)' : 'transparent'; }}
                >
                  {item.label}
                  {item.badge && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      background: 'var(--status-critical)', color: '#fff',
                      borderRadius: 99, padding: '2px 7px',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '8px 6px' }} />

            {settingsNav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...navLinkStyle,
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--bg-hover)' : 'transparent'; }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Account footer */}
          <div style={{
            marginTop: 'auto', padding: '16px 12px 32px',
            borderTop: '1px solid var(--sidebar-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg-muted)', border: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              }}>
                {avatarLetters}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName || email.split('@')[0]}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={signOut}
                style={{
                  flex: 1, padding: '10px', fontSize: 14, fontWeight: 500,
                  color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)', borderRadius: 8, cursor: 'pointer',
                  transition: 'color 0.1s',
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
                  width: 46, fontSize: 18,
                  color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)', borderRadius: 8, cursor: 'pointer',
                }}
              >
                {theme === 'dark' ? '☀' : '◑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
