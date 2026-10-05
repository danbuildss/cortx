// Free probe (spec §9): "does this URL answer with valid x402 payment terms?"
// It can never pay: no payment headers, no signing, no wallet, no cookies or
// auth. Only GET, plus POST with an empty JSON body when GET didn't 402 —
// never a body taken from a listing (third parties control listings).
import { safeFetch, SafeFetchError, type SafeFetchOptions } from '../../lib/net/safe-fetch';
import {
  findFacilitatorUrl,
  parsePaymentRequired,
  priceToUsdc,
  selectPaymentOption,
} from '../../lib/check-runner/x402';
import type { ProbeRecord } from './store';

const BLOCKED_CODES = new Set(['SSRF_BLOCKED', 'NON_HTTPS', 'BLOCKED_PORT', 'CREDENTIALS_IN_URL', 'INVALID_URL']);
const MAX_PROBE_BYTES = 64 * 1024;
// x402 middleware answers 402 before reading the body, so the body never needs content
const POST_BODY = '{}';

export type ProbeTarget = {
  /** Concrete URL to call */
  url: string;
  http_method: string;
};

export type ProbeDeps = {
  userAgent: string;
  allowedPorts?: readonly number[];
  fetchOptions?: SafeFetchOptions; // test seams only
};

// The only headers a probe ever sends
export function probeHeaders(userAgent: string, json = false): Record<string, string> {
  return {
    'user-agent': userAgent,
    accept: 'application/json',
    ...(json ? { 'content-type': 'application/json' } : {}),
  };
}

function record(partial: Partial<ProbeRecord> & Pick<ProbeRecord, 'outcome'>): ProbeRecord {
  return {
    at: new Date().toISOString(),
    method: null, http_status: null, latency_ms: null, error: null, terms_source: null, x402_version: null,
    network: null, asset: null, scheme: null, transfer_method: null, price_atomic: null, price_usdc: null,
    pay_to: null, facilitator_published: false,
    ...partial,
  };
}

export async function probe(target: ProbeTarget, deps: ProbeDeps): Promise<ProbeRecord> {
  const base = { timeoutMs: 10_000, maxBytes: MAX_PROBE_BYTES, maxRedirects: 2, allowedPorts: deps.allowedPorts, ...deps.fetchOptions };
  let res;
  let method: 'GET' | 'POST' = 'GET';
  try {
    res = await safeFetch(target.url, { ...base, method: 'GET', headers: probeHeaders(deps.userAgent) });
    if (res.status !== 402 && target.http_method === 'POST') {
      method = 'POST';
      res = await safeFetch(target.url, { ...base, method: 'POST', headers: probeHeaders(deps.userAgent, true), body: POST_BODY });
    }
  } catch (err) {
    const code = err instanceof SafeFetchError ? err.code : 'UNREACHABLE';
    return record({ outcome: BLOCKED_CODES.has(code) ? 'blocked' : 'unreachable', method, error: code });
  }

  const meta = { method, http_status: res.status, latency_ms: res.durationMs };
  if (res.status >= 500) return record({ outcome: 'unreachable', ...meta, error: `HTTP_${res.status}` });
  if (res.status !== 402) return record({ outcome: 'not_x402', ...meta });

  const parsed = parsePaymentRequired(res.body, res.headers);
  if (!parsed) return record({ outcome: 'invalid_terms', ...meta, error: 'UNPARSEABLE_TERMS' });

  // The option CORTX would pay; if there's no Base option, report the first
  // one so the classifier can say which network it's on
  const option = selectPaymentOption(parsed.options) ?? parsed.options[0];
  if (!option?.payTo || !option.amount) return record({ outcome: 'invalid_terms', ...meta, error: 'MISSING_FIELDS' });

  const transfer = option.extra?.assetTransferMethod;
  return record({
    outcome: 'ok',
    ...meta,
    terms_source: parsed.source,
    x402_version: parsed.version,
    network: option.network,
    asset: option.asset,
    scheme: option.scheme,
    transfer_method: typeof transfer === 'string' ? transfer : null,
    price_atomic: option.amount,
    price_usdc: priceToUsdc(option)?.usdc ?? null,
    pay_to: option.payTo,
    facilitator_published: findFacilitatorUrl(parsed, option) != null,
  });
}
