'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function NewServicePage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { error: insertError } = await supabase.from('services').insert({
      user_id: user.id,
      name: name.trim(),
      endpoint_url: endpointUrl.trim(),
      expected_price: expectedPrice ? parseFloat(expectedPrice) : null,
      max_price: maxPrice ? parseFloat(maxPrice) : null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push('/overview');
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px', background: '#272727',
    border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 14,
    color: '#f0f0f0', outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/overview" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>← Overview</Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', marginBottom: 24 }}>Add service</h1>

      <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="My x402 API"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
              onBlur={e => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
            />
          </Field>

          <Field label="Endpoint URL">
            <input
              type="url"
              value={endpointUrl}
              onChange={e => setEndpointUrl(e.target.value)}
              required
              placeholder="https://api.example.com/endpoint"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
              onBlur={e => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Expected price (USDC)" hint="Optional">
              <input
                type="number"
                value={expectedPrice}
                onChange={e => setExpectedPrice(e.target.value)}
                placeholder="0.001"
                step="any"
                min="0"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
                onBlur={e => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
              />
            </Field>

            <Field label="Max price (USDC)" hint="Optional">
              <input
                type="number"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                placeholder="0.01"
                step="any"
                min="0"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
                onBlur={e => { e.currentTarget.style.border = '1px solid #2a2a2a'; }}
              />
            </Field>
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, padding: '9px 16px', background: loading ? '#333' : '#fff',
                color: '#000', border: 'none', borderRadius: 6, fontSize: 13,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Adding...' : 'Add service'}
            </button>
            <Link
              href="/overview"
              style={{
                padding: '9px 16px', background: 'transparent', color: '#888',
                border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 13,
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: '#555' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
