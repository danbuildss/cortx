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
  const [environment, setEnvironment] = useState<'mainnet' | 'testnet'>('mainnet');
  const [testInput, setTestInput] = useState('{}');
  const [expectedSchema, setExpectedSchema] = useState('{"type":"object"}');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [latencyThreshold, setLatencyThreshold] = useState('5000');
  const [checkInterval, setCheckInterval] = useState('5');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    let parsedTestInput: Record<string, unknown>;
    let parsedExpectedSchema: Record<string, unknown>;
    try {
      parsedTestInput = JSON.parse(testInput);
    } catch {
      setError('Test payload is not valid JSON');
      setLoading(false);
      return;
    }
    try {
      parsedExpectedSchema = JSON.parse(expectedSchema);
    } catch {
      setError('Expected schema is not valid JSON');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { error: insertError } = await supabase
      .from('services')
      .insert({
        user_id: user.id,
        name: name.trim(),
        endpoint_url: endpointUrl.trim(),
        environment,
        test_input: parsedTestInput,
        expected_schema: parsedExpectedSchema,
        expected_price: parseFloat(expectedPrice),
        max_price: parseFloat(maxPrice),
        latency_threshold_ms: parseInt(latencyThreshold, 10),
        check_interval_minutes: parseInt(checkInterval, 10),
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/overview');
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/overview" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Overview</Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>Add service</h1>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <form onSubmit={handleSubmit}>

          <Field label="Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="My x402 API" className="app-input" />
          </Field>

          <Field label="Endpoint URL">
            <input type="url" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} required
              placeholder="https://api.example.com/v1/resource" className="app-input" />
          </Field>

          <Field label="Network">
            <select value={environment} onChange={e => setEnvironment(e.target.value as 'mainnet' | 'testnet')}
              className="app-input" style={{ appearance: 'none' }}>
              <option value="mainnet">Base Mainnet</option>
              <option value="testnet">Base Sepolia (Testnet)</option>
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Expected price (USDC)">
              <input type="number" value={expectedPrice} onChange={e => setExpectedPrice(e.target.value)}
                required placeholder="0.001" step="any" min="0.000001" className="app-input" />
            </Field>
            <Field label="Max price (USDC)">
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                required placeholder="0.01" step="any" min="0.000001" className="app-input" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Latency threshold (ms)">
              <input type="number" value={latencyThreshold} onChange={e => setLatencyThreshold(e.target.value)}
                required min="100" step="100" className="app-input" />
            </Field>
            <Field label="Check interval (minutes)">
              <input type="number" value={checkInterval} onChange={e => setCheckInterval(e.target.value)}
                required min="1" step="1" className="app-input" />
            </Field>
          </div>

          <Field label="Test request payload" hint="JSON sent with each check">
            <textarea value={testInput} onChange={e => setTestInput(e.target.value)}
              rows={3} className="app-input"
              style={{ resize: 'vertical', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }} />
          </Field>

          <Field label="Expected response schema" hint="JSON Schema (Draft-07)">
            <textarea value={expectedSchema} onChange={e => setExpectedSchema(e.target.value)}
              rows={4} className="app-input"
              style={{ resize: 'vertical', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }} />
          </Field>

          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Telegram alerts are configured globally in{' '}
              <Link href="/settings/alerts" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Alert settings</Link>.
            </p>
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--status-critical)', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={loading}
              style={{
                flex: 1, padding: '9px 16px',
                background: loading ? 'var(--border-default)' : 'var(--text-primary)',
                color: 'var(--bg-page)', border: 'none', borderRadius: 6, fontSize: 13,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading ? 'Adding...' : 'Add service'}
            </button>
            <Link href="/overview" style={{
              padding: '9px 16px', background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13,
              textDecoration: 'none', textAlign: 'center',
            }}>Cancel</Link>
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
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
