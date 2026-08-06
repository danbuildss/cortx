'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/overview');
      router.refresh();
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <svg width="48" height="36" viewBox="0 0 80 60" fill="none" aria-label="CORTX">
            <circle cx="23" cy="30" r="18" stroke="#f0f0f0" strokeWidth="3" />
            <circle cx="57" cy="30" r="18" stroke="#f0f0f0" strokeWidth="3" />
            <line x1="7" y1="30" x2="33" y2="30" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 23 A7 7 0 0 1 40 37" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="40" cy="30" r="5" fill="#f0f0f0" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', letterSpacing: '0.06em' }}>CORTX</span>
        </div>

        <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f0', marginBottom: 20 }}>Sign in</h1>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%', padding: '8px 12px', background: '#272727',
                  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 14,
                  color: '#f0f0f0', outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '8px 12px', background: '#272727',
                  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 14,
                  color: '#f0f0f0', outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '9px 16px', background: loading ? '#333' : '#fff',
                color: '#000', border: 'none', borderRadius: 6, fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: '#888', marginTop: 16, textAlign: 'center' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: '#f0f0f0', textDecoration: 'none' }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
