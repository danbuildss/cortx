'use client';
import { useState } from 'react';

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        });
      }}
      style={{
        fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
        border: '1px solid var(--border-default)',
        background: done ? 'var(--status-operational-bg)' : 'var(--bg-elevated)',
        color: done ? 'var(--status-operational)' : 'var(--text-muted)',
        transition: 'all 0.15s', flexShrink: 0, fontWeight: 500,
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

function SnippetRow({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
        borderRadius: 6, padding: '7px 10px',
      }}>
        <code style={{
          flex: 1, fontSize: 11, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-geist-mono)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          {code}
        </code>
        <CopyBtn text={code} label="Copy" />
      </div>
    </div>
  );
}

export function SharePanel({ serviceId, userId }: { serviceId: string; userId: string }) {
  const siteUrl = 'https://usecortx.dev';
  const badgeUrl  = `${siteUrl}/api/badge/${serviceId}`;
  const statusUrl = `${siteUrl}/status/${userId}`;
  const markdown  = `[![CORTX Monitored](${badgeUrl})](${statusUrl})`;
  const html      = `<a href="${statusUrl}"><img src="${badgeUrl}" alt="CORTX Monitored"></a>`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Status page */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Public status page
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
          borderRadius: 6, padding: '8px 12px',
        }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {statusUrl}
          </span>
          <CopyBtn text={statusUrl} label="Copy" />
          <a
            href={statusUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11, padding: '3px 9px', borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              textDecoration: 'none', fontWeight: 500, flexShrink: 0,
            }}
          >
            Open ↗
          </a>
        </div>
      </div>

      {/* Badge */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          CORTX Monitored badge
        </div>

        {/* Live preview */}
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
          borderRadius: 6, padding: '12px 14px', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt="CORTX Monitored badge" style={{ display: 'block', height: 28, maxWidth: '100%' }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Live — updates every 5 minutes</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SnippetRow label="Markdown (README)" code={markdown} />
          <SnippetRow label="HTML" code={html} />
          <SnippetRow label="Badge URL" code={badgeUrl} />
        </div>
      </div>
    </div>
  );
}
