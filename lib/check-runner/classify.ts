import type { StageResult, CheckStatus, ServiceStatus, ClassifyResult, StageName } from './types';

const CRITICAL_STAGES = new Set<StageName>(['payment', 'facilitator_verify', 'delivery', 'json_parse', 'schema_validation']);

// Payment-stage failures caused by CORTX's own wallet or verification budget,
// not by the monitored service. The payment stage never contacts the service
// (signing is local), so these must be recorded as infrastructure errors:
// they never change a builder's service status, open an incident, or count
// against public reliability metrics.
const CORTX_SIDE_PAYMENT_CODES = new Set<string>([
  'WALLET_NOT_CONFIGURED',
  'INSUFFICIENT_BALANCE',
  'BALANCE_READ_FAILED',
  'SPEND_RESERVATION_FAILED',
  'DAILY_SPEND_CAP_EXCEEDED',
  'MONTHLY_SPEND_CAP_EXCEEDED',
  'PAYMENT_TIMEOUT',
  'UNSUPPORTED_PAYMENT_METHOD', // a payment scheme CORTX can't sign yet (e.g. Permit2)
]);

export function isCortxSidePaymentFailure(code: string | null | undefined): boolean {
  return code != null && CORTX_SIDE_PAYMENT_CODES.has(code);
}

export function classifyStatus(
  stages: StageResult[],
  latency_ms: number,
  latency_threshold_ms?: number
): ClassifyResult {
  const failed = stages.find((s) => s.passed === false);

  if (failed) {
    const isCritical = CRITICAL_STAGES.has(failed.stage);
    return {
      check_status: 'failed',
      service_status: isCritical ? 'critical' : 'degraded',
      failure_stage: failed.stage,
    };
  }

  if (latency_threshold_ms != null && latency_ms > latency_threshold_ms) {
    return {
      check_status: 'passed',
      service_status: 'degraded',
      failure_stage: null,
    };
  }

  return {
    check_status: 'passed',
    service_status: 'operational',
    failure_stage: null,
  };
}
