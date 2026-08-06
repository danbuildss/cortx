'use client';

import { useState } from 'react';

export function AccountForm({
  initialDisplayName,
  email,
}: {
  initialDisplayName: string | null;
  email: string;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() || null }),
      });
      if (res.ok) {
        setMsg('Saved.');
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg('Failed to save.');
      }
    } catch {
      setMsg('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Avatar preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          {displayName
            ? (() => {
                const parts = displayName.trim().split(/\s+/);
                return parts.length >= 2
                  ? (parts[0][0] + parts[1][0]).toUpperCase()
                  : parts[0][0]?.toUpperCase() ?? email[0].toUpperCase();
              })()
            : email[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {displayName || email.split('@')[0]}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{email}</div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      {/* Display name */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Display name
        </label>
        <input
          className="app-input"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={64}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
          Shown in the sidebar. Leave blank to use your email.
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Email
        </label>
        <input
          className="app-input"
          type="email"
          value={email}
          readOnly
          style={{ opacity: 0.6, cursor: 'default' }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
          Email is managed through your login provider.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '8px 20px',
            background: saving ? 'var(--border-default)' : 'var(--text-primary)',
            color: 'var(--bg-page)',
            border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {msg && (
          <span style={{
            fontSize: 12,
            color: msg === 'Saved.' ? 'var(--status-operational)' : 'var(--status-critical)',
          }}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
