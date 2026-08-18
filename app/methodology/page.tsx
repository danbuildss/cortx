export const revalidate = 3600;

const C = {
  page:          '#08090a',
  surface:       '#111214',
  elevated:      '#16181d',
  border:        '#1e2028',
  borderAlt:     '#2a2d35',
  textPrimary:   '#f0f1f3',
  textSecondary: '#9ca3af',
  textMuted:     '#6b7280',
  textDim:       '#4b5563',
  green:         '#22c55e',
  greenBg:       'rgba(34,197,94,0.07)',
  greenBorder:   'rgba(34,197,94,0.18)',
  amber:         '#f59e0b',
  amberBg:       'rgba(245,158,11,0.08)',
  violet:        '#a78bfa',
  violetBg:      'rgba(167,139,250,0.06)',
  violetBorder:  'rgba(167,139,250,0.2)',
};

const STAGES = [
  {
    key:   'availability',
    num:   '01',
    label: 'Availability',
    desc:  'CORTX sends an HTTP POST (with test payload) to the endpoint URL. A 402 Payment Required response is expected — it signals the endpoint is alive and requires payment. If POST does not return 402, CORTX retries with GET to support endpoints that gate on GET requests. Any other non-402 response (connection refused, 500, timeout) fails the check here.',
  },
  {
    key:   'payment_terms',
    num:   '02',
    label: 'Payment Terms',
    desc:  'CORTX parses the 402 response body for x402 payment terms (network, asset, amount, recipient address). If the body is not a valid x402 envelope, the X-Payment-Required header is tried as a fallback. Missing, malformed, or unparseable payment terms fail this stage.',
  },
  {
    key:   'price_check',
    num:   '03',
    label: 'Price Check',
    desc:  'The parsed price is compared against the service\'s configured expected price and max price bounds. Prices exceeding max price fail this stage to protect the monitoring wallet. Price deviations from expected are recorded.',
  },
  {
    key:   'payment',
    num:   '04',
    label: 'Payment',
    desc:  'CORTX uses the x402/client package to sign an EIP-3009 transferWithAuthorization — a gasless USDC transfer on Base. The monitoring wallet\'s private key signs the EIP-712 message, and the resulting signature is encoded into an X-Payment header. Real USDC is spent.',
    accent: true,
  },
  {
    key:   'delivery',
    num:   '05',
    label: 'Delivery',
    desc:  'The original request is re-sent with the X-Payment header. CORTX expects a 200 OK response. Any other status — including a second 402 — produces a critical failure: payment was sent but content was not delivered.',
  },
  {
    key:   'json_parse',
    num:   '06',
    label: 'JSON Parse',
    desc:  'The response body (capped at 1 MB) is parsed as valid JSON. Unparseable responses fail here. This stage runs on every check regardless of whether a schema is configured.',
  },
  {
    key:   'schema_validation',
    num:   '07',
    label: 'Schema Validation',
    desc:  'If an expected JSON Schema is configured for the service, AJV validates the parsed response against it. Any violation — missing required field, wrong type, disallowed additional property — fails the check. This stage is skipped when no schema is configured.',
  },
];

const METRICS = [
  {
    name:    'Uptime',
    formula: 'passed ÷ (passed + failed) over the window',
    detail:  'Counts checks with status "passed" divided by all eligible checks (passed + failed). Infrastructure errors (status "error") are excluded from both numerator and denominator — they represent CORTX monitoring issues, not endpoint failures.',
  },
  {
    name:    'Paid Delivery',
    formula: 'checks where payment AND delivery both passed ÷ checks that reached both stages',
    detail:  'Only counts checks that reached both the payment stage and the delivery stage. A check that failed at payment_terms never enters this denominator. This metric answers: "Of checks that attempted a full payment cycle, how many resulted in successful delivery?"',
  },
  {
    name:    'Schema Validity',
    formula: 'checks where schema_validation passed ÷ checks that reached schema_validation',
    detail:  'Counts only checks that reached the schema_validation stage (i.e., that had a schema configured and a parseable JSON response). Checks without a configured schema are excluded entirely from this metric.',
  },
  {
    name:    'Median Latency',
    formula: 'median of all full round-trip times (ms) over the window',
    detail:  'Full round-trip duration including the payment signing step. For even-length arrays, the median is the average of the two middle values — not a truncated index. Infrastructure errors are excluded. Null when no latency data is available in the window.',
  },
  {
    name:    'Infrastructure Errors',
    formula: 'checks with status "error" — excluded from all metrics',
    detail:  'Checks that failed due to CORTX monitoring infrastructure issues: network timeouts, RPC failures, internal errors. These do not open incidents and are excluded from all reliability metric calculations. Only "failed" check results affect uptime and incident state.',
  },
];

export default function MethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.page, color: C.textPrimary, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 100px' }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 12 }}>
            Methodology
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: C.textPrimary, marginBottom: 16, lineHeight: 1.15 }}>
            How CORTX measures reliability
          </h1>
          <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.75, maxWidth: 620 }}>
            CORTX monitors every x402 endpoint on two tiers: a free lightweight ping every 5 minutes confirms reachability, and a full paid verification at a configured interval runs a real end-to-end transaction through the 7-stage pipeline below, recording evidence at each stage.
          </p>
        </div>

        {/* Stages */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
            The 7-Stage Pipeline
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {STAGES.map(s => (
              <div key={s.key} style={{
                display: 'flex', gap: 16, padding: '16px 18px',
                background: s.accent ? C.violetBg : C.surface,
                border: `1px solid ${s.accent ? C.violetBorder : C.border}`,
                borderRadius: 8,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: s.accent ? C.violet : C.textDim,
                  fontFamily: 'monospace', minWidth: 22, paddingTop: 2,
                }}>
                  {s.num}
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <code style={{
                      fontSize: 12, fontFamily: 'monospace',
                      color: s.accent ? C.violet : C.textPrimary,
                      background: s.accent ? 'rgba(167,139,250,0.1)' : C.elevated,
                      padding: '2px 7px', borderRadius: 4,
                      border: `1px solid ${s.accent ? C.violetBorder : C.border}`,
                    }}>
                      {s.key}
                    </code>
                    <span style={{ fontSize: 13, fontWeight: 600, color: s.accent ? C.violet : C.textPrimary }}>
                      {s.label}
                    </span>
                    {s.accent && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: C.violetBg, color: C.violet, border: `1px solid ${C.violetBorder}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Real USDC
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: '14px 18px', background: C.elevated, border: `1px solid ${C.borderAlt}`, borderRadius: 8, fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
            <strong style={{ color: C.textPrimary }}>Stage failures:</strong> Stages 1–3 (availability, payment_terms, price_check) open a <span style={{ color: C.amber }}>degraded</span> incident. Stages 4–7 (payment through schema_validation) open a <span style={{ color: '#ef4444' }}>critical</span> incident.
          </div>
        </section>

        {/* Metric definitions */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
            Metric Definitions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {METRICS.map(m => (
              <div key={m.name} style={{ padding: '18px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{m.name}</span>
                  <code style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted, background: C.elevated, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.border}` }}>
                    {m.formula}
                  </code>
                </div>
                <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>
                  {m.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Scope of Verification
          </h2>
          <div style={{ padding: '20px 22px', background: C.elevated, border: `1px solid ${C.borderAlt}`, borderRadius: 8, borderLeft: `3px solid ${C.amber}` }}>
            <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.8, margin: 0 }}>
              CORTX verifies technical delivery and configured response structure. It does not verify the factual accuracy, safety, or quality of arbitrary API outputs.
            </p>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
            Specifically, CORTX confirms that an endpoint: (1) responds to an HTTP request with a 402 status, (2) provides valid x402 payment terms, (3) accepts a signed payment, (4) delivers a 200 response, (5) returns parseable JSON, and optionally (6) matches a configured JSON Schema. CORTX does not evaluate the truthfulness, helpfulness, or appropriateness of the response content.
          </p>
        </section>

        {/* Window */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Measurement Windows
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { window: '30 days', where: 'Service status page, Reliability API, badge', desc: 'Default window for all public reliability metrics.' },
              { window: '90 days', where: 'Status pages (uptime bars)', desc: 'Used for the historical availability bar chart only.' },
            ].map(w => (
              <div key={w.window} style={{ padding: '16px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{w.window}</div>
                <div style={{ fontSize: 11, color: C.green, marginBottom: 8 }}>{w.where}</div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{w.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Open Spec */}
        <section style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Open Standard
          </h2>
          <div style={{ padding: '20px 22px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                x402 Reliability Spec
              </div>
              <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: '0 0 14px' }}>
                The 7-stage pipeline above is defined as an open specification. Anyone can implement it, propose changes, or build tooling that produces conforming evidence records — no dependency on CORTX required.
              </p>
              <a
                href="https://github.com/danbuildss/x402-reliability-spec"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 600, color: C.violet,
                  textDecoration: 'none', padding: '6px 12px',
                  background: C.violetBg, border: `1px solid ${C.violetBorder}`,
                  borderRadius: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                danbuildss/x402-reliability-spec
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
          <a href="https://usecortx.dev" style={{ fontSize: 12, color: C.textDim, textDecoration: 'none', fontWeight: 600 }}>
            CORTX
          </a>
          <span style={{ fontSize: 12, color: C.textDim }}> · x402 payment reliability monitoring</span>
        </div>
      </div>
    </div>
  );
}
