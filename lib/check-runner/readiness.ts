/**
 * Payment readiness check — zero settlement, no USDC moves.
 *
 * Probes the endpoint for its 402 payment terms, signs an EIP-3009
 * authorization for the advertised price, and asks the service's own
 * facilitator to /verify it (without /settle). A valid result means a real
 * agent's payment would be accepted right now.
 *
 * Limits:
 * - The x402 spec keeps the facilitator opaque to clients, so this only works
 *   for services that publish their facilitator (e.g. Bankr). Others come back
 *   `unavailable` and stay on the regular paid-check schedule.
 * - It checks the payment path, not the delivered data. Delivery and schema
 *   are only covered by paid checks.
 *
 * Facilitator /verify: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
 * (request { x402Version, paymentPayload, paymentRequirements } → { isValid, invalidReason })
 * Track 2 experiment that validated this approach: docs/track2-findings.md
 */

import { StageError, validateAndResolveUrl } from './ssrf';
import { assertSupportedMethod, getCheckAccount, resolveUsdcAsset, signExactAuthorization } from './payment';
import {
  atomicAmount,
  findFacilitatorUrl,
  isServiceSideVerifyRejection,
  parsePaymentRequired,
  priceToUsdc,
  type ParsedPaymentRequired,
  type PaymentOption,
} from './x402';
import type { CheckResult, StageName, StageResult } from './types';

const REQUEST_TIMEOUT_MS = 10_000;
const VERIFY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_MAX_BYTES = 1_048_576;
const USDC_BASE_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // lowercase

const CAIP2_TO_X402: Record<string, string> = {
  'eip155:8453':  'base',
  'eip155:84532': 'base-sepolia',
};

const NETWORK_ALIASES: Record<string, string[]> = {
  mainnet: ['base', 'eip155:8453'],
  testnet: ['base-sepolia', 'eip155:84532'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadinessStage = Extract<StageName, 'availability' | 'payment_terms' | 'price_check' | 'facilitator_verify'>;

export type ReadinessStageResult = StageResult & { stage: ReadinessStage };

/**
 * ready       — the facilitator would accept a payment right now
 * not_ready   — a real agent's payment would fail (service-side problem)
 * unavailable — can't check: the service doesn't publish its facilitator, or
 *               the facilitator requires authentication (401/403)
 * error       — CORTX-side problem (wallet, our request, blocked URL); not the service's fault
 */
export type ReadinessStatus = 'ready' | 'not_ready' | 'unavailable' | 'error';

export type ReadinessResult = {
  service_id: string;
  endpoint_url: string;
  started_at: Date;
  completed_at: Date | null;
  status: ReadinessStatus;
  failure_stage: ReadinessStage | null;
  stages: ReadinessStageResult[];
  observed_price: string | null;
  facilitator_url: string | null;
  facilitator_is_custom: boolean;
  facilitator_responded: boolean;
  verify_is_valid: boolean | null;
  verify_invalid_reason: string | null;
  authorization_ttl_seconds: number | null;
  error_message: string | null;
};

export type ReadinessConfig = {
  service_id: string;
  endpoint_url: string;
  max_price: string;
  environment: 'mainnet' | 'testnet';
  test_input?: Record<string, unknown> | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new StageError('TIMEOUT', `Request timed out after ${ms}ms`);
    }
    throw new StageError('UNREACHABLE', `Network error: ${err}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readBodyCapped(res: Response): Promise<string> {
  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
  if (contentLength > RESPONSE_BODY_MAX_BYTES) {
    throw new StageError('RESPONSE_TOO_LARGE', `Content-Length ${contentLength} exceeds limit`);
  }
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > RESPONSE_BODY_MAX_BYTES) throw new StageError('RESPONSE_TOO_LARGE', 'Body too large');
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(merged);
}

function redactKey(msg: string): string {
  return msg.replaceAll(process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__', '[REDACTED]');
}

// Builds the facilitator /verify request body for the service's protocol version.
function buildVerifyRequest(
  parsed: ParsedPaymentRequired,
  option: PaymentOption,
  asset: string,
  endpointUrl: string,
  signed: Awaited<ReturnType<typeof signExactAuthorization>>
): Record<string, unknown> {
  const payload = { signature: signed.signature, authorization: signed.authorization };

  if (parsed.version === 2) {
    return {
      x402Version: 2,
      paymentPayload: {
        x402Version: 2,
        resource: parsed.resource ?? { url: endpointUrl },
        accepted: option.raw,
        payload,
      },
      paymentRequirements: option.raw,
    };
  }

  // V1: requirements in the shape the x402 v1 facilitator expects. `resource`
  // must be a valid URL, so fall back to the endpoint when the service omits it.
  const network = CAIP2_TO_X402[option.network] ?? option.network;
  return {
    x402Version: 1,
    paymentPayload: { x402Version: 1, scheme: option.scheme, network, payload },
    paymentRequirements: {
      scheme: option.scheme,
      network,
      maxAmountRequired: signed.authorization.value,
      resource: option.resource ?? endpointUrl,
      description: option.description ?? '',
      mimeType: option.mimeType ?? 'application/json',
      payTo: option.payTo,
      maxTimeoutSeconds: option.maxTimeoutSeconds ?? 300,
      asset,
      extra: { name: 'USD Coin', version: '2', ...option.extra },
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runReadinessCheck(config: ReadinessConfig): Promise<ReadinessResult> {
  const started_at = new Date();
  const stages: ReadinessStageResult[] = [];
  let failure_stage: ReadinessStage | null = null;
  let observed_price: string | null = null;
  let facilitator_url: string | null = null;
  let facilitator_responded = false;
  let verify_is_valid: boolean | null = null;
  let verify_invalid_reason: string | null = null;
  let authorization_ttl_seconds: number | null = null;

  const remaining: ReadinessStage[] = ['availability', 'payment_terms', 'price_check', 'facilitator_verify'];
  const advance = (): ReadinessStage => remaining.shift()!;
  const markRemaining = () => {
    for (const s of remaining.splice(0)) stages.push({ stage: s, passed: null, duration_ms: null, evidence: null });
  };
  const pass = (s: ReadinessStage, duration_ms: number, evidence: Record<string, unknown>) => {
    stages.push({ stage: s, passed: true, duration_ms, evidence });
  };
  const fail = (s: ReadinessStage, error: string, evidence: Record<string, unknown> | null, duration_ms: number) => {
    stages.push({ stage: s, passed: false, duration_ms, evidence, error });
    failure_stage = s;
  };

  const done = (status: ReadinessStatus, error_message: string | null = null): ReadinessResult => {
    markRemaining();
    return {
      service_id: config.service_id,
      endpoint_url: config.endpoint_url,
      started_at,
      completed_at: new Date(),
      status,
      failure_stage,
      stages,
      observed_price,
      facilitator_url,
      facilitator_is_custom: facilitator_url != null,
      facilitator_responded,
      verify_is_valid,
      verify_invalid_reason,
      authorization_ttl_seconds,
      error_message: error_message ? redactKey(error_message) : null,
    };
  };

  try {
    // ── Stage 1: Availability — endpoint answers with 402 ──────────────────────
    const stageAvail = advance();
    let validatedUrl: URL;
    try {
      validatedUrl = await validateAndResolveUrl(config.endpoint_url);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'INVALID_URL';
      fail(stageAvail, code, { url: config.endpoint_url }, 0);
      return done('not_ready');
    }

    const t1 = Date.now();
    let response402: Response;
    let probeMethod: 'POST' | 'GET' = 'POST';
    try {
      response402 = await fetchWithTimeout(
        validatedUrl.toString(),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.test_input ?? {}) },
        REQUEST_TIMEOUT_MS
      );
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'UNREACHABLE';
      fail(stageAvail, code, { url: config.endpoint_url }, Date.now() - t1);
      return done('not_ready');
    }

    if (response402.status !== 402) {
      // Some endpoints only gate on GET
      try {
        const getResp = await fetchWithTimeout(validatedUrl.toString(), { method: 'GET' }, REQUEST_TIMEOUT_MS);
        if (getResp.status === 402) { response402 = getResp; probeMethod = 'GET'; }
      } catch { /* keep the POST response */ }
    }

    const d1 = Date.now() - t1;
    if (response402.status !== 402) {
      fail(stageAvail, 'UNEXPECTED_STATUS', { http_status: response402.status, expected: 402 }, d1);
      return done('not_ready');
    }
    pass(stageAvail, d1, { http_status: 402, response_time_ms: d1, probe_method: probeMethod });

    // ── Stage 2: Payment terms + facilitator discovery ─────────────────────────
    const stageTerms = advance();
    const t2 = Date.now();
    let rawBody: string;
    try {
      rawBody = await readBodyCapped(response402);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'INVALID_PAYMENT_TERMS';
      fail(stageTerms, code, { error: String(err) }, 0);
      return done('not_ready');
    }

    const parsed = parsePaymentRequired(rawBody, response402.headers);
    if (!parsed) {
      fail(stageTerms, 'INVALID_PAYMENT_TERMS', { body_preview: rawBody.slice(0, 200) }, Date.now() - t2);
      return done('not_ready');
    }

    const acceptedNetworks = NETWORK_ALIASES[config.environment] ?? NETWORK_ALIASES.mainnet;
    const onNetwork = parsed.options.filter((o) => acceptedNetworks.includes(o.network));
    const option = onNetwork.find((o) => ['usdc', USDC_BASE_ADDRESS].includes(o.asset.toLowerCase())) ?? onNetwork[0];

    if (!option) {
      fail(stageTerms, 'UNSUPPORTED_NETWORK', {
        expected: acceptedNetworks,
        available: parsed.options.map((o) => o.network),
      }, Date.now() - t2);
      return done('not_ready');
    }

    if (!option.payTo || !option.amount) {
      fail(stageTerms, 'MISSING_FIELDS', { has_pay_to: Boolean(option.payTo), has_amount: Boolean(option.amount) }, Date.now() - t2);
      return done('not_ready');
    }

    facilitator_url = findFacilitatorUrl(parsed, option);
    authorization_ttl_seconds = option.maxTimeoutSeconds ?? 60;

    const termsEvidence = {
      network: option.network,
      x402_protocol_version: `v${parsed.version}`,
      terms_source: parsed.source,
      facilitator_url,
    };

    if (!facilitator_url) {
      // Not a failure — the service simply doesn't publish its facilitator.
      pass(stageTerms, Date.now() - t2, { ...termsEvidence, readiness: 'unavailable' });
      return done('unavailable');
    }
    pass(stageTerms, Date.now() - t2, termsEvidence);

    // ── Stage 3: Price within the service's max ────────────────────────────────
    const stagePrice = advance();
    const price = priceToUsdc(option);
    if (!price || price.usdc <= 0) {
      fail(stagePrice, price ? 'ZERO_PRICE' : 'INVALID_PRICE_FORMAT', { raw_price_field: option.amount }, 0);
      return done('not_ready');
    }
    observed_price = price.usdc.toFixed(6);
    const maxPrice = parseFloat(config.max_price);
    if (price.usdc > maxPrice) {
      fail(stagePrice, 'PRICE_EXCEEDS_MAXIMUM', { observed_price, max_price: config.max_price }, 0);
      return done('not_ready');
    }
    pass(stagePrice, 0, { observed_price, max_price: config.max_price, atomic_units_detected: price.atomic });

    // ── Stage 4: Facilitator /verify — no USDC moves ───────────────────────────
    const stageVerify = advance();
    const t4 = Date.now();

    // The facilitator URL comes from the service — apply the same SSRF rules
    // as for endpoints before calling it.
    let verifyUrl: URL;
    try {
      verifyUrl = await validateAndResolveUrl(`${facilitator_url}/verify`);
    } catch (err) {
      fail(stageVerify, 'FACILITATOR_URL_BLOCKED', {
        facilitator_url,
        reason: err instanceof StageError ? err.code : 'INVALID_URL',
        cortx_side: true,
      }, Date.now() - t4);
      return done('error', 'Facilitator URL failed CORTX safety checks');
    }

    let requestBody: Record<string, unknown>;
    try {
      const asset = resolveUsdcAsset(option);          // NO_USDC_OPTION → service-side
      assertSupportedMethod(option);                   // UNSUPPORTED_PAYMENT_METHOD → CORTX-side
      const account = getCheckAccount();               // WALLET_NOT_CONFIGURED → CORTX-side
      if (atomicAmount(option) == null) throw new StageError('INVALID_PRICE_FORMAT', 'Unreadable amount');
      const signed = await signExactAuthorization(account, option, asset); // PAYMENT_SIGNING_FAILED → service-side
      requestBody = buildVerifyRequest(parsed, option, asset, config.endpoint_url, signed);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'PAYMENT_SIGNING_FAILED';
      const msg = redactKey(err instanceof Error ? err.message : String(err));
      const cortxSide = code === 'WALLET_NOT_CONFIGURED' || code === 'UNSUPPORTED_PAYMENT_METHOD';
      fail(stageVerify, code, { facilitator_url, error: msg, ...(cortxSide ? { cortx_side: true } : {}) }, Date.now() - t4);
      return cortxSide ? done('error', msg) : done('not_ready');
    }

    let rawStatus: number;
    let responseExcerpt = '';
    let parsedResponse: Record<string, unknown> = {};
    try {
      const res = await fetchWithTimeout(verifyUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        redirect: 'error', // never follow the facilitator somewhere we didn't validate
      }, VERIFY_TIMEOUT_MS);
      rawStatus = res.status;
      const text = await res.text().catch(() => '');
      responseExcerpt = text.slice(0, 300);
      try { parsedResponse = JSON.parse(text) as Record<string, unknown>; } catch { /* not JSON */ }
    } catch (err) {
      // The service's own facilitator is down or slow: real payments would fail too.
      const code = err instanceof StageError && err.code === 'TIMEOUT' ? 'FACILITATOR_TIMEOUT' : 'FACILITATOR_UNREACHABLE';
      fail(stageVerify, code, { facilitator_url, error: String(err) }, Date.now() - t4);
      return done('not_ready');
    }

    const d4 = Date.now() - t4;

    if (typeof parsedResponse.isValid !== 'boolean') {
      if (rawStatus === 401 || rawStatus === 403) {
        // The facilitator only serves its own customers (Bankr's has required a
        // bearer token since Sep 2026). Not a failure — CORTX just can't check.
        fail(stageVerify, 'FACILITATOR_AUTH_REQUIRED', { facilitator_url, http_status: rawStatus, response_excerpt: responseExcerpt }, d4);
        return done('unavailable');
      }
      if (rawStatus >= 500) {
        fail(stageVerify, 'FACILITATOR_ERROR', { facilitator_url, http_status: rawStatus, response_excerpt: responseExcerpt }, d4);
        return done('not_ready');
      }
      // A 4xx without a verdict most likely means the facilitator didn't accept
      // how CORTX built the request — don't blame the service for that.
      fail(stageVerify, 'VERIFY_REQUEST_REJECTED', { facilitator_url, http_status: rawStatus, response_excerpt: responseExcerpt, cortx_side: true }, d4);
      return done('error', `Facilitator returned HTTP ${rawStatus} without a verdict`);
    }

    facilitator_responded = true;
    verify_is_valid = parsedResponse.isValid;
    verify_invalid_reason = typeof parsedResponse.invalidReason === 'string' ? parsedResponse.invalidReason : null;

    if (!verify_is_valid) {
      const serviceSide = isServiceSideVerifyRejection(verify_invalid_reason);
      fail(stageVerify, serviceSide ? 'VERIFY_REJECTED' : 'VERIFY_REJECTED_CORTX_SIDE', {
        facilitator_url,
        is_valid: false,
        invalid_reason: verify_invalid_reason,
        http_status: rawStatus,
        response_excerpt: responseExcerpt,
        ...(serviceSide ? {} : { cortx_side: true }),
      }, d4);
      return serviceSide
        ? done('not_ready')
        : done('error', `Facilitator rejected CORTX's authorization: ${verify_invalid_reason ?? 'no reason given'}`);
    }

    pass(stageVerify, d4, { facilitator_url, is_valid: true, authorization_ttl_seconds });
    return done('ready');
  } catch (err) {
    return done('error', err instanceof Error ? err.message : String(err));
  }
}

// Converts a readiness result into a check row. `unavailable` produces no row —
// the service just keeps its regular paid schedule.
export function readinessToCheckResult(r: ReadinessResult): CheckResult | null {
  if (r.status === 'unavailable') return null;
  return {
    service_id: r.service_id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    latency_ms: r.completed_at ? r.completed_at.getTime() - r.started_at.getTime() : null,
    status: r.status === 'ready' ? 'passed' : r.status === 'not_ready' ? 'failed' : 'error',
    failure_stage: r.failure_stage,
    stages: r.stages,
    // Price lives in stage evidence; observed_price stays null so readiness
    // checks never count as spend (nothing is paid).
    observed_price: null,
    error_message: r.error_message,
    check_type: 'readiness',
  };
}

// Human-readable reason for the service page.
export function readinessReason(r: ReadinessResult): string | null {
  if (r.status === 'ready') return null;
  const failed = r.stages.find((s) => s.passed === false);
  if (r.status === 'unavailable') {
    if (failed?.error === 'FACILITATOR_AUTH_REQUIRED') {
      return `Payment facilitator requires authentication (HTTP ${String(failed.evidence?.http_status ?? '401')})`;
    }
    return 'Service does not publish its payment facilitator';
  }
  if (r.verify_invalid_reason) return `Facilitator: ${r.verify_invalid_reason}`;
  return failed?.error ?? r.error_message ?? null;
}
