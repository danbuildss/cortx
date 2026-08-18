'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { StageResult } from '@/lib/check-runner/types';

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'detect' | 'configure' | 'running' | 'done';

interface Detected {
  endpoint_url?: string;
  name?: string;
  method?: string;
  environment?: 'mainnet' | 'testnet';
  network_display?: string;
  asset?: string;
  expected_price?: string;
  max_price?: string;
  recipient_display?: string;
  recipient_full?: string;
  description?: string;
  input_schema?: object;
  output_schema?: object;
}

type Preset = 'conservative' | 'standard' | 'high';

const BETA_MAX_ENDPOINT_PRICE_USDC = 1.00;

const PRESETS: Record<Preset, { label: string; desc: string; intervalMin: number; checksPerMonth: number }> = {
  conservative: { label: 'Conservative', desc: 'Every 6 hours', intervalMin: 360, checksPerMonth: 120 },
  standard:     { label: 'Standard',     desc: 'Every hour',    intervalMin: 60,  checksPerMonth: 720 },
  high:         { label: 'High frequency', desc: 'Every 15 min', intervalMin: 15,  checksPerMonth: 2880 },
};

const STAGE_LABELS: Record<string, string> = {
  availability:      'Availability',
  payment_terms:     'Payment terms',
  price_check:       'Price check',
  payment:           'Payment',
  delivery:          'Delivery',
  json_parse:        'JSON parse',
  schema_validation: 'Schema validation',
};
const STAGE_ORDER = Object.keys(STAGE_LABELS);

// ── Main Wizard ───────────────────────────────────────────────────────────────

export function OnboardWizard({ initialTelegramConnected, hasWallet }: { initialTelegramConnected: boolean; hasWallet: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('detect');

  // Step 1 state
  const [url, setUrl] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [detected, setDetected] = useState<Detected | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [debugStatus, setDebugStatus] = useState<number | null>(null);

  // Step 2 state
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'mainnet' | 'testnet'>('mainnet');
  const [testPayload, setTestPayload] = useState('{}');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [preset, setPreset] = useState<Preset>('standard');
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(initialTelegramConnected);
  const [telegramWaiting, setTelegramWaiting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expectedSchema, setExpectedSchema] = useState('{"type":"object"}');
  const [latencyThreshold, setLatencyThreshold] = useState('10000');
  const [configError, setConfigError] = useState('');
  const [connectingTg, setConnectingTg] = useState(false);

  const tgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3 state
  const [stageProgress, setStageProgress] = useState<Record<string, 'pending' | 'running' | 'passed' | 'failed' | 'skipped'>>({});
  const [checkResult, setCheckResult] = useState<{ status: string; stages: StageResult[]; failure_stage: string | null; serviceId: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');

  useEffect(() => () => {
    if (tgPollRef.current) clearInterval(tgPollRef.current);
    if (tgTimeoutRef.current) clearTimeout(tgTimeoutRef.current);
  }, []);

  // ── Step 1: Detect ─────────────────────────────────────────────────────────

  async function detect() {
    if (!url.trim()) return;
    setDetectError('');
    setDetecting(true);
    setDetected(null);
    try {
      const res = await fetch('/api/services/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setDetectError(data.error ?? 'Detection failed'); setDetecting(false); return; }
      setDetected(data.detected);
      setMissing(data.missing ?? []);
      setDebugStatus(data._debug?.status ?? null);
      // Pre-fill step 2
      setName(data.detected.name ?? '');
      setEnvironment(data.detected.environment ?? 'mainnet');
      setExpectedPrice(data.detected.expected_price ?? '');
      setMaxPrice(data.detected.max_price ?? '');
      if (data.detected.input_schema) setTestPayload(JSON.stringify(data.detected.input_schema.properties ? {} : {}, null, 2));
      if (data.detected.output_schema) setExpectedSchema(JSON.stringify(data.detected.output_schema, null, 2));
    } catch { setDetectError('Could not reach endpoint'); }
    setDetecting(false);
  }

  function goToConfigure() {
    setStep('configure');
    window.scrollTo(0, 0);
  }

  // ── Telegram connect (step 2) ──────────────────────────────────────────────

  async function startTgConnect() {
    setConnectingTg(true);
    const win = window.open('', '_blank');
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { win?.close(); setConnectingTg(false); return; }
      if (win) win.location.href = data.deepLinkUrl;
      else window.location.href = data.deepLinkUrl;
      setConnectingTg(false);
      setTelegramWaiting(true);
      tgPollRef.current = setInterval(async () => {
        const r = await fetch('/api/telegram/status');
        const d = await r.json();
        if (d.connected) {
          setTelegramConnected(true);
          setTelegramWaiting(false);
          if (tgPollRef.current) clearInterval(tgPollRef.current);
          if (tgTimeoutRef.current) clearTimeout(tgTimeoutRef.current);
        }
      }, 3000);
      tgTimeoutRef.current = setTimeout(() => {
        if (tgPollRef.current) clearInterval(tgPollRef.current);
        setTelegramWaiting(false);
      }, 10 * 60 * 1000);
    } catch { win?.close(); setConnectingTg(false); }
  }

  // ── Step 2 → Step 3 ───────────────────────────────────────────────────────

  function goToRun() {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Service name required');
    if (!expectedPrice || isNaN(parseFloat(expectedPrice))) errors.push('Expected price required');
    if (!maxPrice || isNaN(parseFloat(maxPrice))) errors.push('Max price required');
    if (parseFloat(expectedPrice) > BETA_MAX_ENDPOINT_PRICE_USDC || parseFloat(maxPrice) > BETA_MAX_ENDPOINT_PRICE_USDC) {
      errors.push(`Endpoints are capped at $${BETA_MAX_ENDPOINT_PRICE_USDC.toFixed(2)} USDC per call. Lower your expected and max price to continue.`);
    }
    try { JSON.parse(testPayload); } catch { errors.push('Test payload must be valid JSON'); }
    try { JSON.parse(expectedSchema); } catch { errors.push('Expected schema must be valid JSON'); }
    if (!safetyConfirmed) errors.push('Please confirm the payload is safe');
    if (errors.length > 0) { setConfigError(errors[0]); return; }
    setConfigError('');
    setStep('running');
    window.scrollTo(0, 0);
    runFirstCheck();
  }

  // ── Step 3: Run check ─────────────────────────────────────────────────────

  async function runFirstCheck() {
    setRunning(true);
    setRunError('');

    // Start stage animation
    const progress: Record<string, 'pending' | 'running' | 'passed' | 'failed' | 'skipped'> = {};
    for (const s of STAGE_ORDER) progress[s] = 'pending';
    setStageProgress({ ...progress });

    let currentStage = 0;
    const animInterval = setInterval(() => {
      if (currentStage < STAGE_ORDER.length) {
        const stage = STAGE_ORDER[currentStage];
        setStageProgress(prev => ({ ...prev, [stage]: 'running' }));
        currentStage++;
      }
    }, 1800);

    try {
      const res = await fetch('/api/services/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          endpoint_url: detected?.endpoint_url ?? url.trim(),
          environment,
          test_input: JSON.parse(testPayload),
          expected_schema: JSON.parse(expectedSchema),
          expected_price: expectedPrice,
          max_price: maxPrice,
          check_interval_minutes: PRESETS[preset].intervalMin,
          latency_threshold_ms: parseInt(latencyThreshold, 10),
        }),
      });

      clearInterval(animInterval);
      const data = await res.json();

      if (!res.ok) {
        setRunError(data.error ?? 'Check failed');
        setRunning(false);
        return;
      }

      // Apply actual results to stage progress
      const finalProgress: Record<string, 'pending' | 'running' | 'passed' | 'failed' | 'skipped'> = {};
      for (const s of STAGE_ORDER) {
        const stageResult = (data.stages as StageResult[]).find(r => r.stage === s);
        if (!stageResult) { finalProgress[s] = 'pending'; continue; }
        if (stageResult.passed === null) finalProgress[s] = 'skipped';
        else if (stageResult.passed) finalProgress[s] = 'passed';
        else finalProgress[s] = 'failed';
      }
      setStageProgress(finalProgress);
      setCheckResult({ status: data.status, stages: data.stages, failure_stage: data.failure_stage, serviceId: data.serviceId });

      if (data.status === 'passed') {
        setTimeout(() => router.push(`/services/${data.serviceId}`), 3000);
      }

    } catch {
      clearInterval(animInterval);
      setRunError('Network error — service was created, check the dashboard');
    }
    setRunning(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/overview" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Overview</Link>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Add service</h1>
          <StepPill step={step} />
        </div>
      </div>

      {step === 'detect' && (
        <DetectStep
          url={url} setUrl={setUrl}
          detecting={detecting} detectError={detectError}
          detected={detected} missing={missing}
          debugStatus={debugStatus}
          onDetect={detect} onContinue={goToConfigure}
        />
      )}

      {step === 'configure' && detected && (
        <ConfigureStep
          detected={detected} missing={missing}
          name={name} setName={setName}
          environment={environment} setEnvironment={setEnvironment}
          testPayload={testPayload} setTestPayload={setTestPayload}
          expectedPrice={expectedPrice} setExpectedPrice={setExpectedPrice}
          maxPrice={maxPrice} setMaxPrice={setMaxPrice}
          preset={preset} setPreset={setPreset}
          safetyConfirmed={safetyConfirmed} setSafetyConfirmed={setSafetyConfirmed}
          telegramConnected={telegramConnected} telegramWaiting={telegramWaiting}
          connectingTg={connectingTg} onTgConnect={startTgConnect}
          showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
          expectedSchema={expectedSchema} setExpectedSchema={setExpectedSchema}
          latencyThreshold={latencyThreshold} setLatencyThreshold={setLatencyThreshold}
          configError={configError}
          onBack={() => setStep('detect')} onContinue={goToRun}
        />
      )}

      {(step === 'running' || step === 'done') && (
        <RunStep
          detected={detected} url={url}
          name={name} expectedPrice={expectedPrice} maxPrice={maxPrice}
          preset={preset} stageProgress={stageProgress}
          checkResult={checkResult} running={running} runError={runError}
          onRetry={() => { setStep('configure'); setCheckResult(null); }}
          hasWallet={hasWallet}
        />
      )}
    </div>
  );
}

// ── Step Pill ─────────────────────────────────────────────────────────────────

function StepPill({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    detect: 'Step 1 of 3 — Detect',
    configure: 'Step 2 of 3 — Configure',
    running: 'Step 3 of 3 — First check',
    done: 'Step 3 of 3 — First check',
  };
  return (
    <span style={{
      fontSize: 11, padding: '3px 8px', borderRadius: 99,
      background: 'var(--bg-muted)', color: 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {labels[step]}
    </span>
  );
}

// ── Step 1: Detect ────────────────────────────────────────────────────────────

function DetectStep({
  url, setUrl, detecting, detectError, detected, missing, debugStatus, onDetect, onContinue,
}: {
  url: string; setUrl: (v: string) => void;
  detecting: boolean; detectError: string;
  detected: Detected | null; missing: string[];
  debugStatus: number | null;
  onDetect: () => void; onContinue: () => void;
}) {
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter') onDetect(); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Endpoint URL
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="app-input"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKey}
            placeholder="https://x402.bankr.bot/api/v1/research"
            autoFocus
          />
          <button
            onClick={onDetect}
            disabled={detecting || !url.trim()}
            style={{
              padding: '8px 20px', flexShrink: 0,
              background: (!url.trim() || detecting) ? 'var(--border-default)' : 'var(--text-primary)',
              color: 'var(--bg-page)',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: (!url.trim() || detecting) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {detecting ? <DetectingDots /> : 'Detect service'}
          </button>
        </div>
        {detectError && (
          <p style={{ fontSize: 12, color: 'var(--status-critical)', marginTop: 10 }}>{detectError}</p>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          Paste your x402 endpoint URL. CORTX will inspect it and auto-detect service details.
        </p>
      </div>

      {detected && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Detected
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DetectRow label="Name"        value={detected.name}           field="name" missing={missing} />
            <DetectRow label="Network"     value={detected.network_display} field="network" missing={missing} />
            <DetectRow label="Asset"       value={detected.asset}          field="asset" missing={missing} />
            <DetectRow label="Observed price" value={detected.expected_price ? `${detected.expected_price} USDC` : undefined} field="price" missing={missing} />
            <DetectRow label="Max price"   value={detected.max_price ? `${detected.max_price} USDC` : undefined} field="price" missing={missing} />
            <DetectRow label="Recipient"   value={detected.recipient_display} field="recipient" missing={missing} />
            <DetectRow label="Description" value={detected.description}    field="description" missing={missing} />
          </div>
          {missing.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14 }}>
              Some values could not be detected and will use defaults — you can edit them in the next step.
              {debugStatus !== null && debugStatus !== 402 && (
                <span style={{ color: 'var(--status-degraded)' }}> Endpoint returned HTTP {debugStatus} instead of 402 — it may not be an x402 service.</span>
              )}
              {debugStatus === 402 && missing.includes('payment_terms') && (
                <span style={{ color: 'var(--status-degraded)' }}> Endpoint returned 402 but payment terms could not be parsed — please fill in price and network manually.</span>
              )}
            </p>
          )}
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button
              onClick={onContinue}
              style={{
                padding: '9px 24px',
                background: 'var(--text-primary)', color: 'var(--bg-page)',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Continue →
            </button>
            <button
              onClick={onDetect}
              style={{
                padding: '9px 16px', background: 'transparent',
                border: '1px solid var(--border-default)', borderRadius: 6,
                fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Re-detect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetectRow({ label, value, field, missing }: { label: string; value?: string; field: string; missing: string[] }) {
  const detected = value != null && !missing.includes(field);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)' }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: detected ? 'rgba(34,197,94,0.12)' : 'var(--bg-muted)',
        fontSize: 9, color: detected ? '#22c55e' : 'var(--text-dim)',
      }}>
        {detected ? '✓' : '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 12, color: detected ? 'var(--text-primary)' : 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)' }}>
        {detected ? value : 'not detected'}
      </div>
    </div>
  );
}

function DetectingDots() {
  return (
    <span style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--bg-page)',
          display: 'inline-block',
          animation: `dotpulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes dotpulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}

// ── Step 2: Configure ─────────────────────────────────────────────────────────

function ConfigureStep(props: {
  detected: Detected; missing: string[];
  name: string; setName: (v: string) => void;
  environment: 'mainnet' | 'testnet'; setEnvironment: (v: 'mainnet' | 'testnet') => void;
  testPayload: string; setTestPayload: (v: string) => void;
  expectedPrice: string; setExpectedPrice: (v: string) => void;
  maxPrice: string; setMaxPrice: (v: string) => void;
  preset: Preset; setPreset: (v: Preset) => void;
  safetyConfirmed: boolean; setSafetyConfirmed: (v: boolean) => void;
  telegramConnected: boolean; telegramWaiting: boolean;
  connectingTg: boolean; onTgConnect: () => void;
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void;
  expectedSchema: string; setExpectedSchema: (v: string) => void;
  latencyThreshold: string; setLatencyThreshold: (v: string) => void;
  configError: string;
  onBack: () => void; onContinue: () => void;
}) {
  const price = parseFloat(props.expectedPrice) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Service details */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 14 }}>Service details</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name</label>
          <input className="app-input" value={props.name} onChange={e => props.setName(e.target.value)} placeholder="My x402 API" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Observed price</label>
            <input className="app-input" type="number" value={props.expectedPrice} onChange={e => props.setExpectedPrice(e.target.value)} placeholder="0.001000" step="any" min="0.000001" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Max price (USDC)</label>
            <input className="app-input" type="number" value={props.maxPrice} onChange={e => props.setMaxPrice(e.target.value)} placeholder="0.001100" step="any" min="0.000001" />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Detected + 10%</div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Network</label>
          <select className="app-input" style={{ appearance: 'none' }} value={props.environment} onChange={e => props.setEnvironment(e.target.value as 'mainnet' | 'testnet')}>
            <option value="mainnet">Base Mainnet</option>
            <option value="testnet">Base Sepolia (Testnet)</option>
          </select>
        </div>
      </div>

      {/* Test payload */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Test payload</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          JSON sent with each check. Must not trigger irreversible or financially significant actions.
        </div>
        <textarea
          className="app-input"
          value={props.testPayload}
          onChange={e => props.setTestPayload(e.target.value)}
          rows={4}
          style={{ resize: 'vertical', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}
        />
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={props.safetyConfirmed}
            onChange={e => props.setSafetyConfirmed(e.target.checked)}
            style={{ marginTop: 1, accentColor: '#22c55e', flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            I confirm this payload does not trigger irreversible or financially significant actions
          </span>
        </label>
      </div>

      {/* Monitoring preset */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 14 }}>Monitoring frequency</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {(Object.entries(PRESETS) as [Preset, typeof PRESETS[Preset]][]).map(([key, p]) => {
            const monthlyCost = (price * p.checksPerMonth).toFixed(4);
            const selected = props.preset === key;
            return (
              <button
                key={key}
                onClick={() => props.setPreset(key)}
                style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: selected ? 'rgba(240,240,240,0.06)' : 'var(--bg-elevated)',
                  border: `1.5px solid ${selected ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 7, cursor: 'pointer',
                  transition: 'border-color 0.1s',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 3 }}>
                  {p.label} {key === 'standard' && <span style={{ fontSize: 10, color: 'var(--status-operational)' }}>recommended</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{p.desc}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-geist-mono)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  ~{monthlyCost} USDC/mo
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>Ping</span> — free availability check every 5 min (no payment, no USDC spend).
          </span>
          <span>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>Full verification</span> — paid x402 check at the frequency above. Cost shown is per month of verifications only.
          </span>
        </div>
      </div>

      {/* Telegram */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Telegram alerts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {props.telegramConnected ? 'Connected — you will receive incident alerts' : 'Get notified when incidents open or resolve'}
            </div>
          </div>
          {props.telegramConnected ? (
            <span style={{ fontSize: 12, color: 'var(--status-operational)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-operational)', display: 'inline-block' }} />
              Connected
            </span>
          ) : props.telegramWaiting ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting for Start…</span>
          ) : (
            <button
              onClick={props.onTgConnect}
              disabled={props.connectingTg}
              style={{
                padding: '6px 14px', background: 'transparent',
                border: '1px solid var(--border-default)', borderRadius: 6,
                fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              {props.connectingTg ? 'Opening…' : 'Connect Telegram'}
            </button>
          )}
        </div>
      </div>

      {/* Advanced settings */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
        <button
          onClick={() => props.setShowAdvanced(!props.showAdvanced)}
          style={{
            width: '100%', padding: '14px 20px', textAlign: 'left',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Advanced settings</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', transform: props.showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </button>
        {props.showAdvanced && (
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ marginBottom: 14, paddingTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Latency threshold (ms)</label>
              <input className="app-input" type="number" value={props.latencyThreshold} onChange={e => props.setLatencyThreshold(e.target.value)} min="500" step="500" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Expected response schema <span style={{ fontWeight: 400 }}>(JSON Schema)</span></label>
              <textarea
                className="app-input"
                value={props.expectedSchema}
                onChange={e => props.setExpectedSchema(e.target.value)}
                rows={5}
                style={{ resize: 'vertical', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}
              />
            </div>
          </div>
        )}
      </div>

      {props.configError && (
        <p style={{ fontSize: 12, color: 'var(--status-critical)' }}>{props.configError}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={props.onContinue}
          style={{
            flex: 1, padding: '10px 16px',
            background: 'var(--text-primary)', color: 'var(--bg-page)',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Confirm & run first check →
        </button>
        <button
          onClick={props.onBack}
          style={{
            padding: '10px 16px', background: 'transparent',
            border: '1px solid var(--border-default)', borderRadius: 6,
            fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Run ───────────────────────────────────────────────────────────────

function RunStep({
  detected, url, name, expectedPrice, maxPrice, preset,
  stageProgress, checkResult, running, runError, onRetry, hasWallet,
}: {
  detected: Detected | null; url: string;
  name: string; expectedPrice: string; maxPrice: string;
  preset: Preset;
  stageProgress: Record<string, 'pending' | 'running' | 'passed' | 'failed' | 'skipped'>;
  checkResult: { status: string; stages: StageResult[]; failure_stage: string | null; serviceId: string } | null;
  running: boolean; runError: string;
  onRetry: () => void;
  hasWallet: boolean;
}) {
  const endpoint = detected?.endpoint_url ?? url;
  const passed = checkResult?.status === 'passed';
  const failed = checkResult?.status === 'failed';
  const passedCount = checkResult ? checkResult.stages.filter(s => s.passed).length : 0;
  const totalCount = checkResult ? checkResult.stages.filter(s => s.passed !== null).length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Pre-flight summary */}
      {!checkResult && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Running first check
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PrefightRow label="Service" value={name} />
            <PrefightRow label="Endpoint" value={endpoint} mono />
            <PrefightRow label="Observed price" value={`${expectedPrice} USDC`} mono />
            <PrefightRow label="Max price" value={`${maxPrice} USDC`} mono />
            <PrefightRow label="Monitoring" value={PRESETS[preset].desc} />
          </div>
        </div>
      )}

      {/* Stages */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16 }}>7-stage verification</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STAGE_ORDER.map((s, i) => {
            const status = stageProgress[s] ?? 'pending';
            const stageResult = checkResult?.stages.find(r => r.stage === s);
            return (
              <StageRow
                key={s}
                label={STAGE_LABELS[s]}
                status={status}
                error={stageResult?.error}
                delay={i * 0.05}
              />
            );
          })}
        </div>
      </div>

      {/* Result */}
      {checkResult && (
        <div style={{
          background: passed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          borderRadius: 8, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{passed ? '✅' : '⚠️'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {passed ? 'Your service is live' : 'Check completed with failures'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {passed
              ? `${passedCount} of ${STAGE_ORDER.length} checks passed — redirecting to service page…`
              : `${passedCount} of ${totalCount} checks passed · Failed at ${checkResult.failure_stage ?? 'unknown stage'}`}
          </div>
          {failed && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Link href={`/services/${checkResult.serviceId}`} style={{
                padding: '8px 20px',
                background: 'var(--text-primary)', color: 'var(--bg-page)',
                borderRadius: 6, fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}>
                View service
              </Link>
              <button onClick={onRetry} style={{
                padding: '8px 16px', background: 'transparent',
                border: '1px solid var(--border-default)', borderRadius: 6,
                fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
              }}>
                Edit & retry
              </button>
            </div>
          )}

          {passed && !hasWallet && (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text-secondary)',
              textAlign: 'left',
            }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Tip:</span> You&apos;re on the free tier (2 endpoints).{' '}
              <Link href="/settings/account" style={{ color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Connect your wallet
              </Link>
              {' '}in Account Settings to unlock more with $CORTX.
            </div>
          )}
        </div>
      )}

      {runError && (
        <p style={{ fontSize: 12, color: 'var(--status-critical)' }}>{runError}</p>
      )}
    </div>
  );
}

function PrefightRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{
        color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-geist-mono)' : undefined,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  );
}

function StageRow({ label, status, error, delay }: {
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  error?: string;
  delay: number;
}) {
  const icon = {
    pending: <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>○</span>,
    running: <Spinner />,
    passed:  <span style={{ color: 'var(--status-operational)', fontSize: 12, fontWeight: 600 }}>✓</span>,
    failed:  <span style={{ color: 'var(--status-critical)', fontSize: 12, fontWeight: 600 }}>✕</span>,
    skipped: <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>,
  }[status];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-elevated)' }}>
      <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13,
          color: status === 'failed' ? 'var(--status-critical)' : status === 'passed' ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}>
          {label}
        </div>
        {error && status === 'failed' && (
          <div style={{ fontSize: 11, color: 'var(--status-critical)', marginTop: 2, opacity: 0.8 }}>{error}</div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        border: '1.5px solid var(--border-default)',
        borderTopColor: 'var(--text-secondary)',
        display: 'inline-block',
        animation: 'spin 0.7s linear infinite',
      }} />
    </>
  );
}
