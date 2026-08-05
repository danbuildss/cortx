import type { StageResult, CheckStatus, ServiceStatus, ClassifyResult, StageName } from './types';

const CRITICAL_STAGES = new Set<StageName>(['payment', 'delivery', 'json_parse', 'schema_validation']);

export function classifyStatus(
  stages: StageResult[],
  latency_ms: number,
  latency_threshold_ms: number
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

  if (latency_ms > latency_threshold_ms) {
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
