'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Sign in instead.');
        } else {
          setError(error.message);
        }
      } else {
        router.push('/overview');
        router.refresh();
      }
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <svg width="48" height="36" viewBox="0 0 80 60" fill="none" aria-label="CORTX">
            <circle cx="23" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
            <circle cx="57" cy="30" r="18" stroke="var(--text-primary)" strokeWidth="3" />
            <line x1="7" y1="30" x2="33" y2="30" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 23 A7 7 0 0 1 40 37" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="40" cy="30" r="5" fill="var(--text-primary)" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>CORTX</span>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>Create account</h1>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="app-input"
                style={{ fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="app-input"
                style={{ fontSize: 14 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Minimum 8 characters</p>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: 'var(--status-critical)', marginBottom: 16 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '9px 16px',
                background: loading ? 'var(--border-default)' : 'var(--text-primary)',
                color: 'var(--bg-page)', border: 'none', borderRadius: 6, fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating account…' : 'Get started'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
