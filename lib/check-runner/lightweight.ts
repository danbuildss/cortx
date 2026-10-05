import type { CheckResult } from './types';
import { fetchEndpoint } from './fetch-endpoint';
import { StageError } from './ssrf';
import { buildCheckContext } from './context';

const TIMEOUT_MS = 5_000; // per request; HEAD then GET stays within the old 10 s
// Codes that mean CORTX won't call this address at all (not a HEAD problem)
const REFUSED = new Set(['SSRF_BLOCKED', 'NON_HTTPS', 'BLOCKED_PORT', 'INVALID_URL', 'CREDENTIALS_IN_URL']);

export async function runLightweightCheck(
  serviceId: string,
  endpointUrl: string
): Promise<CheckResult> {
  const started_at = new Date();

  try {
    let status: number;
    let latency_ms: number;
    let method = 'HEAD';

    try {
      const t0 = Date.now();
      const res = await fetchEndpoint(endpointUrl, { method: 'HEAD' }, TIMEOUT_MS);
      latency_ms = Date.now() - t0;
      status = res.status;
    } catch (err) {
      // A refused address is final; anything else may just mean HEAD isn't supported
      if (err instanceof StageError && REFUSED.has(err.code)) throw err;
      const t0 = Date.now();
      method = 'GET';
      const res = await fetchEndpoint(endpointUrl, { method: 'GET' }, TIMEOUT_MS);
      latency_ms = Date.now() - t0;
      status = res.status;
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
          evidence: { http_status: status, method },
          error: reachable ? undefined : `HTTP ${status}`,
        },
      ],
      observed_price: null,
      error_message: null,
      check_type: 'lightweight',
      context: buildCheckContext({ endpoint_url: endpointUrl, method }),
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
      context: buildCheckContext({ endpoint_url: endpointUrl, method: null }),
    };
  }
}
