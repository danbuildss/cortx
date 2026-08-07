'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StageResult } from '@/lib/check-runner/types';

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

type StageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

function Spinner() {
  return (
    <>
      <style>{`@keyframes rs{to{transform:rotate(360deg)}}`}</style>
      <span style={{
        width: 12, height: 12, borderRadius: '50%',
        border: '1.5px solid var(--border-default)',
        borderTopColor: 'var(--text-secondary)',
        display: 'inline-block',
        animation: 'rs 0.7s linear infinite',
      }} />
    </>
  );
}

function StageRow({ label, status, error }: { label: string; status: StageStatus; error?: string }) {
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

export function RunCheckButton({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stageProgress, setStageProgress] = useState<Record<string, StageStatus>>({});
  const [result, setResult] = useState<{ status: string; stages: StageResult[]; failure_stage: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    setError(null);
    setOpen(true);

    // Animate stages sequentially while the check runs
    const progress: Record<string, StageStatus> = {};
    for (const s of STAGE_ORDER) progress[s] = 'pending';
    setStageProgress({ ...progress });

    let currentStage = 0;
    const animInterval = setInterval(() => {
      if (currentStage < STAGE_ORDER.length) {
        const s = STAGE_ORDER[currentStage];
        setStageProgress(prev => ({ ...prev, [s]: 'running' }));
        currentStage++;
      }
    }, 1800);

    try {
      const res = await fetch('/api/checks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });
      clearInterval(animInterval);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Check failed');
        setLoading(false);
        return;
      }

      // Apply real stage results
      const finalProgress: Record<string, StageStatus> = {};
      for (const s of STAGE_ORDER) {
        const sr = (data.stages as StageResult[]).find(r => r.stage === s);
        if (!sr) { finalProgress[s] = 'pending'; continue; }
        if (sr.passed === null) finalProgress[s] = 'skipped';
        else finalProgress[s] = sr.passed ? 'passed' : 'failed';
      }
      setStageProgress(finalProgress);
      setResult({ status: data.status, stages: data.stages, failure_stage: data.failure_stage });
    } catch {
      clearInterval(animInterval);
      setError('Network error — try again');
    }
    setLoading(false);
  }

  function close() {
    setOpen(false);
    router.refresh();
  }

  const passed = result?.status === 'passed';
  const passedCount = result ? result.stages.filter(s => s.passed).length : 0;
  const totalCount = result ? result.stages.filter(s => s.passed !== null).length : 0;

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: '7px 14px',
          background: 'var(--bg-elevated)',
          color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 6, fontSize: 13,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 400,
        }}
      >
        {loading ? 'Running…' : 'Run check'}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={!loading ? close : undefined}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1001,
            width: 420,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-mid)',
            borderRadius: 10,
            padding: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              7-stage verification
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
              {loading ? 'Running check…' : result ? (passed ? 'All stages passed' : `Failed at ${result.failure_stage ?? 'unknown'}`) : ''}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {STAGE_ORDER.map(s => {
                const sr = result?.stages.find(r => r.stage === s);
                return (
                  <StageRow
                    key={s}
                    label={STAGE_LABELS[s]}
                    status={stageProgress[s] ?? 'pending'}
                    error={sr?.error}
                  />
                );
              })}
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--status-critical)', marginBottom: 16 }}>{error}</div>
            )}

            {result && (
              <div style={{
                padding: '12px 16px', borderRadius: 7, marginBottom: 16,
                background: passed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                fontSize: 13,
                color: passed ? 'var(--status-operational)' : 'var(--status-critical)',
                fontWeight: 500,
              }}>
                {passed
                  ? `${passedCount} of ${STAGE_ORDER.length} checks passed`
                  : `${passedCount} of ${totalCount} checks passed · failed at ${result.failure_stage ?? 'unknown'}`}
              </div>
            )}

            {!loading && (
              <button
                onClick={close}
                style={{
                  width: '100%', padding: '9px 0',
                  background: 'var(--text-primary)', color: 'var(--bg-page)',
                  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {result ? 'Done' : 'Dismiss'}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
