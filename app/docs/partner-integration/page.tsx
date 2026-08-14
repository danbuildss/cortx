'use client';

import Link from 'next/link';
import { useState } from 'react';

const SITE_URL = 'https://usecortx.dev';

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); })}
      style={{
        fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
        border: '1px solid var(--border-default)',
        background: done ? 'var(--status-operational-bg)' : 'var(--bg-elevated)',
        color: done ? 'var(--status-operational)' : 'var(--text-muted)',
        transition: 'all 0.15s', flexShrink: 0, fontWeight: 500,
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, fontWeight: 600 }}>
          {label}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
        borderRadius: 6, padding: '10px 12px',
      }}>
        <pre style={{
          flex: 1, margin: 0,
          fontSize: 12, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-geist-mono)', overflowX: 'auto',
          lineHeight: 1.65, whiteSpace: 'pre',
        }}>
          {code}
        </pre>
        <CopyBtn text={code} />
      </div>
    </div>
  );
}

export default function PartnerIntegrationPage() {
  const exampleServiceId = 'YOUR_SERVICE_ID';
  const badgeUrl  = `${SITE_URL}/api/badge/${exampleServiceId}`;
  const statusUrl = `${SITE_URL}/status/service/${exampleServiceId}`;
  const apiUrl    = `${SITE_URL}/api/v1/reliability/${exampleServiceId}`;
  const markdown  = `[![CORTX Monitored](${badgeUrl})](${statusUrl})`;
  const html      = `<a href="${statusUrl}">\n  <img src="${badgeUrl}" alt="CORTX Monitored">\n</a>`;

  const curlExample = `curl -s "${SITE_URL}/api/v1/reliability/${exampleServiceId}" \\
  -H "Accept: application/json"`;

  const responseExample = `{
  "service_id":              "abc123",
  "service_name":            "My API",
  "status":                  "operational",
  "window":                  "30d",
  "uptime_percent":          99.8,
  "paid_delivery_percent":   99.4,
  "schema_validity_percent": 100.0,
  "median_latency_ms":       4200,
  "last_verified_at":        "2026-08-14T10:00:00.000Z",
  "active_incident":         null
}`;

  const incidentExample = `{
  "active_incident": {
    "id":            "incident-uuid",
    "severity":      "critical",
    "failure_stage": "delivery",
    "opened_at":     "2026-08-14T08:30:00.000Z"
  }
}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 40px 100px' }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/docs" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Docs
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
            Partner Integration
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.2 }}>
            Embed CORTX in your product
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
            CORTX provides a public status badge, service status page, and JSON reliability API for every monitored service. Use these to show verification status on your README, website, or marketplace listing.
          </p>
        </div>

        {/* Your Service ID */}
        <div style={{ padding: '16px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, marginBottom: 48 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            Find your <strong style={{ color: 'var(--text-secondary)' }}>Service ID</strong> in Services → select your service → Share panel. It is a UUID that looks like <code style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, background: 'var(--bg-muted)', padding: '1px 5px', borderRadius: 3 }}>a1b2c3d4-…</code>
          </div>
        </div>

        {/* Section: Badge */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={h2Style}>Status Badge</h2>
          <p style={bodyStyle}>
            Add a live badge to your README or website. It updates every 5 minutes and shows the current status, 30-day uptime, and paid delivery rate.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <CodeBlock label="Markdown (README)" code={markdown} />
            <CodeBlock label="HTML" code={html} />
            <CodeBlock label="Badge image URL" code={badgeUrl} />
          </div>

          <div style={calloutStyle}>
            Replace <code style={inlineCode}>{exampleServiceId}</code> with your Service ID in all snippets above.
          </div>
        </section>

        {/* Section: Service Status Page */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={h2Style}>Service Status Page</h2>
          <p style={bodyStyle}>
            A public, no-login-required status page for a single service. Shows 30-day metrics, 90-day availability bar, active incident, and recent incident history. Safe to link from your docs or support site.
          </p>
          <CodeBlock label="URL" code={statusUrl} />
          <p style={{ ...bodyStyle, marginTop: 14 }}>
            Nothing private is exposed — no test payload, no expected schema, no wallet details, no owner email.
          </p>
        </section>

        {/* Section: Reliability API */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={h2Style}>Reliability API</h2>
          <p style={bodyStyle}>
            A public JSON endpoint returning 30-day reliability metrics. No authentication required. Cached for 5 minutes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            <CodeBlock label="Request" code={curlExample} />
            <CodeBlock label="Response — healthy service" code={responseExample} />
            <CodeBlock label="Response — active incident" code={incidentExample} />
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Field', 'Type', 'Description'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { field: 'service_id',              type: 'string',       desc: 'UUID of the service.' },
                  { field: 'service_name',             type: 'string',       desc: 'Display name of the service.' },
                  { field: 'status',                   type: 'string',       desc: 'Current status: operational | degraded | critical | unknown.' },
                  { field: 'window',                   type: '"30d"',        desc: 'Measurement window for all metrics.' },
                  { field: 'uptime_percent',           type: 'number | null', desc: 'Passed ÷ (passed + failed), 0–100 to one decimal. Null if no eligible checks.' },
                  { field: 'paid_delivery_percent',    type: 'number | null', desc: 'Checks where payment AND delivery both passed ÷ checks reaching both stages.' },
                  { field: 'schema_validity_percent',  type: 'number | null', desc: 'Checks passing schema_validation ÷ checks that reached that stage. Null if no schema configured.' },
                  { field: 'median_latency_ms',        type: 'number | null', desc: 'Median full round-trip latency in ms. Null if no data.' },
                  { field: 'last_verified_at',         type: 'string | null', desc: 'ISO 8601 timestamp of the most recent check.' },
                  { field: 'active_incident',          type: 'object | null', desc: 'Null if healthy. Object with id, severity, failure_stage, opened_at if incident is open.' },
                ].map((r, i) => (
                  <tr key={r.field} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <code style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.field}</code>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <code style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{r.type}</code>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={calloutStyle}>
            The API returns <code style={inlineCode}>404</code> for unknown or deleted service IDs. Use the <code style={inlineCode}>active_incident</code> field to drive alerting logic in your marketplace or dashboard.
          </div>
        </section>

        {/* Section: Use cases */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={h2Style}>Use Cases</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                title: 'Marketplace listing verification',
                desc:  'Poll the Reliability API to display live uptime and paid delivery metrics alongside a listed API service. Automatically flag services with active incidents or uptime below your threshold.',
              },
              {
                title: 'README badge',
                desc:  'Add the Markdown badge to your API\'s README. It updates every 5 minutes and links to the public service status page — giving potential integrators confidence before they buy.',
              },
              {
                title: 'Status widget embedding',
                desc:  'Embed the badge image in a landing page or documentation site. The SVG scales cleanly and adapts to light or dark backgrounds.',
              },
              {
                title: 'CI/CD gating',
                desc:  'Query the Reliability API in a deployment pipeline. Block a release if uptime_percent < 99 or active_incident is non-null, ensuring you only deploy when your upstream dependencies are healthy.',
              },
              {
                title: 'Incident routing',
                desc:  'Integrate with your incident management tool. When active_incident transitions from null to an object, open a ticket. When it returns to null, auto-resolve it.',
              },
            ].map(u => (
              <div key={u.title} style={{ padding: '16px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{u.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 24, borderTop: '1px solid var(--border-mid)' }}>
          <Link href="/methodology" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            Read the reliability methodology →
          </Link>
        </div>
      </div>
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  color: 'var(--text-primary)',
  marginBottom: 10,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary)',
  lineHeight: 1.75,
  marginBottom: 16,
};

const calloutStyle: React.CSSProperties = {
  marginTop: 14,
  padding: '12px 16px',
  background: 'rgba(59,130,246,0.06)',
  border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 7,
  fontSize: 13,
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
};

const inlineCode: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)',
  fontSize: 12,
  background: 'var(--bg-muted)',
  color: 'var(--text-secondary)',
  padding: '1px 5px',
  borderRadius: 3,
  border: '1px solid var(--border-default)',
};
