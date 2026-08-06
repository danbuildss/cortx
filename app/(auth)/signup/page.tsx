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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Sign in instead.');
      } else {
        setError(error.message);
      }
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
          <svg width="48" height="35" viewBox="0 0 74 54" fill="none" aria-label="CORTX">
            <circle cx="20" cy="27" r="18" stroke="#f0f0f0" strokeWidth="3" />
            <circle cx="54" cy="27" r="18" stroke="#f0f0f0" strokeWidth="3" />
            <line x1="4" y1="27" x2="30" y2="27" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M37 20 A7 7 0 0 1 37 34" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="37" cy="27" r="5" fill="#f0f0f0" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', letterSpacing: '0.06em' }}>CORTX</span>
        </div>

        <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f0', marginBottom: 20 }}>Create account</h1>

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
                autoComplete="new-password"
                style={{
                  width: '100%', padding: '8px 12px', background: '#272727',
                  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 14,
                  color: '#f0f0f0', outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
              />
              <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Minimum 8 characters</p>
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
              {loading ? 'Creating account...' : 'Get started'}
            </button>
          </form>

          <p style={{ fontSize: 13, color: '#888', marginTop: 16, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#f0f0f0', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
