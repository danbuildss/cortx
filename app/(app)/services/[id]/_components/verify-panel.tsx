'use client';

import { useState } from 'react';

interface VerifyPanelProps {
  serviceId: string;
  initialStatus: string;
  initialToken: string | null;
  verifiedAt: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VerifyPanel({ serviceId, initialStatus, initialToken, verifiedAt }: VerifyPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [token, setToken] = useState(initialToken ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (status === 'verified') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--status-operational)', fontWeight: 500 }}>✓ Verified</span>
        {verifiedAt && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>since {formatDate(verifiedAt)}</span>
        )}
      </div>
    );
  }

  async function handleInit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/services/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, action: 'init' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to generate token'); return; }
      setToken(data.token);
      setStatus('pending');
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/services/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, action: 'confirm' }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setError(data.error ?? 'Verification failed — token not found.');
        return;
      }
      setStatus('verified');
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      {!token ? (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
            Verify you own this endpoint to show a <strong style={{ color: 'var(--text-primary)' }}>✓ Verified</strong> badge in the registry and on your status page.
          </p>
          <button
            onClick={handleInit}
            disabled={loading}
            style={{
              padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {loading ? 'Generating…' : 'Generate verification token'}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Add this token to your endpoint response, then click <strong style={{ color: 'var(--text-primary)' }}>Verify</strong>.
          </p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Option A — response header
            </div>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6,
              padding: '10px 14px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <span style={{ wordBreak: 'break-all' }}>X-CORTX-Verify: {token}</span>
              <button onClick={copyToken} style={{
                padding: '3px 10px', background: 'transparent', border: '1px solid var(--border-default)',
                borderRadius: 4, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
              }}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Option B — include in response body
            </div>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6,
              padding: '10px 14px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)',
            }}>
              {`{ "cortx_verify": "${token}", ... }`}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '7px 14px', background: 'var(--text-primary)', color: 'var(--bg-page)',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Checking endpoint…' : 'Verify ownership'}
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: 'var(--status-critical)', marginTop: 12 }}>{error}</p>
      )}
    </div>
  );
}
