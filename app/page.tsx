'use client';

import { useEffect, useRef } from 'react';
import './landing.css';

export default function LandingPage() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const saved = localStorage.getItem('cortx-landing-theme');
    if (saved) wrap.setAttribute('data-theme', saved);

    const themeBtn = wrap.querySelector<HTMLButtonElement>('#themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = wrap.getAttribute('data-theme');
        const isDark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme:dark)').matches);
        const next = isDark ? 'light' : 'dark';
        wrap.setAttribute('data-theme', next);
        localStorage.setItem('cortx-landing-theme', next);
      });
    }

    const dropBtn = wrap.querySelector<HTMLButtonElement>('#dropBtn');
    const navMega = wrap.querySelector<HTMLElement>('#navMega');
    const dropHost = wrap.querySelector<HTMLElement>('#dropHost');
    if (dropBtn && navMega && dropHost) {
      dropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navMega.classList.contains('open');
        navMega.classList.toggle('open', !isOpen);
        dropBtn.classList.toggle('open', !isOpen);
        dropBtn.setAttribute('aria-expanded', String(!isOpen));
      });
      document.addEventListener('click', (e) => {
        if (!dropHost.contains(e.target as Node)) {
          navMega.classList.remove('open');
          dropBtn.classList.remove('open');
          dropBtn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMega.classList.contains('open')) {
          navMega.classList.remove('open');
          dropBtn.classList.remove('open');
          dropBtn.setAttribute('aria-expanded', 'false');
          dropBtn.focus();
        }
      });
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    wrap.querySelectorAll('.reveal').forEach((el) => obs.observe(el));

    function makeBars(id: string, fails: number[]) {
      const el = wrap!.querySelector<HTMLElement>(`#${id}`);
      if (!el) return;
      el.innerHTML = Array.from({ length: 90 }, (_, i) => {
        const c = i < 8 ? 'empty' : fails.includes(i) ? 'fail' : 'pass';
        return `<div class="uptime-bar ${c}"></div>`;
      }).join('');
    }
    makeBars('ub1', [42, 71, 82]);
    makeBars('ub2', []);

    wrap.querySelectorAll('.evidence-tab').forEach((t) => {
      t.addEventListener('click', function (this: Element) {
        wrap!.querySelectorAll('.evidence-tab').forEach((x) => x.classList.remove('active'));
        this.classList.add('active');
      });
    });

    return () => obs.disconnect();
  }, []);

  return (
    <div className="lp" ref={wrapRef}>
      {/* NAV */}
      <nav>
        <div className="nav-inner">
          <a href="/" className="nav-logo">
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <circle cx="3" cy="11" r="2" fill="#c7cad1" /><circle cx="19" cy="11" r="2" fill="#c7cad1" />
              <line x1="5" y1="11" x2="17" y2="11" stroke="#e0e2e6" strokeWidth="1.5" />
              <circle cx="11" cy="3" r="2" fill="#5e6ad2" /><circle cx="11" cy="19" r="2" fill="#5e6ad2" />
              <line x1="11" y1="5" x2="11" y2="17" stroke="#5e6ad2" strokeWidth="1.5" />
              <circle cx="11" cy="11" r="2.5" fill="#5e6ad2" />
            </svg>
            CORTX
          </a>
          <ul className="nav-links">
            <li className="nav-drop-host" id="dropHost">
              <button className="nav-drop-btn" id="dropBtn" aria-expanded="false" aria-haspopup="true">
                Product
                <svg className="drop-chev" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="nav-mega" id="navMega" role="menu">
                <div className="mega-list">
                  <a className="mega-item" href="#product" role="menuitem">
                    <div className="mega-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                    <div><div className="mega-title">End-to-end checks</div><div className="mega-desc">7-stage x402 journey, availability through schema</div></div>
                  </a>
                  <a className="mega-item" href="#methodology" role="menuitem">
                    <div className="mega-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M2 13V5M5.5 13V7.5M9 13V5.5M12.5 13V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></div>
                    <div><div className="mega-title">Incident evidence</div><div className="mega-desc">Payment, schema and timing data for every check</div></div>
                  </a>
                  <a className="mega-item" href="#status" role="menuitem">
                    <div className="mega-ico"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg></div>
                    <div><div className="mega-title">Public status pages</div><div className="mega-desc">Share reliability proof with users and partners</div></div>
                  </a>
                </div>
              </div>
            </li>
            <li><a href="#methodology">Methodology</a></li>
            <li><a href="#status">Status</a></li>
            <li><a href="https://github.com/danbuildss/cortx">GitHub</a></li>
          </ul>
          <div className="nav-actions">
            <button className="btn-theme" id="themeToggle" aria-label="Toggle theme">
              <svg className="icon-moon" viewBox="0 0 16 16" fill="none"><path d="M13.5 9.5A6 6 0 1 1 7 3.5a4.5 4.5 0 0 0 6.5 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              <svg className="icon-sun" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            </button>
            <a href="/login" className="btn-nav-ghost">Sign in</a>
            <a href="/signup" className="btn-nav-cta">Monitor a Service →</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-container">
          <div className="eyebrow h-eyebrow">x402 reliability infrastructure</div>
          <h1 className="hero-headline">
            <span className="hline hline-1">Your x402 service can be</span><br />
            <span className="hline hline-2">online and still be broken.</span>
          </h1>
          <p className="hero-sub h-sub">CORTX makes controlled paid test calls and verifies payment terms, settlement, delivery and response schema — so you catch failures before users do, on a schedule you control.</p>
          <div className="hero-actions h-actions">
            <a href="/signup" className="btn-cta-primary">
              Monitor a Service
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            <a href="#methodology" className="btn-cta-ghost">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M5 6h4M5 8.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              View Methodology
            </a>
          </div>
        </div>

        <div className="mockup-outer h-mockup">
          <div className="mockup-chrome">
            <div className="chrome-dots"><span /><span /><span /></div>
            <div className="chrome-url">cortx.app/services/wallet-research</div>
            <div style={{ width: 55 }} />
          </div>
          <div className="mockup-body">
            <div className="cp-header">
              <div className="cp-name">Wallet Research API</div>
              <div className="cp-badge-deg">Degraded</div>
            </div>
            <div className="cp-endpoint">x402.bankr.bot/research · checked 3m ago</div>
            <div className="cp-rows">
              <div className="cpr"><div className="cpr-ico pass">✓</div><div className="cpr-stage">Availability</div><div className="cpr-val pass">200 OK</div></div>
              <div className="cpr"><div className="cpr-ico pass">✓</div><div className="cpr-stage">Payment terms</div><div className="cpr-val pass">valid</div></div>
              <div className="cpr"><div className="cpr-ico pass">✓</div><div className="cpr-stage">Price</div><div className="cpr-val mid">0.001 USDC</div></div>
              <div className="cpr"><div className="cpr-ico pass">✓</div><div className="cpr-stage">Payment</div><div className="cpr-val pass">settled</div></div>
              <div className="cpr"><div className="cpr-ico pass">✓</div><div className="cpr-stage">Delivery</div><div className="cpr-val pass">received</div></div>
              <div className="cpr"><div className="cpr-ico pass">✓</div><div className="cpr-stage">JSON parse</div><div className="cpr-val pass">valid</div></div>
              <div className="cpr"><div className="cpr-ico fail">✕</div><div className="cpr-stage fail">Schema</div><div className="cpr-val fail">missing: result.summary</div></div>
            </div>
            <div className="cp-incident">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Incident #3 opened · Telegram alert sent
            </div>
          </div>
        </div>
      </section>

      {/* PROOF ROW */}
      <div className="proof-row">
        <div className="proof-inner">
          <div className="proof-item"><div className="proof-dot" />Base mainnet</div>
          <div className="proof-item"><div className="proof-dot" />Real USDC test calls</div>
          <div className="proof-item"><div className="proof-dot" />7-stage verification</div>
          <div className="proof-item"><div className="proof-dot" />Configurable spending caps</div>
        </div>
      </div>

      {/* PROBLEM */}
      <section className="section" id="product">
        <div className="container">
          <div className="reveal">
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title" style={{ maxWidth: 460 }}>A successful HTTP response is not successful service delivery.</h2>
            <p className="section-sub" style={{ maxWidth: 480 }}>Your server can respond while the payment flow, returned JSON or expected schema is broken. Traditional monitoring does not check any of this.</p>
          </div>
          <div className="problem-grid">
            <div className="problem-card traditional reveal" style={{ '--rd': '0.06s' } as React.CSSProperties}>
              <div className="problem-card-label">Traditional monitoring</div>
              <div className="check-row"><div className="check-icon pass">✓</div><div className="check-label">Endpoint responded</div><div className="check-status pass">200 OK</div></div>
              <div className="check-row"><div className="check-icon neutral">—</div><div className="check-label">Payment terms valid</div><div className="check-status">not checked</div></div>
              <div className="check-row"><div className="check-icon neutral">—</div><div className="check-label">Price within range</div><div className="check-status">not checked</div></div>
              <div className="check-row"><div className="check-icon neutral">—</div><div className="check-label">Payment accepted</div><div className="check-status">not checked</div></div>
              <div className="check-row"><div className="check-icon neutral">—</div><div className="check-label">Result delivered</div><div className="check-status">not checked</div></div>
              <div className="check-row"><div className="check-icon neutral">—</div><div className="check-label">Schema valid</div><div className="check-status">not checked</div></div>
              <div className="problem-outcome bad">Service appears healthy. Users report broken results.</div>
            </div>
            <div className="problem-card cortx reveal" style={{ '--rd': '0.14s' } as React.CSSProperties}>
              <div className="problem-card-label">CORTX</div>
              <div className="check-row"><div className="check-icon pass">✓</div><div className="check-label">Endpoint responded</div><div className="check-status pass">200 OK</div></div>
              <div className="check-row"><div className="check-icon pass">✓</div><div className="check-label">Payment terms valid</div><div className="check-status pass">valid</div></div>
              <div className="check-row"><div className="check-icon pass">✓</div><div className="check-label">Price within range</div><div className="check-status pass">0.001 USDC</div></div>
              <div className="check-row"><div className="check-icon pass">✓</div><div className="check-label">Payment accepted</div><div className="check-status pass">settled</div></div>
              <div className="check-row"><div className="check-icon pass">✓</div><div className="check-label">Result delivered</div><div className="check-status pass">valid JSON</div></div>
              <div className="check-row"><div className="check-icon fail">✕</div><div className="check-label fail">Schema valid</div><div className="check-status fail">invalid</div></div>
              <div className="problem-outcome good">Degraded. Incident opened. Alert sent.</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="reveal">
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">CORTX tests the service like a real customer.</h2>
            <p className="section-sub" style={{ maxWidth: 500 }}>Using a safe payload, dedicated testing wallet and strict spending limit, CORTX runs the complete paid request and records evidence at every stage.</p>
          </div>
          <div className="steps-grid">
            <div className="step-card reveal" style={{ '--rd': '0.05s' } as React.CSSProperties}><div className="step-num">01</div><div className="step-title">Configure</div><div className="step-body">Add your endpoint, a safe test payload, expected price range, and the JSON Schema for a valid response.</div></div>
            <div className="step-card reveal" style={{ '--rd': '0.12s' } as React.CSSProperties}><div className="step-num">02</div><div className="step-title">Pay</div><div className="step-body">CORTX performs a real EIP-3009 USDC authorization from a dedicated synthetic wallet on Base mainnet, within your defined price cap.</div></div>
            <div className="step-card reveal" style={{ '--rd': '0.19s' } as React.CSSProperties}><div className="step-num">03</div><div className="step-title">Verify</div><div className="step-body">Every stage is checked independently — payment terms, price, settlement, delivery, JSON validity, and schema conformance.</div></div>
            <div className="step-card reveal" style={{ '--rd': '0.26s' } as React.CSSProperties}><div className="step-num">04</div><div className="step-title">Alert</div><div className="step-body">On repeated failure, CORTX opens an incident and notifies you via Telegram before your users notice.</div></div>
          </div>
        </div>
      </section>

      {/* EVIDENCE */}
      <section className="section" id="methodology">
        <div className="container">
          <div className="reveal">
            <div className="section-eyebrow">Evidence</div>
            <h2 className="section-title">Stop guessing where the request failed.</h2>
            <p className="section-sub" style={{ maxWidth: 440 }}>See the exact payment terms, response body, schema errors and stage timings behind every incident. Evidence stored for every check run.</p>
          </div>
          <div className="evidence-card reveal" style={{ '--rd': '0.08s' } as React.CSSProperties}>
            <div className="evidence-tabs">
              <div className="evidence-tab active">Summary</div>
              <div className="evidence-tab">Payment</div>
              <div className="evidence-tab">Response</div>
              <div className="evidence-tab">Schema Diff</div>
            </div>
            <div className="evidence-body">
              <div className="json-line"><span className="jb">{'{'}</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;http_status&quot;</span><span className="jb">: </span><span className="jn">200</span><span className="jb">,</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;payment_status&quot;</span><span className="jb">: </span><span className="js">&quot;settled&quot;</span><span className="jb">,</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;observed_price_usdc&quot;</span><span className="jb">: </span><span className="jn">0.001</span><span className="jb">,</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;response_json_valid&quot;</span><span className="jb">: </span><span className="jt">true</span><span className="jb">,</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;schema_valid&quot;</span><span className="jb">: </span><span className="jf">false</span><span className="jb">,</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;missing_fields&quot;</span><span className="jb">: [</span><span className="js">&quot;result.summary&quot;</span><span className="jb">],</span></div>
              <div className="json-line" style={{ paddingLeft: 16 }}><span className="jk">&quot;latency_ms&quot;</span><span className="jb">: </span><span className="jn">4632</span></div>
              <div className="json-line"><span className="jb">{'}'}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* SAFE BY DESIGN */}
      <section className="section" id="safety">
        <div className="container">
          <div className="reveal">
            <div className="section-eyebrow">Safety</div>
            <h2 className="section-title">Real payments, controlled exposure.</h2>
            <p className="section-sub" style={{ maxWidth: 440 }}>Set the maximum price, test frequency and monthly budget. CORTX blocks calls when quoted terms exceed your policy.</p>
          </div>
          <div className="safe-grid">
            <div className="safe-item reveal" style={{ '--rd': '0.04s' } as React.CSSProperties}>
              <div className="safe-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M8 2l5 2v4c0 3-5 6-5 6S3 11 3 8V4l5-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg></div>
              <div className="safe-title">Builder-defined price cap</div>
              <div className="safe-body">CORTX blocks any call where the quoted price exceeds your maximum.</div>
            </div>
            <div className="safe-item reveal" style={{ '--rd': '0.09s' } as React.CSSProperties}>
              <div className="safe-ico"><svg viewBox="0 0 16 16" fill="none"><rect x="3" y="6.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 6.5V5a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></div>
              <div className="safe-title">Dedicated synthetic wallet</div>
              <div className="safe-body">Tests run from an isolated wallet, separate from any production funds.</div>
            </div>
            <div className="safe-item reveal" style={{ '--rd': '0.14s' } as React.CSSProperties}>
              <div className="safe-ico"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5.5V8.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <div className="safe-title">Configurable interval</div>
              <div className="safe-body">Choose how frequently CORTX tests your service, balancing cost and coverage.</div>
            </div>
            <div className="safe-item reveal" style={{ '--rd': '0.19s' } as React.CSSProperties}>
              <div className="safe-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M2 11l3-5.5 3 3.5 2-2 3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <div className="safe-title">Monthly spend cap</div>
              <div className="safe-body">Set an absolute USDC budget for the month. Checks pause when it&apos;s reached.</div>
            </div>
            <div className="safe-item reveal" style={{ '--rd': '0.24s' } as React.CSSProperties}>
              <div className="safe-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M8 2.5v5M8 10v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" /></svg></div>
              <div className="safe-title">Auto-blocked on price change</div>
              <div className="safe-body">If quoted price changes unexpectedly, the call is blocked and an alert fires.</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATUS */}
      <section className="section" id="status">
        <div className="container">
          <div className="reveal">
            <div className="section-eyebrow">Public status pages</div>
            <h2 className="section-title">Turn reliability into public proof.</h2>
            <p className="section-sub" style={{ maxWidth: 420 }}>Share a public CORTX status page with users, agents and partners. Updated automatically after every check run.</p>
          </div>
          <div className="status-preview reveal" style={{ '--rd': '0.08s' } as React.CSSProperties}>
            <div className="status-label-row">
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>cortx.app/status/bankr</div>
              <div className="status-demo-badge">Example</div>
            </div>
            <div className="status-banner">
              <div className="status-dot-lg" />
              <div className="status-banner-label">All systems operational</div>
              <div className="status-updated">Updated 47s ago</div>
            </div>
            <div className="status-svc-row">
              <div className="status-svc-header"><div className="status-svc-name">Wallet Research API</div><div className="status-svc-stat">Tested by CORTX · 90d</div></div>
              <div className="uptime-bars" id="ub1" />
              <div className="uptime-labels"><span className="uptime-label">90 days ago</span><span className="uptime-label">today</span></div>
            </div>
            <div className="status-svc-row">
              <div className="status-svc-header"><div className="status-svc-name">Market Data Feed</div><div className="status-svc-stat">Tested by CORTX · 90d</div></div>
              <div className="uptime-bars" id="ub2" />
              <div className="uptime-labels"><span className="uptime-label">90 days ago</span><span className="uptime-label">today</span></div>
            </div>
            <div style={{ marginTop: 13, textAlign: 'center' }}>
              <a href="/login" className="btn-nav-ghost" style={{ fontSize: '11.5px' }}>View your status page →</a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="reveal">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Private beta · Bankr x402 on Base</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(22px,3.2vw,36px)', marginBottom: 0 }}>Catch failures before your users do.</h2>
            <p className="cta-sub">Monitor one Bankr x402 service in the CORTX private beta.</p>
            <div className="cta-actions">
              <a href="/signup" className="btn-cta-primary">
                Monitor a Service
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>
            <p className="cta-note">Currently supports Bankr-hosted x402 JSON APIs on Base mainnet.<br />Private beta. No token. No marketplace.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ft">
        <div className="ft-inner">
          <div className="ft-top">
            <div>
              <div className="ft-brand-logo">
                <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
                  <circle cx="3" cy="11" r="2" fill="#4b5563" /><circle cx="19" cy="11" r="2" fill="#4b5563" />
                  <line x1="5" y1="11" x2="17" y2="11" stroke="#374151" strokeWidth="1.5" />
                  <circle cx="11" cy="3" r="2" fill="#5e6ad2" /><circle cx="11" cy="19" r="2" fill="#5e6ad2" />
                  <line x1="11" y1="5" x2="11" y2="17" stroke="#5e6ad2" strokeWidth="1.5" />
                  <circle cx="11" cy="11" r="2.5" fill="#5e6ad2" />
                </svg>
                CORTX
              </div>
              <div className="ft-brand-desc">x402 reliability monitoring for builders on Base mainnet.</div>
            </div>
            <div>
              <div className="ft-col-label">Product</div>
              <div className="ft-col-links">
                <a href="#product">End-to-end checks</a>
                <a href="#methodology">Incident evidence</a>
                <a href="#status">Public status pages</a>
                <a href="#how-it-works">How it works</a>
              </div>
            </div>
            <div>
              <div className="ft-col-label">Account</div>
              <div className="ft-col-links">
                <a href="/login">Sign in</a>
                <a href="/signup">Monitor a Service</a>
                <a href="https://github.com/danbuildss/cortx">GitHub</a>
              </div>
            </div>
          </div>
          <div className="ft-bottom">
            <div className="ft-copy">© 2026 CORTX · Built for Bankr x402 on Base</div>
            <div className="ft-legal-links">
              <a href="https://x.com/cortxapp">X (Twitter)</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
