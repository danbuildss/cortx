// Scheduling and incident-tier rules shared by the cron and persistence.
// Pure functions so they can be unit tested.
import type { CheckType } from './types';

export const READINESS_INTERVAL_MINUTES = 15;
// Services that don't publish a facilitator are re-probed daily in case they start.
export const READINESS_UNAVAILABLE_RECHECK_MINUTES = 24 * 60;
// Paid checks for services with a working readiness check.
export const READINESS_PAID_INTERVAL_MINUTES = 24 * 60;

// Paid checks move to once a day for services whose readiness check is
// passing — but only after a passing paid check. A failing paid check keeps the
// regular interval, so a delivery problem is re-checked within hours and can
// still open an incident the same day.
export function paidIntervalMinutes(
  configuredMinutes: number,
  readinessStatus: string | null | undefined,
  paidCheckPassed: boolean
): number {
  if (readinessStatus === 'ready' && paidCheckPassed) {
    return Math.max(configuredMinutes, READINESS_PAID_INTERVAL_MINUTES);
  }
  return configuredMinutes;
}

// Incident resolution hierarchy: a passing check only resolves incidents opened
// by the same tier or lower. Lightweight never resolves; readiness resolves
// readiness; canary resolves canary + readiness; full resolves everything.
export const CHECK_TIER: Record<CheckType, number> = {
  lightweight: 0,
  readiness: 1,
  canary: 2,
  full: 3,
};

export function canResolveIncident(passingType: CheckType, triggerType: CheckType): boolean {
  return passingType !== 'lightweight' && CHECK_TIER[passingType] >= CHECK_TIER[triggerType];
}

const SEVERITY: Record<string, number> = { unknown: 0, operational: 0, degraded: 1, critical: 2 };

// The worse of two service statuses (used when a readiness failure must not
// hide a more severe problem already found by a paid check).
export function worseStatus<T extends string>(a: T, b: T): T {
  return (SEVERITY[b] ?? 0) > (SEVERITY[a] ?? 0) ? b : a;
}
