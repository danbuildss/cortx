import type { CheckResult } from './types';

export async function runLightweightCheck(
  serviceId: string,
  endpointUrl: string
): Promise<CheckResult> {
  const started_at = new Date();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let status: number;
    let latency_ms: number;

    try {
      const t0 = Date.now();
      const res = await fetch(endpointUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      latency_ms = Date.now() - t0;
      status = res.status;
    } catch {
      // HEAD not supported; fall back to GET
      const t0 = Date.now();
      const res = await fetch(endpointUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      latency_ms = Date.now() - t0;
      status = res.status;
    } finally {
      clearTimeout(timeout);
    }

    const reachable = status < 500;
    const completed_at = new Date();

    return {
      service_id: serviceId,
      started_at,
      completed_at,
      latency_ms,
      status: reachable ? 'passed' : 'failed',
      failure_stage: reachable ? null : 'availability',
      stages: [
        {
          stage: 'availability',
          passed: reachable,
          duration_ms: latency_ms,
          evidence: { http_status: status },
          error: reachable ? undefined : `HTTP ${status}`,
        },
      ],
      observed_price: null,
      error_message: null,
      check_type: 'lightweight',
    };
  } catch (err) {
    const completed_at = new Date();
    const msg = err instanceof Error ? err.message : String(err);
    return {
      service_id: serviceId,
      started_at,
      completed_at,
      latency_ms: null,
      status: 'error',
      failure_stage: null,
      stages: [],
      observed_price: null,
      error_message: msg,
      check_type: 'lightweight',
    };
  }
}
