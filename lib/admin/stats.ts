/**
 * Numbers for the admin page. Pure functions — the page fetches rows with the
 * service role and uses these to count them the same way the spend caps and
 * the check runner do.
 */

export type PaidCheck = { started_at: string; observed_price: string | number | null };
export type CheckLite = { status: string; failure_stage: string | null };

// Checks that count as the service working (`success` is the legacy name)
export const SUCCESS_STATUSES = ['passed', 'success'] as const;

export function isSuccess(status: string): boolean {
  return (SUCCESS_STATUSES as readonly string[]).includes(status);
}

// `error` = CORTX-side problem (our wallet, budget, a facilitator that needs a
// login), not the service's fault — see lib/check-runner/classify.ts
export function isCortxSide(status: string): boolean {
  return status === 'error';
}

/**
 * Success rate over checks that judged the service. CORTX-side errors are left
 * out of both sides so our own problems don't count against a builder.
 */
export function successRate(total: number, success: number, cortxErrors: number): string | null {
  const judged = total - cortxErrors;
  if (judged <= 0) return null;
  return (Math.min(success, judged) / judged * 100).toFixed(1);
}

/** Sum of paid-check prices, optionally only checks started at or after `sinceMs`. */
export function sumPaid(rows: PaidCheck[], sinceMs?: number): number {
  let total = 0;
  for (const r of rows) {
    if (sinceMs !== undefined && new Date(r.started_at).getTime() < sinceMs) continue;
    const p = parseFloat(String(r.observed_price ?? '0'));
    if (Number.isFinite(p)) total += p;
  }
  return total;
}

/** USDC amount for display: 4 decimals under $1 so small spend never shows as $0.00. */
export function formatUsdc(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0.00';
  return n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

export type StageCount = [stage: string, count: number];

/**
 * Stage failures split into the service's failures and CORTX-side errors, each
 * sorted by count (most first).
 */
export function splitStageFailures(checks: CheckLite[]): { service: StageCount[]; cortx: StageCount[] } {
  const service = new Map<string, number>();
  const cortx = new Map<string, number>();
  for (const c of checks) {
    if (!c.failure_stage || isSuccess(c.status)) continue;
    const bucket = isCortxSide(c.status) ? cortx : service;
    bucket.set(c.failure_stage, (bucket.get(c.failure_stage) ?? 0) + 1);
  }
  const sorted = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  return { service: sorted(service), cortx: sorted(cortx) };
}
