'use client';

import { useState } from 'react';
import type { Tier } from '@/lib/token';

const TIER_COLORS: Record<string, string> = {
  free:    'var(--text-muted)',
  tier1:   '#f59e0b',
  tier2:   '#10b981',
  tier3:   '#6366f1',
  tier4:   '#ec4899',
  Admin:   '#ef4444',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export function TokenSection({
  initialWallet,
  balance,
  tier,
  tierLabel,
  isAdmin,
  serviceCount,
  serviceLimit,
  syncedAt,
}: {
  initialWallet: string | null;
  balance: number;
  tier: Tier;
  tierLabel: string;
  isAdmin: boolean;
  serviceCount: number;
  serviceLimit: number | null;
  syncedAt: string | null;
}) {
  const [wallet, setWallet]     = useState(initialWallet ?? '');
  const [saving, setSaving]     = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [msg, setMsg]           = useState('');
  const [liveBalance, setLiveBalance] = useState(balance);
  const [liveTier, setLiveTier]       = useState(tierLabel);

  const limitLabel = serviceLimit === null || serviceLimit === Infinity
    ? 'Unlimited'
    : String(serviceLimit);
  const tierColor = TIER_COLORS[isAdmin ? 'Admin' : tier] ?? TIER_COLORS.free;

  async function saveWallet(e: React.FormEvent) {
    e.preventDefault();
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) {
      setMsg('Enter a valid 0x wallet address.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cortx_wallet_address: wallet.trim() }),
      });
      if (res.ok) {
        setMsg('Wallet saved.');
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg('Failed to save wallet.');
      }
    } catch {
      setMsg('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function syncBalance() {
    setSyncing(true);
    setMsg('');
    try {
      const res = await fetch('/api/token/sync', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setLiveBalance(json.balance ?? 0);
        setMsg(`Synced. Balance: ${fmt(json.balance ?? 0)} $CORTX`);
        setTimeout(() => setMsg(''), 4000);
      } else {
        setMsg(json.error ?? 'Sync failed.');
      }
    } catch {
      setMsg('Network error — try again.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          $CORTX Token
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Hold $CORTX on Base to unlock more monitored endpoints.{' '}
          <a
            href="https://app.uniswap.org/swap?outputCurrency=0x23ec691cf7f9a3166fa663c73f6f5a0c26a5aba3&chain=base"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
          >
            Buy $CORTX →
          </a>
        </div>
      </div>

      {/* Tier badge + usage */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        background: 'var(--bg-muted)', borderRadius: 6, padding: '12px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            color: tierColor, background: `${tierColor}18`,
            border: `1px solid ${tierColor}44`,
            borderRadius: 4, padding: '2px 8px',
          }}>
            {liveTier || tierLabel}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {fmt(liveBalance)} $CORTX
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {serviceCount} / {limitLabel} endpoints
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />

      {/* Wallet address */}
      <form onSubmit={saveWallet} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Base wallet address
          </label>
          <input
            className="app-input"
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
            The address holding your $CORTX on Base mainnet.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '7px 16px',
              background: saving ? 'var(--border-default)' : 'var(--text-primary)',
              color: 'var(--bg-page)', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save address'}
          </button>
          <button
            type="button"
            onClick={syncBalance}
            disabled={syncing || !wallet.trim()}
            style={{
              padding: '7px 16px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-mid)',
              borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: syncing || !wallet.trim() ? 'not-allowed' : 'pointer',
              opacity: !wallet.trim() ? 0.5 : 1,
            }}
          >
            {syncing ? 'Syncing…' : 'Sync balance'}
          </button>
          {msg && (
            <span style={{
              fontSize: 12,
              color: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('enter')
                ? 'var(--status-critical)'
                : 'var(--status-operational)',
            }}>
              {msg}
            </span>
          )}
        </div>
      </form>

      {syncedAt && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Last synced {new Date(syncedAt).toLocaleString()}
        </div>
      )}

      {/* Tier table */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 8 }}>
          Tier limits
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Free',          threshold: '—',     limit: 2 },
            { label: '500K $CORTX',   threshold: '500K',  limit: 5 },
            { label: '1M $CORTX',     threshold: '1M',    limit: 15 },
            { label: '5M $CORTX',     threshold: '5M',    limit: 50 },
            { label: '10M $CORTX',    threshold: '10M',   limit: null },
          ].map((row) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12, color: 'var(--text-secondary)',
              padding: '4px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span>{row.label}</span>
              <span style={{ fontWeight: 500 }}>
                {row.limit === null ? 'Unlimited endpoints' : `${row.limit} endpoint${row.limit !== 1 ? 's' : ''}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
