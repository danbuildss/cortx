'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';

type StageRow = {
  stage: string;
  passed: boolean | null;
  duration_ms: number | null;
  evidence: Record<string, unknown> | null;
  error?: string;
};

export type CheckRecord = {
  id: string;
  status: string;
  latency_ms: number | null;
  started_at: string;
  failure_stage: string | null;
  stages: unknown;
  check_type: string | null;
};

const CHECK_COLOR: Record<string, string> = {
  passed: 'var(--status-operational)',
  failed: 'var(--status-critical)',
  error:  'var(--status-degraded)',
};

const TYPE_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  lightweight: { label: 'ping',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  canary:      { label: 'canary', color: '#d97706', bg: 'rgba(217,119,6,0.12)'   },
  full:        { label: 'full',   color: '#2563eb', bg: 'rgba(37,99,235,0.12)'   },
};

function SummaryCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-mid)',
      borderRadius: 6,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function StageBreakdown({ check }: { check: CheckRecord }) {
  const stages = (check.stages as StageRow[] | null) ?? [];

  return (
    <div>
      {/* Summary row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 8,
        marginBottom: 12,
      }}>
        <SummaryCard label="Status">
          <span style={{ fontSize: 13, fontWeight: 600, color: CHECK_COLOR[check.status] ?? 'var(--text-muted)' }}>
            {check.status}
          </span>
        </SummaryCard>
        <SummaryCard label="Checked at">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {new Date(check.started_at).toLocaleString()}
          </span>
        </SummaryCard>
        <SummaryCard label="Total latency">
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>
            {check.latency_ms != null ? `${check.latency_ms}ms` : '—'}
          </span>
        </SummaryCard>
        {check.failure_stage && (
          <SummaryCard label="Failed stage">
            <span style={{ fontSize: 13, color: 'var(--status-critical)', fontFamily: 'var(--font-geist-mono)' }}>
              {check.failure_stage}
            </span>
          </SummaryCard>
        )}
      </div>

      {/* Stage rows */}
      {stages.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
          No stage data stored for this check.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stages.map((s) => {
            const color = s.passed === true
              ? 'var(--status-operational)'
              : s.passed === false
              ? 'var(--status-critical)'
              : 'var(--text-muted)';
            const icon = s.passed === true ? '✓' : s.passed === false ? '✗' : '·';
            return (
              <div key={s.stage} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-mid)',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: s.evidence ? 8 : 0 }}>
                  <span style={{ fontSize: 13, color, fontWeight: 600, width: 16, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>
                    {s.stage}
                  </span>
                  {s.error && (
                    <span style={{ fontSize: 12, color: 'var(--status-critical)', marginLeft: 8 }}>
                      {s.error}
                    </span>
                  )}
                  {s.duration_ms != null && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {s.duration_ms}ms
                    </span>
                  )}
                </div>
                {s.evidence && (
                  <pre style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-geist-mono)',
                    background: 'var(--bg-elevated)',
                    padding: '8px 10px',
                    borderRadius: 4,
                    overflowX: 'auto',
                    margin: '0 0 0 26px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(s.evidence, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChecksPanel({ checks }: { checks: CheckRecord[] }) {
  const [selectedId, setSelectedId] = useState<string>(checks[0]?.id ?? '');

  const selectedCheck = checks.find(c => c.id === selectedId) ?? checks[0] ?? null;

  if (checks.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-mid)',
        borderRadius: 8,
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          No checks in this window. Use &ldquo;Run check&rdquo; above or wait for the next scheduled run.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Checks table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-mid)',
        borderRadius: 8,
        overflowX: 'auto',
        marginBottom: 16,
      }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
              {([
                { label: 'Time',         hide: false },
                { label: 'Type',         hide: true  },
                { label: 'Status',       hide: false },
                { label: 'Latency',      hide: false },
                { label: 'Failed stage', hide: true  },
              ] as { label: string; hide: boolean }[]).map(({ label, hide }) => (
                <th
                  key={label}
                  className={hide ? 'mobile-hide' : undefined}
                  style={{
                    textAlign: 'left',
                    padding: '10px 16px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map((chk, i) => {
              const isSelected = chk.id === selectedId;
              const isLast = i === checks.length - 1;
              return (
                <tr
                  key={chk.id}
                  className="check-row"
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(chk.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(chk.id);
                    }
                  }}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-elevated)' : undefined,
                  }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {new Date(chk.started_at).toLocaleString()}
                      {isSelected && (
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>▶</span>
                      )}
                    </span>
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                    {(() => {
                      const chip = TYPE_CHIP[chk.check_type ?? 'full'] ?? TYPE_CHIP.full;
                      return (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: chip.color,
                          background: chip.bg,
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}>
                          {chip.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 12,
                      color: CHECK_COLOR[chk.status] ?? 'var(--text-muted)',
                      fontWeight: 500,
                    }}>
                      {chk.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {chk.latency_ms != null ? `${chk.latency_ms}ms` : '—'}
                  </td>
                  <td
                    className="mobile-hide"
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      color: 'var(--status-critical)',
                      fontFamily: 'var(--font-geist-mono)',
                    }}
                  >
                    {chk.failure_stage ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stage breakdown for selected check */}
      {selectedCheck && (
        <div>
          <h2 style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-muted)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Check detail — {new Date(selectedCheck.started_at).toLocaleString()}
          </h2>
          <StageBreakdown check={selectedCheck} />
        </div>
      )}
    </>
  );
}
