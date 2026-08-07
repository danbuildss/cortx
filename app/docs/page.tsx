'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const NAV: { group: string; items: { id?: string; href?: string; label: string }[] }[] = [
  {
    group: 'Get Started',
    items: [
      { id: 'overview',   label: 'Overview' },
      { id: 'quickstart', label: 'Quickstart' },
    ],
  },
  {
    group: 'Concepts',
    items: [
      { id: 'how-it-works', label: 'How CORTX Works' },
      { id: 'incidents',    label: 'Incidents' },
    ],
  },
  {
    group: 'Guides',
    items: [
      { id: 'configure', label: 'Configure a Service' },
      { id: 'alerts',    label: 'Telegram Alerts' },
    ],
  },
  {
    group: 'Reference',
    items: [
      { id: 'spend-caps',  label: 'Spend Caps' },
      { href: '/docs/cost', label: 'Cost Guide' },
      { id: 'faq',         label: 'FAQ' },
    ],
  },
];

const ALL_IDS = NAV.flatMap(g => g.items.map(i => i.id).filter(Boolean)) as string[];

const STAGES = [
  { key: 'availability',    label: 'Availability',    desc: 'Checks that the endpoint is reachable over HTTP.' },
  { key: 'payment_terms',   label: 'Payment Terms',   desc: 'Validates the 402 response and parses the X-Payment-Required header.' },
  { key: 'price_check',     label: 'Price Check',     desc: 'Confirms the requested price is within your expected and max bounds.' },
  { key: 'payment',         label: 'Payment',         desc: 'Signs an EIP-3009 transferWithAuthorization via x402/client and builds the X-Payment header.' },
  { key: 'delivery',        label: 'Delivery',        desc: 'Resends the request with the payment header and expects a 200 response.' },
  { key: 'json_parse',      label: 'JSON Parse',      desc: 'Parses the response body as valid JSON.' },
  { key: 'schema_validation', label: 'Schema',        desc: 'Validates the parsed JSON against your expected schema using AJV.' },
];

const FIELDS = [
  { field: 'Endpoint URL',       required: true,  eg: 'https://x402.bankr.bot/research', desc: 'The x402-protected URL CORTX will probe.' },
  { field: 'Expected Price',     required: true,  eg: '0.01',                            desc: 'The USDC price you expect the endpoint to charge. Alerts if it changes.' },
  { field: 'Max Price',          required: true,  eg: '0.05',                            desc: 'The ceiling CORTX will pay per check. Checks fail at price_check if exceeded.' },
  { field: 'Check Interval',     required: true,  eg: '5',                               desc: 'Minutes between synthetic checks (minimum 1, recommended 5).' },
  { field: 'Environment',        required: true,  eg: 'mainnet',                         desc: 'mainnet uses real USDC on Base. Testnet support coming.' },
  { field: 'Expected Schema',    required: false, eg: '{ "type": "object", … }',         desc: 'AJV-compatible JSON Schema. Leave blank to skip schema_validation.' },
];

const FAQ = [
  {
    q: 'Does CORTX spend real money on every check?',
    a: 'Yes — each check that reaches the payment stage signs a real USDC transfer on Base mainnet. Set your check interval and max price carefully. Spend caps (daily and monthly) prevent runaway costs.',
  },
  {
    q: 'What are the default spend caps?',
    a: 'Daily cap: $1.00 USDC. Monthly cap: $10.00 USDC. Checks are skipped when a cap is reached and resume after it resets (UTC midnight for daily, 1st of month for monthly). Override with CORTX_DAILY_SPEND_CAP_USDC and CORTX_MONTHLY_SPEND_CAP_USDC env vars.',
  },
  {
    q: 'What private key does CORTX use?',
    a: 'CORTX uses a dedicated test wallet funded with a small amount of USDC — just enough for synthetic checks. Set the 0x-prefixed 32-byte key in CORTX_TEST_WALLET_KEY. Never use a wallet that holds significant funds.',
  },
  {
    q: 'What is the difference between "failed" and "error" status?',
    a: '"failed" means a check stage returned a bad result — your endpoint has a problem. "error" means CORTX itself had an infrastructure issue (network timeout, RPC error). Only "failed" statuses open incidents.',
  },
  {
    q: 'How many consecutive failures open an incident?',
    a: '2. A single transient failure is silently recorded but does not page you. Two back-to-back failures at the same stage open an incident.',
  },
  {
    q: 'Can I share my status page publicly?',
    a: 'Yes. Every CORTX account has a public status page at /status/[your-user-id] — no login required. It shows 90-day uptime bars per service and any active incidents.',
  },
  {
    q: 'Does schema validation always run?',
    a: 'Only if you provide an Expected Schema when configuring your service. If left blank, stage 7 is skipped and the check passes after a successful JSON parse.',
  },
  {
    q: 'What chains and tokens does CORTX support?',
    a: 'Base mainnet only, USDC (ERC-20 at 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913). This is the standard for x402 on Bankr.',
  },
  {
    q: 'Can I monitor endpoints on other chains?',
    a: 'Not yet. Multi-chain support (Ethereum, Arbitrum, Optimism) is on the roadmap.',
  },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    ALL_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>

      {/* ── Mobile top bar ── */}
      <div style={{ display: 'none', position: 'sticky', top: 0, zIndex: 50, height: 48, alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }} className="docs-mobile-bar">
        <Link href="/" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--text-primary)', textDecoration: 'none' }}>
          CORTX <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>docs</span>
        </Link>
        <button onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, fontSize: 18, lineHeight: 1 }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 48, left: 0, right: 0, bottom: 0, zIndex: 40, background: 'var(--bg-surface)', padding: 20, overflowY: 'auto' }} className="docs-mobile-drawer">
          <NavContent activeId={activeId} scrollTo={scrollTo} />
        </div>
      )}

      <div style={{ display: 'flex', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Sidebar ── */}
        <aside style={{ width: 220, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', padding: '40px 0 40px 24px', borderRight: '1px solid var(--border-subtle)' }} className="docs-sidebar">
          <Link href="/" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--text-primary)', textDecoration: 'none', display: 'block', marginBottom: 32 }}>
            CORTX <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>docs</span>
          </Link>
          <NavContent activeId={activeId} scrollTo={scrollTo} />
        </aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, minWidth: 0, padding: '40px 48px 120px', maxWidth: 720 }} className="docs-main">

          {/* Overview */}
          <section id="overview" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Overview</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.2 }}>
              x402 Reliability Monitoring
            </h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 16 }}>
              CORTX runs a full synthetic payment through your x402 endpoint every few minutes — not just a ping, but a real end-to-end payment flow. It records evidence at every stage, opens incidents on consecutive failures, and sends Telegram alerts.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 32 }}>
              Built for Bankr builders who need to know if their paid API is actually working end-to-end, not just &ldquo;up.&rdquo;
            </p>

            <h2 style={h2Style}>The 7-Stage Pipeline</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20, fontSize: 14 }}>
              Each check runs all 7 stages in sequence. A stage failure stops the check and records which stage failed and why.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {STAGES.map((s, i) => (
                <div key={s.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 14px', background: s.key === 'payment' ? 'rgba(167,139,250,0.06)' : 'var(--bg-surface)', borderRadius: 6, border: `1px solid ${s.key === 'payment' ? 'rgba(167,139,250,0.2)' : 'var(--border-subtle)'}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.key === 'payment' ? '#a78bfa' : 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)', minWidth: 20, paddingTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: s.key === 'payment' ? '#a78bfa' : 'var(--text-primary)', marginBottom: 2, fontFamily: 'var(--font-geist-mono)' }}>{s.key}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quickstart */}
          <section id="quickstart" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Get Started</p>
            <h2 style={h1Style}>Quickstart</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 32 }}>
              From sign-up to your first live check in under 5 minutes.
            </p>
            {[
              { n: 1, title: 'Sign up', body: 'Go to your CORTX invite link and create an account with your email.' },
              { n: 2, title: 'Add a service', body: 'Click "Add Service" from the Overview page and paste your x402 endpoint URL.' },
              { n: 3, title: 'Auto-detect', body: 'CORTX probes the endpoint, reads the X-Payment-Required header, and pre-fills expected price, max price, and network.' },
              { n: 4, title: 'Review & configure', body: 'Confirm the detected values, set your check interval, and optionally paste an expected JSON Schema.' },
              { n: 5, title: 'Run first check', body: 'Hit "Run Check" to execute the full 7-stage pipeline immediately and see the result.' },
              { n: 6, title: 'Go live', body: 'Your service is now monitored. Checks run on your configured interval via cron. Set up Telegram alerts in Settings → Alerts.' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-muted)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>{step.n}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{step.body}</div>
                </div>
              </div>
            ))}
          </section>

          {/* How It Works */}
          <section id="how-it-works" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Concepts</p>
            <h2 style={h1Style}>How CORTX Works</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 32 }}>
              Every check is a full synthetic payment — not a health ping. Here is what happens at each stage.
            </p>
            {STAGES.map((s, i) => (
              <div key={s.key} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)', fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</span>
                  <code style={codeInlineStyle}>{s.key}</code>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, paddingLeft: 28 }}>
                  {STAGE_DETAIL[s.key]}
                </p>
              </div>
            ))}

            <div style={calloutStyle('info')}>
              <strong>Failure severity</strong> — Stages 1–3 produce a <span style={{ color: 'var(--status-degraded)' }}>degraded</span> incident. Stages 4–7 (payment through schema) produce a <span style={{ color: 'var(--status-critical)' }}>critical</span> incident.
            </div>
          </section>

          {/* Incidents */}
          <section id="incidents" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Concepts</p>
            <h2 style={h1Style}>Incidents</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 24 }}>
              CORTX automatically manages an incident lifecycle based on consecutive check results.
            </p>

            <h3 style={h3Style}>Opening</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 24 }}>
              An incident opens after <strong style={{ color: 'var(--text-primary)' }}>2 consecutive failed checks</strong> at the same stage. A single transient failure is recorded but does not page you. This reduces noise from momentary network issues.
            </p>

            <h3 style={h3Style}>Severity</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Degraded', color: 'var(--status-degraded)', bg: 'var(--status-degraded-bg)', stages: 'Stages 1–3: availability, payment_terms, price_check' },
                { label: 'Critical', color: 'var(--status-critical)', bg: 'var(--status-critical-bg)', stages: 'Stages 4–7: payment, delivery, json_parse, schema_validation' },
              ].map(s => (
                <div key={s.label} style={{ padding: '14px 16px', borderRadius: 8, background: s.bg, border: `1px solid ${s.color}33` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.color, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.stages}</div>
                </div>
              ))}
            </div>

            <h3 style={h3Style}>Lifecycle</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
              {[
                { event: 'opened',            dot: 'var(--status-critical)', desc: 'Second consecutive failure. Telegram alert sent.' },
                { event: 'severity_increased', dot: 'var(--status-degraded)', desc: 'Incident escalated from degraded → critical. Second alert sent.' },
                { event: 'resolved',           dot: 'var(--status-operational)', desc: 'Next check passes. Incident closed, third alert sent.' },
              ].map(e => (
                <div key={e.event} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.dot, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <code style={{ ...codeInlineStyle, marginRight: 8 }}>{e.event}</code>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={calloutStyle('warn')}>
              <strong>infra errors ≠ incidents</strong> — Checks with status <code style={codeInlineStyle}>error</code> (RPC failures, network timeouts) never open incidents. Only <code style={codeInlineStyle}>failed</code> checks count toward the consecutive failure threshold.
            </div>
          </section>

          {/* Configure a Service */}
          <section id="configure" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Guides</p>
            <h2 style={h1Style}>Configure a Service</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 28 }}>
              Use the 3-step onboarding wizard (Services → Add Service) or edit an existing service.
            </p>

            <div style={{ overflowX: 'auto', marginBottom: 32 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Field', 'Required', 'Example', 'Description'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f, i) => (
                    <tr key={f.field} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{f.field}</td>
                      <td style={{ padding: '10px 12px', color: f.required ? 'var(--status-critical)' : 'var(--text-muted)', fontSize: 12 }}>{f.required ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{f.eg}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={h3Style}>JSON Schema Example</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 12 }}>
              If your endpoint returns structured JSON, paste an AJV-compatible schema. CORTX will validate every response against it.
            </p>
            <pre style={preStyle}>{JSON.stringify({
  type: 'object',
  required: ['result', 'timestamp'],
  properties: {
    result: { type: 'string' },
    timestamp: { type: 'number' },
    data: { type: 'object' },
  },
}, null, 2)}</pre>
          </section>

          {/* Telegram Alerts */}
          <section id="alerts" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Guides</p>
            <h2 style={h1Style}>Telegram Alerts</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 24 }}>
              CORTX can send Telegram messages when incidents open, escalate, or resolve.
            </p>

            <h3 style={h3Style}>Connect your account</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
              {[
                'Go to Settings → Alerts.',
                'Click "Connect Telegram" — a deep-link token is generated (expires in 10 minutes).',
                'Open the link in Telegram. The bot sends a confirmation message.',
                'Your Telegram account is now linked to CORTX.',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 6, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, minWidth: 20, paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                  {step}
                </div>
              ))}
            </div>

            <h3 style={h3Style}>Alert events</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
              {[
                { event: 'on_open',               label: 'Incident opened',    desc: 'Fires when a new incident opens (2nd consecutive failure).' },
                { event: 'on_severity_increase',  label: 'Severity escalated', desc: 'Fires when an open incident goes from degraded → critical.' },
                { event: 'on_resolve',             label: 'Incident resolved',  desc: 'Fires when the incident closes after a passing check.' },
              ].map(e => (
                <div key={e.event} style={{ display: 'flex', gap: 14, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 6 }}>
                  <code style={{ ...codeInlineStyle, fontSize: 11, whiteSpace: 'nowrap' }}>{e.event}</code>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{e.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Each event can be toggled independently per service in Settings → Alerts.
            </p>
          </section>

          {/* Spend Caps */}
          <section id="spend-caps" style={{ marginBottom: 80, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Reference</p>
            <h2 style={h1Style}>Spend Caps</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 24 }}>
              CORTX enforces cumulative spend limits to prevent runaway costs across all services.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Daily cap', default: '$1.00 USDC', env: 'CORTX_DAILY_SPEND_CAP_USDC', reset: 'Resets at UTC midnight.' },
                { label: 'Monthly cap', default: '$10.00 USDC', env: 'CORTX_MONTHLY_SPEND_CAP_USDC', reset: 'Resets on the 1st of each month (UTC).' },
              ].map(c => (
                <div key={c.label} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.02em' }}>{c.default}</div>
                  <code style={{ ...codeInlineStyle, display: 'block', marginBottom: 6 }}>{c.env}</code>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.reset}</div>
                </div>
              ))}
            </div>

            <div style={calloutStyle('warn')}>
              When a cap is reached, checks are <strong>skipped silently</strong> — no incident is opened. Checks resume automatically after the cap resets. Monitor your spend in the Admin dashboard.
            </div>

            <h3 style={{ ...h3Style, marginTop: 32 }}>Planning your spend</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Price / call', 'Interval', 'Daily cost', 'Monthly cost'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { price: '$0.01', interval: '5 min',  daily: '$2.88',  monthly: '$86.40' },
                    { price: '$0.01', interval: '15 min', daily: '$0.96',  monthly: '$28.80' },
                    { price: '$0.05', interval: '5 min',  daily: '$14.40', monthly: '$432' },
                    { price: '$0.05', interval: '15 min', daily: '$4.80',  monthly: '$144' },
                    { price: '$5.00', interval: '60 min', daily: '$120',   monthly: '$3,600' },
                  ].map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{r.price}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.interval}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: parseFloat(r.daily.replace(/[$,]/g,'')) > 10 ? 'var(--status-critical)' : parseFloat(r.daily.replace(/[$,]/g,'')) > 2 ? 'var(--status-degraded)' : 'var(--status-operational)' }}>{r.daily}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: parseFloat(r.monthly.replace(/[$,]/g,'')) > 100 ? 'var(--status-critical)' : parseFloat(r.monthly.replace(/[$,]/g,'')) > 30 ? 'var(--status-degraded)' : 'var(--status-operational)' }}>{r.monthly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" style={{ marginBottom: 40, scrollMarginTop: 32 }}>
            <p style={eyebrowStyle}>Reference</p>
            <h2 style={h1Style}>FAQ</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {FAQ.map((item, i) => (
                <div key={i} style={{ padding: '20px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.4 }}>{item.q}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Cost guide callout */}
          <section style={{ marginBottom: 80 }}>
            <Link
              href="/docs/cost"
              style={{
                display: 'block',
                padding: '24px 28px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                textDecoration: 'none',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Guide</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
                    Understanding CORTX costs
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Per-stage breakdown, spend caps, cost matrix, and planning calculators.
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 18 }}>→</div>
              </div>
            </Link>
          </section>

        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .docs-sidebar { display: none !important; }
          .docs-mobile-bar { display: flex !important; }
          .docs-main { padding: 24px 20px 80px !important; }
        }
      `}</style>
    </div>
  );
}

function NavContent({ activeId, scrollTo }: { activeId: string; scrollTo: (id: string) => void }) {
  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: isActive ? 500 : 400,
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: isActive ? 'var(--bg-hover)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    marginBottom: 2,
    transition: 'background 0.1s, color 0.1s',
    textDecoration: 'none',
  });

  return (
    <nav>
      {NAV.map(group => (
        <div key={group.group} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6, padding: '0 12px' }}>
            {group.group}
          </div>
          {group.items.map(item =>
            item.href ? (
              <Link key={item.href} href={item.href} style={linkStyle(false)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id!)}
                style={linkStyle(activeId === item.id)}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      ))}
    </nav>
  );
}

const STAGE_DETAIL: Record<string, string> = {
  availability:
    'CORTX sends an HTTP GET to your endpoint URL. If the server is unreachable or returns a non-2xx/402 response, the check fails here. A 402 is the expected response at this stage — it means the endpoint is alive and asking for payment.',
  payment_terms:
    'CORTX reads the X-Payment-Required response header from the 402. It parses the JSON payment terms: network, asset, amount, recipient address, and EIP-712 domain info. If the header is missing, malformed, or unsigned, the check fails here.',
  price_check:
    'The parsed price is compared against your configured Expected Price and Max Price. If the endpoint is charging more than your max, the check fails to protect your wallet. If the price differs from expected, the incident notes the discrepancy.',
  payment:
    'CORTX uses the x402/client npm package to sign an EIP-3009 transferWithAuthorization — a gasless USDC transfer on Base. The private key in CORTX_TEST_WALLET_KEY signs the EIP-712 message. The resulting signature is encoded into an X-Payment header.',
  delivery:
    'The original request is re-sent with the X-Payment header attached. CORTX expects a 200 response. Any other status code — including another 402 — causes a critical failure at this stage, since payment was sent but delivery was not received.',
  json_parse:
    'The response body (capped at 1 MB) is parsed as JSON. If the body is not valid JSON, the check fails. This stage runs regardless of whether you have a schema configured.',
  schema_validation:
    'If you provided an Expected Schema, AJV validates the parsed JSON against it. Any schema violation — missing required field, wrong type, additional property when not allowed — fails the check. This stage is skipped when no schema is configured.',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 8,
};

const h1Style: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: 'var(--text-primary)',
  marginBottom: 16,
  lineHeight: 1.2,
};

const h2Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 12,
  marginTop: 32,
};

const h3Style: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 12,
};

const codeInlineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)',
  fontSize: 12,
  background: 'var(--bg-muted)',
  color: 'var(--text-secondary)',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
};

const preStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)',
  fontSize: 12,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '16px 20px',
  overflowX: 'auto',
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
};

function calloutStyle(type: 'info' | 'warn'): React.CSSProperties {
  return {
    padding: '14px 16px',
    borderRadius: 8,
    background: type === 'warn' ? 'var(--status-degraded-bg)' : 'rgba(59,130,246,0.06)',
    border: `1px solid ${type === 'warn' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.2)'}`,
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    marginTop: 8,
  };
}
