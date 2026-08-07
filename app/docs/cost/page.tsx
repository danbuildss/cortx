'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const NAV_GROUPS = [
  {
    group: 'Cost Guide',
    items: [
      { id: 'overview',   label: 'Overview' },
      { id: 'pipeline',   label: 'What Costs Money' },
      { id: 'matrix',     label: 'Cost Matrix' },
      { id: 'spend-caps', label: 'Spend Caps' },
      { id: 'planning',   label: 'Wallet Planning' },
      { id: 'practices',  label: 'Best Practices' },
    ],
  },
];

const ALL_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));

const COST_ROWS = [
  { price: '$0.01', interval: '5 min',   daily: 2.88,   monthly: 86.40 },
  { price: '$0.01', interval: '10 min',  daily: 1.44,   monthly: 43.20 },
  { price: '$0.01', interval: '15 min',  daily: 0.96,   monthly: 28.80 },
  { price: '$0.01', interval: '30 min',  daily: 0.48,   monthly: 14.40 },
  { price: '$0.05', interval: '5 min',   daily: 14.40,  monthly: 432 },
  { price: '$0.05', interval: '15 min',  daily: 4.80,   monthly: 144 },
  { price: '$0.05', interval: '30 min',  daily: 2.40,   monthly: 72 },
  { price: '$0.10', interval: '5 min',   daily: 28.80,  monthly: 864 },
  { price: '$0.10', interval: '15 min',  daily: 9.60,   monthly: 288 },
  { price: '$0.10', interval: '60 min',  daily: 2.40,   monthly: 72 },
  { price: '$1.00', interval: '60 min',  daily: 24.00,  monthly: 720 },
  { price: '$5.00', interval: '60 min',  daily: 120.00, monthly: 3600 },
];

function costColor(val: number): string {
  if (val > 50) return 'var(--status-critical)';
  if (val > 10) return 'var(--status-degraded)';
  return 'var(--status-operational)';
}

function fmt(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
}

export default function CostGuidePage() {
  const [activeId, setActiveId] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
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

      {/* Mobile top bar */}
      <div style={{ display: 'none', position: 'sticky', top: 0, zIndex: 50, height: 48, alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }} className="docs-mobile-bar">
        <Link href="/docs" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--text-primary)', textDecoration: 'none' }}>
          CORTX <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>docs</span>
        </Link>
        <button onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, fontSize: 18, lineHeight: 1 }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div style={{ position: 'fixed', top: 48, left: 0, right: 0, bottom: 0, zIndex: 40, background: 'var(--bg-surface)', padding: 20, overflowY: 'auto' }} className="docs-mobile-drawer">
          <SidebarContent activeId={activeId} scrollTo={scrollTo} />
        </div>
      )}

      <div style={{ display: 'flex', maxWidth: 1100, margin: '0 auto' }}>

        {/* Sidebar */}
        <aside style={{ width: 220, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', padding: '40px 0 40px 24px', borderRight: '1px solid var(--border-subtle)' }} className="docs-sidebar">
          <Link href="/docs" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', color: 'var(--text-primary)', textDecoration: 'none', display: 'block', marginBottom: 32 }}>
            CORTX <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>docs</span>
          </Link>
          <SidebarContent activeId={activeId} scrollTo={scrollTo} />
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, padding: '40px 48px 120px', maxWidth: 720 }} className="docs-main">

          {/* Overview */}
          <section id="overview" style={sectionStyle}>
            <p style={eyebrowStyle}>Cost Guide</p>
            <h1 style={h1Style}>On-Chain Monitoring Costs</h1>
            <p style={bodyStyle}>
              CORTX runs real payments through your x402 endpoint — that means real USDC on Base mainnet leaves your wallet on every check. This guide explains exactly what costs money, how to calculate your expected spend, and how to keep it under control.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 28 }}>
              {[
                { label: 'Per-check cost', value: 'endpoint price', note: 'What the endpoint charges, paid in USDC' },
                { label: 'Default daily cap', value: '$1.00', note: 'Checks stop when cap is reached' },
                { label: 'Default monthly cap', value: '$10.00', note: 'Resets on the 1st of each month' },
              ].map(c => (
                <div key={c.label} style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.02em' }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* What costs money */}
          <section id="pipeline" style={sectionStyle}>
            <h2 style={h2Style}>What Costs Money</h2>
            <p style={bodyStyle}>
              Only one stage in the 7-stage pipeline triggers an actual payment: <code style={codeStyle}>payment</code>. All other stages are free HTTP calls or local computation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 20 }}>
              {[
                { key: 'availability',     free: true,  note: 'HTTP GET — free' },
                { key: 'payment_terms',    free: true,  note: 'Reads 402 response header — free' },
                { key: 'price_check',      free: true,  note: 'Local comparison — free' },
                { key: 'payment',          free: false, note: 'Signs & submits EIP-3009 USDC transfer — costs the endpoint price' },
                { key: 'delivery',         free: true,  note: 'HTTP GET with X-Payment header — free (payment already sent)' },
                { key: 'json_parse',       free: true,  note: 'Local parse — free' },
                { key: 'schema_validation',free: true,  note: 'Local AJV validation — free' },
              ].map(s => (
                <div key={s.key} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 14px', background: !s.free ? 'rgba(167,139,250,0.06)' : 'var(--bg-surface)', borderRadius: 6, border: `1px solid ${!s.free ? 'rgba(167,139,250,0.2)' : 'var(--border-subtle)'}` }}>
                  <code style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: !s.free ? '#a78bfa' : 'var(--text-dim)', minWidth: 140 }}>{s.key}</code>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{s.note}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.free ? 'var(--status-operational)' : '#a78bfa', fontFamily: 'var(--font-geist-mono)', whiteSpace: 'nowrap' }}>{s.free ? 'FREE' : 'COSTS'}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(167,139,250,0.06)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.2)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: '#a78bfa' }}>Important:</strong> If the check fails at stage 4 (<code style={codeStyle}>payment</code>) or earlier, <em>no payment is sent</em>. If it fails at stages 5–7 after a successful payment, the USDC has already left your wallet — the endpoint received it.
            </div>
          </section>

          {/* Cost Matrix */}
          <section id="matrix" style={sectionStyle}>
            <h2 style={h2Style}>Cost Matrix</h2>
            <p style={bodyStyle}>
              Your total cost = endpoint price × checks per day. Use this table to plan your wallet balance before enabling a service.
            </p>
            <div style={{ overflowX: 'auto', marginTop: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Price / call', 'Interval', 'Calls/day', 'Daily cost', 'Monthly cost'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COST_ROWS.map((r, i) => {
                    const callsPerDay = Math.round(1440 / parseInt(r.interval));
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{r.price}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.interval}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--text-dim)' }}>{callsPerDay}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: costColor(r.daily), fontVariantNumeric: 'tabular-nums' }}>{fmt(r.daily)}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: costColor(r.monthly), fontVariantNumeric: 'tabular-nums' }}>{fmt(r.monthly)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12 }}>
              {[
                { color: 'var(--status-operational)', label: 'Under $10/month' },
                { color: 'var(--status-degraded)',    label: '$10–$50/month' },
                { color: 'var(--status-critical)',    label: 'Over $50/month' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                  <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Spend Caps */}
          <section id="spend-caps" style={sectionStyle}>
            <h2 style={h2Style}>Spend Caps</h2>
            <p style={bodyStyle}>
              CORTX enforces cumulative caps across all your services. When a cap is hit, checks are skipped silently — no incident opens — and resume automatically when the cap resets.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20, marginBottom: 24 }}>
              {[
                { label: 'Daily cap', env: 'CORTX_DAILY_SPEND_CAP_USDC', default: '$1.00', reset: 'Resets at UTC midnight' },
                { label: 'Monthly cap', env: 'CORTX_MONTHLY_SPEND_CAP_USDC', default: '$10.00', reset: 'Resets on 1st of month (UTC)' },
              ].map(c => (
                <div key={c.label} style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8 }}>{c.default}</div>
                  <code style={{ ...codeStyle, display: 'block', marginBottom: 6, wordBreak: 'break-all' }}>{c.env}</code>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.reset}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Override caps by setting the env vars in your Vercel project settings. For example, to allow $5/day and $50/month:
            </p>
            <pre style={preStyle}>{`CORTX_DAILY_SPEND_CAP_USDC=5.00
CORTX_MONTHLY_SPEND_CAP_USDC=50.00`}</pre>
          </section>

          {/* Wallet Planning */}
          <section id="planning" style={sectionStyle}>
            <h2 style={h2Style}>Wallet Planning</h2>
            <p style={bodyStyle}>
              Your CORTX test wallet should hold enough USDC to cover at least a few days of checks — ideally a full month if you want zero interruptions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 20, marginBottom: 24 }}>
              {[
                { tier: 'Minimal',   hold: '$5 USDC',   ideal: 'Hobby / low-frequency checks ($0.01 at 30 min intervals)' },
                { tier: 'Standard',  hold: '$25 USDC',  ideal: '1–3 services at typical rates ($0.01–$0.10 at 5–15 min)' },
                { tier: 'High-freq', hold: '$100 USDC', ideal: 'Multiple services at high frequency or high price-per-call' },
              ].map(t => (
                <div key={t.tier} style={{ display: 'flex', gap: 16, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-subtle)', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 80 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{t.tier}</div>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 13, color: 'var(--status-operational)', fontWeight: 600 }}>{t.hold}</div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t.ideal}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--status-degraded-bg)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.25)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong>Never use your main wallet.</strong> The private key lives in an env var. Create a dedicated test wallet, fund it minimally, and treat it as disposable. The CORTX admin dashboard shows live balance and daily/monthly spend so you can top up before you run dry.
            </div>
          </section>

          {/* Best Practices */}
          <section id="practices" style={sectionStyle}>
            <h2 style={h2Style}>Best Practices</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                {
                  title: 'Start with a long interval',
                  body: 'Begin at 15–30 minutes and shorten as needed. A 5-minute interval costs 3× more than 15 minutes for the same endpoint. You can always reduce the interval if you need faster incident detection.',
                },
                {
                  title: 'Set max price tighter than you think',
                  body: 'Your Max Price field is the ceiling CORTX will pay per check. Set it 10–20% above expected price — enough headroom for rounding, not enough for a surprise price increase to drain your wallet unnoticed.',
                },
                {
                  title: 'Check the cost matrix before enabling',
                  body: 'Calculate daily and monthly cost before saving a service. A $5/call endpoint checked hourly costs $3,600/month. Raise the daily cap explicitly if you accept that cost — don\'t let the default cap silently cut off your monitoring.',
                },
                {
                  title: 'Monitor the admin dashboard',
                  body: 'The Admin page shows live USDC balance, today\'s spend vs daily cap, and monthly spend vs monthly cap. Check it after enabling a new service and again after 24 hours to confirm costs are what you expected.',
                },
                {
                  title: 'Keep cap resets in mind',
                  body: 'Daily caps reset at UTC midnight, monthly caps on the 1st. A service that hits the daily cap at 6pm will have 6 hours of missed checks. If that gap is unacceptable, raise the cap.',
                },
                {
                  title: 'Coordinate with the endpoint owner',
                  body: 'If you\'re monitoring an endpoint you don\'t own, let the provider know. CORTX makes real payments and the provider receives them. They may offer a monitoring-specific key, reduced price, or a refund arrangement.',
                },
              ].map(p => (
                <div key={p.title} style={{ padding: '18px 20px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{p.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{p.body}</div>
                </div>
              ))}
            </div>
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

function SidebarContent({ activeId, scrollTo }: { activeId: string; scrollTo: (id: string) => void }) {
  return (
    <nav>
      <div style={{ marginBottom: 20 }}>
        <Link href="/docs" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6 }}>
          ← Back to Docs
        </Link>
      </div>
      {NAV_GROUPS.map(group => (
        <div key={group.group} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6, padding: '0 12px' }}>
            {group.group}
          </div>
          {group.items.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: activeId === item.id ? 500 : 400,
                color: activeId === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: activeId === item.id ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 80, scrollMarginTop: 32 };

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8,
};

const h1Style: React.CSSProperties = {
  fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em',
  color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.2,
};

const h2Style: React.CSSProperties = {
  fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em',
  color: 'var(--text-primary)', marginBottom: 12,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75,
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)', fontSize: 12,
  background: 'var(--bg-muted)', color: 'var(--text-secondary)',
  padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)',
};

const preStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)', fontSize: 12,
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  borderRadius: 8, padding: '16px 20px', overflowX: 'auto',
  color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 12,
};
