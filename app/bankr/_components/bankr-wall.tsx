'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export type MonitoredRow = {
  type: 'monitored';
  serviceId: string;
  name: string;
  endpointUrl: string;
  status: string;
  lastCheckedAt: string | null;
  delivery: number | null;
  uptime: number | null;
  latency: number | null;
};

export type UnmonitoredRow = {
  type: 'unmonitored';
  name: string;
  endpointUrl: string;
  description?: string;
  price?: number;
};

export type WallRow = MonitoredRow | UnmonitoredRow;

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e',
  degraded:    '#f59e0b',
  critical:    '#ef4444',
  unknown:     '#6b7280',
};
const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Critical',
  unknown:     'Unknown',
};

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function safeHref(url: string): string {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : '#';
  } catch {
    return '#';
  }
}

function CopyBadgeButton({ serviceId }: { serviceId: string }) {
  const [copied, setCopied] = useState(false);
  const markdown = `![CORTX Reliability](https://usecortx.dev/api/badge/${serviceId})`;

  function handleCopy() {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback: select text from a temp textarea
      const el = document.createElement('textarea');
      el.value = markdown;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        marginLeft: 8,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 4,
        border: '1px solid var(--border-default, #2a2d35)',
        background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated, #16181d)',
        color: copied ? '#22c55e' : 'var(--text-muted, #6b7280)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        verticalAlign: 'middle',
        fontFamily: 'inherit',
      }}
    >
      {copied ? 'Copied!' : 'Copy badge'}
    </button>
  );
}

const BANKR_SKILL_URL = 'https://x402.bankr.bot/0xb98f0de777eea8c481b64e33d3e0066cea38fa91/cortx-reliability';

export function BankrWall({ rows }: { rows: WallRow[] }) {
  const router = useRouter();

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 300_000);
    return () => clearInterval(id);
  }, [router]);

  if (rows.length === 0) {
    return (
      <div style={{
        border: '1px dashed var(--border-default, #2a2d35)',
        borderRadius: 10,
        padding: '48px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>No Bankr skills monitored yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
          Be the first Bankr builder to show buyers your delivery rate.
          Run the CORTX skill on Bankr to check your endpoint, then sign up for continuous monitoring.
        </div>
        <a
          href={BANKR_SKILL_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 20,
            fontSize: 13,
            fontWeight: 600,
            padding: '9px 18px',
            borderRadius: 6,
            background: '#22c55e',
            color: '#000',
            textDecoration: 'none',
          }}
        >
          Run CORTX skill on Bankr →
        </a>
      </div>
    );
  }

  const monitoredCount = rows.filter(r => r.type === 'monitored').length;
  const unmonitoredCount = rows.filter(r => r.type === 'unmonitored').length;

  return (
    <div>
      {(monitoredCount > 0 || unmonitoredCount > 0) && (
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted, #6b7280)', display: 'flex', gap: 16 }}>
          <span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginRight: 5, verticalAlign: 'middle' }} />
            {monitoredCount} monitored
          </span>
          {unmonitoredCount > 0 && (
            <span>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#6b7280', marginRight: 5, verticalAlign: 'middle' }} />
              {unmonitoredCount} unmonitored
            </span>
          )}
        </div>
      )}

      <div style={{ border: '1px solid var(--border-subtle, #16181d)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 110px 110px 90px 100px 90px',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-subtle, #16181d)',
          background: 'var(--bg-surface, #111214)',
        }}>
          {['Skill', 'Status', 'Delivery', 'Uptime', 'Latency', 'Last check'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted, #6b7280)' }}>{h}</span>
          ))}
        </div>

        {rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          const borderStyle = isLast ? 'none' : '1px solid var(--border-subtle, #16181d)';

          if (row.type === 'unmonitored') {
            return (
              <div
                key={row.endpointUrl}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px 110px 90px 100px 90px',
                  padding: '14px 20px',
                  borderBottom: borderStyle,
                  background: 'transparent',
                  opacity: 0.45,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{row.name}</div>
                  <a
                    href={safeHref(row.endpointUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', textDecoration: 'none', fontFamily: 'monospace' }}
                  >
                    {shortUrl(row.endpointUrl)}
                  </a>
                  <div style={{ marginTop: 6 }}>
                    <a
                      href="/"
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--border-default, #2a2d35)',
                        background: 'var(--bg-elevated, #16181d)',
                        color: 'var(--text-muted, #6b7280)',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        display: 'inline-block',
                      }}
                    >
                      Get monitored →
                    </a>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', fontStyle: 'italic' }}>unmonitored</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim, #4b5563)' }}>—</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim, #4b5563)' }}>—</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim, #4b5563)' }}>—</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim, #4b5563)' }}>—</div>
              </div>
            );
          }

          // Monitored row
          const color = STATUS_COLOR[row.status] ?? '#6b7280';
          const label = STATUS_LABEL[row.status] ?? 'Unknown';
          const badgeUrl = `https://usecortx.dev/api/badge/${row.serviceId}`;

          return (
            <div
              key={row.serviceId}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 110px 110px 90px 100px 90px',
                padding: '16px 20px',
                borderBottom: borderStyle,
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{row.name}</div>
                <a
                  href={safeHref(row.endpointUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', textDecoration: 'none', fontFamily: 'monospace' }}
                >
                  {shortUrl(row.endpointUrl)}
                </a>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 0 }}>
                  <img src={badgeUrl} alt="CORTX badge" style={{ height: 18, verticalAlign: 'middle' }} />
                  <CopyBadgeButton serviceId={row.serviceId} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color }}>{label}</span>
              </div>

              <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: row.delivery === null ? 'var(--text-muted, #6b7280)' : row.delivery >= 95 ? '#22c55e' : row.delivery >= 75 ? '#f59e0b' : '#ef4444' }}>
                {row.delivery === null ? '—' : `${row.delivery}%`}
              </div>

              <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary, #9ca3af)' }}>
                {row.uptime === null ? '—' : `${row.uptime}%`}
              </div>

              <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary, #9ca3af)' }}>
                {row.latency === null ? '—' : `${row.latency}ms`}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>
                {timeAgo(row.lastCheckedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
