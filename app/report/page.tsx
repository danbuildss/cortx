'use client';
import { useState } from 'react';

type StageResult = {
  stage: string;
  passed: boolean | null;
  duration_ms: number | null;
  error?: string;
  evidence?: Record<string, unknown>;
};

type ReportResult = {
  id: string;
  status: 'passed' | 'failed' | 'error';
  failure_stage: string | null;
  latency_ms: number | null;
  observed_price: string | null;
  stages: StageResult[];
  email_sent: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  availability:       'Availability',
  payment_terms:      'Payment terms',
  price_check:        'Price check',
  payment:            'Payment (EIP-3009)',
  delivery:           'Delivery',
  json_parse:         'JSON parse',
  schema_validation:  'Schema validation',
};

export default function ReportPage() {
  const [url, setUrl]       = useState('');
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch('/api/reliability-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url: url.trim(), email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setResult(data as ReportResult);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const statusColor = result?.status === 'passed' ? 'var(--status-operational)'
    : result?.status === 'failed' ? 'var(--status-critical)'
    : 'var(--status-degraded)';

  const statusLabel = result?.status === 'passed' ? 'All stages passed'
    : result?.status === 'failed' ? `Failed at ${result.failure_stage}`
    : 'Error';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <a href="/" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)', textDecoration: 'none' }}>
            CORTX
          </a>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.2 }}>
          Free x402 reliability check
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 40 }}>
          Paste your x402 endpoint URL. We&apos;ll run a real end-to-end check — availability,
          payment terms, an actual EIP-3009 USDC payment on Base mainnet, delivery, and JSON validity —
          and email you the full stage-by-stage report. No signup required.
        </p>

        {/* Form */}
        {!result && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                x402 endpoint URL
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://api.example.com/data"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'var(--font-geist-mono)',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--status-critical)',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'var(--bg-elevated)' : '#2563eb',
                color: loading ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Running check — this takes up to 60 seconds…' : 'Run free reliability check'}
            </button>

            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, textAlign: 'center' }}>
              A real USDC payment (up to $0.10) is made to your endpoint on Base mainnet.
              Limit: 1 check per URL per 24 hours.
            </p>
          </form>
        )}

        {/* Result */}
        {result && (
          <div>
            {/* Overall status */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-mid)',
              borderRadius: 8,
              padding: '20px 20px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)', wordBreak: 'break-all', marginBottom: 14 }}>
                {url}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {result.latency_ms != null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Total latency</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>{result.latency_ms}ms</div>
                  </div>
                )}
                {result.observed_price != null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Price observed</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>
                      ${parseFloat(result.observed_price).toFixed(4)} USDC
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stage breakdown */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-mid)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 24,
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stage breakdown</span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {result.stages.map((s) => {
                  const color = s.passed === true ? 'var(--status-operational)'
                    : s.passed === false ? 'var(--status-critical)'
                    : 'var(--text-dim)';
                  const icon = s.passed === true ? '✓' : s.passed === false ? '✗' : '·';
                  return (
                    <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px' }}>
                      <span style={{ fontSize: 12, color, fontWeight: 600, width: 14, flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)', flex: 1 }}>
                        {STAGE_LABELS[s.stage] ?? s.stage}
                      </span>
                      {s.error && (
                        <span style={{ fontSize: 11, color: 'var(--status-critical)', maxWidth: 200, textAlign: 'right' }}>{s.error}</span>
                      )}
                      {s.duration_ms != null && (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)', marginLeft: 'auto', flexShrink: 0 }}>{s.duration_ms}ms</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Email notice */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '12px 16px',
              fontSize: 13,
              color: 'var(--text-muted)',
              marginBottom: 24,
            }}>
              {result.email_sent
                ? `Full report sent to ${email}.`
                : `Results shown above. (Email delivery not configured in this environment.)`}
            </div>

            {/* CTA */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '20px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Monitor this endpoint continuously
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Get alerted the moment a stage fails — before your users encounter a broken payment.
                Every check is a real USDC transaction on Base mainnet.
              </div>
              <a
                href="/signup"
                style={{
                  display: 'inline-block',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '10px 20px',
                  borderRadius: 6,
                  textDecoration: 'none',
                }}
              >
                Create free account →
              </a>
            </div>

            {/* Run another */}
            <button
              onClick={() => { setResult(null); setError(null); }}
              style={{
                background: 'none',
                border: '1px solid var(--border-mid)',
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 13,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Check another endpoint
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
