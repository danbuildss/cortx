'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { label: 'Overview', href: '/overview' },
  { label: 'Incidents', href: '/incidents' },
];

const SETTINGS_NAV = [
  { label: 'Alert settings', href: '/settings/alerts' },
];

interface SidebarProps {
  email: string;
}

export function Sidebar({ email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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
        background: '#111111',
        borderRight: '1px solid #1f1f1f',
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
          <circle cx="23" cy="30" r="18" stroke="#f0f0f0" strokeWidth="3" />
          <circle cx="57" cy="30" r="18" stroke="#f0f0f0" strokeWidth="3" />
          <line x1="7" y1="30" x2="33" y2="30" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 23 A7 7 0 0 1 40 37" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="30" r="5" fill="#f0f0f0" />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
          CORTX
        </span>
      </div>

      <div style={{ height: 1, background: '#1f1f1f', margin: '0 12px' }} />

      {/* Main nav */}
      <nav style={{ padding: '8px 8px', flex: 1 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 400,
              color: isActive(item.href) ? '#f0f0f0' : '#888888',
              background: isActive(item.href) ? 'rgba(255,255,255,0.05)' : 'transparent',
              textDecoration: 'none',
              marginBottom: 2,
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isActive(item.href)) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                (e.currentTarget as HTMLElement).style.color = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.href)) {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = '#888888';
              }
            }}
          >
            {item.label}
          </Link>
        ))}

        <div style={{ height: 1, background: '#1f1f1f', margin: '8px 4px' }} />

        {SETTINGS_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: 13,
              color: isActive(item.href) ? '#f0f0f0' : '#888888',
              background: isActive(item.href) ? 'rgba(255,255,255,0.05)' : 'transparent',
              textDecoration: 'none',
              marginBottom: 2,
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isActive(item.href)) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                (e.currentTarget as HTMLElement).style.color = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.href)) {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = '#888888';
              }
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ height: 1, background: '#1f1f1f', margin: '0 12px' }} />

      {/* User + sign out */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ fontSize: 12, color: '#555555', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email}
        </div>
        <button
          onClick={signOut}
          style={{
            fontSize: 12,
            color: '#888888',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f0f0f0'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#888888'; }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
