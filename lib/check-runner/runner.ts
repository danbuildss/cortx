import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { StageError, validateAndResolveUrl } from './ssrf';
import { fetchEndpoint, RESPONSE_BODY_MAX_BYTES, type CheckedFetchInit } from './fetch-endpoint';
import { executePayment, type SignedPayment } from './payment';
import { classifyStatus, isCortxSidePaymentFailure } from './classify';
import type { ServiceConfig, CanaryConfig, CheckResult, StageResult, StageName } from './types';
import { NETWORK_ALIASES, parsePaymentRequired, priceToUsdc, readSettlement, selectPaymentOption } from './x402';

const REQUEST_TIMEOUT_MS = 10_000;
const DELIVERY_TIMEOUT_MS = 15_000;
const PAYMENT_TIMEOUT_MS = 30_000;

// Endpoint requests go through fetchEndpoint: the address is checked at
// connect time and on every redirect, not just once before the request.
function fetchWithTimeout(url: string, init: CheckedFetchInit, timeoutMs: number): Promise<Response> {
  return fetchEndpoint(url, init, timeoutMs);
}

async function readBodyCapped(response: Response, maxBytes = RESPONSE_BODY_MAX_BYTES): Promise<string> {
  const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
  if (contentLength > maxBytes) {
    throw new StageError('RESPONSE_TOO_LARGE', `Response Content-Length ${contentLength} exceeds ${maxBytes} byte limit`);
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          throw new StageError('RESPONSE_TOO_LARGE', `Response body exceeds ${maxBytes} byte limit`);
        }
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

// Atomically reserve spend budget via the reserve_spend Postgres RPC.
// Returns 'ok', 'DAILY_SPEND_CAP_EXCEEDED', or 'MONTHLY_SPEND_CAP_EXCEEDED'.
async function reserveSpend(
  serviceId: string,
  amount: number,
  dailyCap: number,
  monthlyCap: number
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'ok';
  const db = createClient(url, key);
  const { data, error } = await db.rpc('reserve_spend', {
    p_service_id: serviceId,
    p_amount: amount,
    p_daily_cap: dailyCap,
    p_monthly_cap: monthlyCap,
  });
  if (error) throw new StageError('SPEND_RESERVATION_FAILED', `Spend reservation failed: ${error.message}`);
  return String(data);
}

// Global CORTX verification budget (shared by every paid check on the platform).
export function getSpendCaps(): { dailyCap: number; monthlyCap: number } {
  return {
    dailyCap: parseFloat(process.env.CORTX_DAILY_SPEND_CAP_USDC ?? '1.00'),
    monthlyCap: parseFloat(process.env.CORTX_MONTHLY_SPEND_CAP_USDC ?? '10.00'),
  };
}

// Release any unexpired reservation for this service (called on payment failure/timeout).
async function releaseSpendReservation(serviceId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key);
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await db
    .from('spend_reservations')
    .delete()
    .eq('service_id', serviceId)
    .gte('reserved_at', cutoff);
}

function makeStage(
  stage: StageName,
  passed: boolean | null,
  duration_ms: number | null,
  evidence: Record<string, unknown> | null,
  error?: string
): StageResult {
  return { stage, passed, duration_ms, evidence, error };
}

function notReached(stage: StageName): StageResult {
  return makeStage(stage, null, null, null);
}

export async function runFullCheck(config: ServiceConfig): Promise<CheckResult> {
  const started_at = new Date();
  const stages: StageResult[] = [];
  let failure_stage: StageName | null = null;
  let observed_price: string | null = null;
  let wallClockStart = 0;

  const fail = (stage: StageName, error: string, evidence: Record<string, unknown> | null, duration_ms: number): void => {
    stages.push(makeStage(stage, false, duration_ms, evidence, error));
    failure_stage = stage;
  };

  const remainingStages: StageName[] = [
    'availability',
    'payment_terms',
    'price_check',
    'payment',
    'delivery',
    'json_parse',
    'schema_validation',
  ];

  const advance = (): StageName => {
    const next = remainingStages.shift();
    // Fail loudly: an extra advance() shifts every later stage name by one
    if (!next) throw new Error('Check runner bug: more stage steps than stages');
    return next;
  };
  const markRemaining = (): void => {
    for (const s of remainingStages) stages.push(notReached(s));
  };

  try {
    // ── Stage 1: Validate URL ──────────────────────────────────────────────
    const stageAvail = advance();
    const t1 = performance.now();
    let validatedUrl: URL;
    try {
      validatedUrl = await validateAndResolveUrl(config.endpoint_url);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'INVALID_URL';
      fail(stageAvail, code, { url: config.endpoint_url, validation: code }, Math.round(performance.now() - t1));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    // ── Stage 2: Start Timer ──────────────────────────────────────────────
    wallClockStart = performance.now();

    // ── Stage 3: Test Availability ────────────────────────────────────────
    const t3 = performance.now();
    let response402: Response;
    let availabilityAttempts = 0;
    let probeMethod: 'POST' | 'GET' = 'POST';

    while (true) {
      try {
        response402 = await fetchWithTimeout(
          validatedUrl.toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.test_input),
          },
          REQUEST_TIMEOUT_MS
        );
        break;
      } catch (err) {
        availabilityAttempts++;
        if (availabilityAttempts >= 2 || !(err instanceof StageError && (err.code === 'UNREACHABLE' || err.code === 'TIMEOUT'))) {
          const code = err instanceof StageError ? err.code : 'UNREACHABLE';
          const d3 = Math.round(performance.now() - t3);
          fail(stageAvail, code, { url: config.endpoint_url, attempts: availabilityAttempts }, d3);
          markRemaining();
          return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
        }
        await sleep(2000);
      }
    }

    // Some endpoints (e.g. Bankr price-quote) only gate on GET; fall back if POST didn't return 402
    if (response402.status !== 402) {
      try {
        const getResp = await fetchWithTimeout(
          validatedUrl.toString(),
          { method: 'GET' },
          REQUEST_TIMEOUT_MS
        );
        if (getResp.status === 402) {
          response402 = getResp;
          probeMethod = 'GET';
        }
      } catch { /* ignore; original POST response will trigger UNEXPECTED_STATUS below */ }
    }

    const d3 = Math.round(performance.now() - t3);

    if (response402.status !== 402) {
      fail(stageAvail, 'UNEXPECTED_STATUS', {
        http_status: response402.status,
        response_time_ms: d3,
        expected: 402,
      }, d3);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const availHeaders: Record<string, string> = {};
    response402.headers.forEach((v, k) => { availHeaders[k] = v; });

    stages.push(makeStage(stageAvail, true, d3, {
      http_status: 402,
      response_time_ms: d3,
      response_headers: availHeaders,
    }));

    // ── Stage 4: Inspect Payment Requirements ─────────────────────────────
    const stageTerms = advance();
    const t4 = performance.now();
    let rawBody: string;

    try {
      rawBody = await readBodyCapped(response402);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'INVALID_PAYMENT_TERMS';
      const msg = err instanceof StageError ? err.message : 'Could not read response body';
      fail(stageTerms, code, { error: msg }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    // Shared x402 parser: body (V1), PAYMENT-REQUIRED header (V2, base64), X-PAYMENT-REQUIRED (Bankr)
    const parsed402 = parsePaymentRequired(rawBody, response402.headers);

    if (!parsed402) {
      fail(stageTerms, 'INVALID_PAYMENT_TERMS', {
        error: 'Could not parse payment terms from the body, PAYMENT-REQUIRED or X-PAYMENT-REQUIRED header',
        body_preview: rawBody.slice(0, 200),
      }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const acceptedNetworks = NETWORK_ALIASES[config.environment] ?? NETWORK_ALIASES.mainnet;
    const matchingOption = selectPaymentOption(parsed402.options, config.environment);

    if (!matchingOption) {
      fail(stageTerms, 'UNSUPPORTED_NETWORK', {
        expected_network: acceptedNetworks.join(' | '),
        available_networks: parsed402.options.map((o) => o.network),
      }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (!matchingOption.payTo || !matchingOption.amount || !matchingOption.network) {
      fail(stageTerms, 'MISSING_FIELDS', {
        has_pay_to: Boolean(matchingOption.payTo),
        has_amount: Boolean(matchingOption.amount),
        network: matchingOption.network || null,
      }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const d4 = Math.round(performance.now() - t4);
    stages.push(makeStage(stageTerms, true, d4, {
      payment_required: true,
      accepted_tokens: ['USDC'],
      network: matchingOption.network,
      payee_address: '[REDACTED]',
      raw_payment_terms: { accepts_count: parsed402.options.length, network: matchingOption.network },
      x402_protocol_version: `v${parsed402.version}`,
      terms_source: parsed402.source,
      payment_scheme: matchingOption.scheme,
    }));

    // ── Stages 5–6: Parse the price, then compare it to expected/max ──────
    // Both steps are the single `price_check` stage: one advance(), one stage
    // row. (Until Sep 2026 they each called advance(), which shifted every
    // later stage name by one — see migration 022.)
    const stagePrice = advance();
    const rawPrice = matchingOption.amount;
    const price = priceToUsdc(matchingOption);

    if (!price) {
      fail(stagePrice, 'INVALID_PRICE_FORMAT', { raw_price_field: rawPrice }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (price.usdc <= 0) {
      fail(stagePrice, 'ZERO_PRICE', { raw_price_field: rawPrice, parsed_price: price.usdc }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const parsedPrice = price.usdc;
    observed_price = parsedPrice.toFixed(6);
    const parsedPriceEvidence = {
      raw_price_field: rawPrice,
      price_field_name: matchingOption.amountField,
      parsed_price: observed_price,
      unit: 'USDC',
      atomic_units_detected: price.atomic,
    };

    const stagePriceCheck = stagePrice;
    const expectedPrice = config.expected_price != null ? parseFloat(config.expected_price) : null;
    const maxPrice = parseFloat(config.max_price);
    const priceMatch = expectedPrice == null || Math.abs(parsedPrice - expectedPrice) < 0.000001;

    // With a payment gate, affordability is the gate's decision: a price above
    // what this checker will pay is not a failure of the service.
    const gated = config.payment_gate != null;

    if (!gated && parsedPrice > maxPrice) {
      fail(stagePriceCheck, 'PRICE_EXCEEDS_MAXIMUM', {
        ...parsedPriceEvidence,
        expected_price: config.expected_price,
        observed_price,
        max_price: config.max_price,
        result: 'exceeds_maximum',
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const betaCap = parseFloat(process.env.BETA_MAX_ENDPOINT_PRICE_USDC ?? '1.00');
    if (!gated && parsedPrice > betaCap) {
      fail(stagePriceCheck, 'BETA_PRICE_CAP_EXCEEDED', {
        ...parsedPriceEvidence,
        observed_price,
        beta_max_price_usdc: betaCap.toFixed(2),
        result: 'exceeds_beta_cap',
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (!priceMatch) {
      fail(stagePriceCheck, 'PRICE_MISMATCH', {
        ...parsedPriceEvidence,
        expected_price: config.expected_price,
        observed_price,
        max_price: config.max_price,
        result: 'mismatch',
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    stages.push(makeStage(stagePriceCheck, true, 0, {
      ...parsedPriceEvidence,
      expected_price: config.expected_price ?? 'any',
      observed_price,
      max_price: config.max_price,
      result: expectedPrice == null ? 'accepted' : 'match',
      price_drift_usdc: expectedPrice != null ? (parsedPrice - expectedPrice).toFixed(6) : '0',
    }));

    // ── Stage 7: Execute Controlled Payment ───────────────────────────────
    const stagePayment = advance();
    const t7 = performance.now();

    if (config.payment_gate) {
      let decision: Awaited<ReturnType<NonNullable<ServiceConfig['payment_gate']>>>;
      try {
        decision = await config.payment_gate(parsedPrice);
      } catch {
        // Fail closed: if the budget can't be checked, don't pay
        decision = { pay: false, reason: 'budget_unavailable', message: 'The paid part could not be scheduled right now.' };
      }
      if (!decision.pay) {
        stages.push(makeStage(stagePayment, null, null, { skipped: true, reason: decision.reason }));
        markRemaining();
        return {
          ...buildResult(config.id, started_at, stages, null, observed_price, 'passed'),
          paid_skipped: { reason: decision.reason, message: decision.message },
        };
      }
    }

    let signedPayment: SignedPayment;

    try {
      // Atomically reserve spend budget before payment (prevents concurrent overspend)
      const { dailyCap, monthlyCap } = getSpendCaps();
      // A payment gate has already reserved from its own budget
      const reserveResult = gated ? 'ok' : await reserveSpend(config.id, parsedPrice, dailyCap, monthlyCap);
      if (reserveResult !== 'ok') {
        throw new StageError(
          reserveResult as 'DAILY_SPEND_CAP_EXCEEDED' | 'MONTHLY_SPEND_CAP_EXCEEDED',
          reserveResult === 'DAILY_SPEND_CAP_EXCEEDED'
            ? `Daily cap of ${dailyCap} USDC reached`
            : `Monthly cap of ${monthlyCap} USDC reached`
        );
      }

      try {
        signedPayment = await Promise.race([
          executePayment({
            option: matchingOption,
            version: parsed402.version,
            resource: parsed402.resource,
            endpointUrl: validatedUrl.toString(),
            observedPrice: observed_price,
          }),
          sleep(PAYMENT_TIMEOUT_MS).then((): never => { throw new StageError('PAYMENT_TIMEOUT', 'Payment signing timed out'); }),
        ]);
      } catch (innerErr) {
        // Release the reservation on payment failure so budget is not consumed
        // (a payment gate's caller releases its own)
        if (!gated) await releaseSpendReservation(config.id).catch(() => {});
        throw innerErr;
      }
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'PAYMENT_SIGNING_FAILED';
      const rawMsg = err instanceof Error ? err.message : String(err);
      const walletKey = process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__';
      const msg = rawMsg.replaceAll(walletKey, '[REDACTED]');
      const cortxSide = isCortxSidePaymentFailure(code);
      fail(stagePayment, code, {
        error: msg,
        network: 'base',
        ...(cortxSide ? { cortx_side: true } : {}),
      }, Math.round(performance.now() - t7));
      markRemaining();
      // Wallet/budget problems are CORTX's fault, not the service's — record as
      // an infrastructure error so the builder is never blamed or alerted.
      return cortxSide
        ? buildResult(config.id, started_at, stages, failure_stage, observed_price, 'error', `CORTX verification wallet: ${msg}`)
        : buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const d7 = Math.round(performance.now() - t7);
    // Signed only: the service's facilitator settles when we retry with the
    // payment header. Proof of settlement is read from the delivery response.
    stages.push(makeStage(stagePayment, true, d7, {
      signed: true,
      amount_paid: observed_price,
      network: matchingOption.network,
      x402_version: parsed402.version,
      payment_header: signedPayment.headerName,
      wallet_address: '[REDACTED]',
      verification_cost_usdc: observed_price,
      recipient_fingerprint: createHash('sha256').update(matchingOption.payTo).digest('hex').slice(0, 16),
    }));

    // ── Stage 8: Confirm Result Delivery ──────────────────────────────────
    const stageDelivery = advance();
    const t8 = performance.now();
    let deliveryResponse: Response;

    try {
      // Use the same method (GET/POST) that produced the 402 on the probe request
      const paymentHeaders = { [signedPayment.headerName]: signedPayment.headerValue };
      const deliveryInit: CheckedFetchInit = probeMethod === 'GET'
        ? { method: 'GET', headers: paymentHeaders }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...paymentHeaders },
            body: JSON.stringify(config.test_input),
          };
      deliveryResponse = await fetchWithTimeout(
        validatedUrl.toString(),
        deliveryInit,
        DELIVERY_TIMEOUT_MS
      );
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'NO_RESPONSE';
      fail(stageDelivery, code, { error: String(err) }, Math.round(performance.now() - t8));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const d8 = Math.round(performance.now() - t8);
    const deliveryHeaders: Record<string, string> = {};
    deliveryResponse.headers.forEach((v, k) => { deliveryHeaders[k] = v; });
    // Settlement receipt — recorded on every outcome, so "paid but not
    // delivered" is provable when the service settles and then fails.
    const settlement = readSettlement(deliveryResponse.headers);

    if (!deliveryResponse.ok) {
      fail(stageDelivery, 'UNEXPECTED_STATUS', {
        http_status: deliveryResponse.status,
        response_headers: deliveryHeaders,
        settlement,
      }, d8);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    let responseBody: string;
    try {
      responseBody = await readBodyCapped(deliveryResponse);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'NO_RESPONSE';
      const msg = err instanceof StageError ? err.message : 'Could not read response body';
      fail(stageDelivery, code, { http_status: deliveryResponse.status, error: msg, settlement }, d8);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (!responseBody || responseBody.trim().length === 0) {
      fail(stageDelivery, 'EMPTY_BODY', {
        http_status: deliveryResponse.status,
        body_received: false,
        error: 'Empty response body',
        settlement,
      }, d8);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const bodyPreview = responseBody.slice(0, 500);
    const bodyBytes = new TextEncoder().encode(responseBody).length;

    stages.push(makeStage(stageDelivery, true, d8, {
      http_status: deliveryResponse.status,
      body_received: true,
      body_length_bytes: bodyBytes,
      response_body_preview: bodyPreview,
      settlement,
    }));

    // ── Stage 9: Parse JSON ───────────────────────────────────────────────
    const stageJson = advance();
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(responseBody);
      stages.push(makeStage(stageJson, true, 0, { parse_successful: true }));
    } catch (err) {
      fail(stageJson, 'INVALID_JSON', {
        parse_successful: false,
        error: String(err),
        body_preview: responseBody.slice(0, 200),
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    // ── Stage 10: Validate Schema ─────────────────────────────────────────
    const stageSchema = advance();
    if (!config.expected_schema) {
      stages.push(makeStage(stageSchema, true, 0, { skipped: true, reason: 'no_schema_configured' }));
    } else {
      const ajv = new Ajv({ allErrors: true });
      addFormats(ajv);

      let validate: ReturnType<typeof ajv.compile>;
      try {
        validate = ajv.compile(config.expected_schema);
      } catch (err) {
        fail(stageSchema, 'SCHEMA_COMPILE_ERROR', { error: String(err) }, 0);
        return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
      }

      const valid = validate(parsedJson);

      if (!valid) {
        fail(stageSchema, 'SCHEMA_VALIDATION_FAILED', {
          valid: false,
          errors: validate.errors ?? [],
        }, 0);
        return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
      }

      stages.push(makeStage(stageSchema, true, 0, { valid: true, errors: [] }));
    }

    // ── Stage 11: Record Latency ──────────────────────────────────────────
    const latency_ms = Math.round(performance.now() - wallClockStart);

    // ── Stage 12: Classify Status ─────────────────────────────────────────
    const classification = classifyStatus(stages, latency_ms, config.latency_threshold_ms ?? undefined);

    return {
      service_id: config.id,
      started_at,
      completed_at: new Date(),
      latency_ms,
      status: classification.check_status,
      failure_stage: classification.failure_stage,
      stages,
      observed_price,
      error_message: null,
      check_type: 'full',
    };

  } catch (err) {
    return {
      service_id: config.id,
      started_at,
      completed_at: new Date(),
      latency_ms: wallClockStart > 0 ? Math.round(performance.now() - wallClockStart) : null,
      status: 'error',
      failure_stage,
      stages,
      observed_price,
      error_message: String(err).replaceAll(process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__', '[REDACTED]'),
      check_type: 'full',
    };
  }
}

// Backward compat alias — existing callers continue to work unchanged
export const runCheck = runFullCheck;

function buildResult(
  service_id: string,
  started_at: Date,
  stages: StageResult[],
  failure_stage: StageName | null,
  observed_price: string | null,
  status: 'passed' | 'failed' | 'error',
  error_message: string | null = null
): CheckResult {
  return {
    service_id,
    started_at,
    completed_at: new Date(),
    latency_ms: null,
    status,
    failure_stage,
    stages,
    observed_price,
    error_message,
    check_type: 'full',
  };
}

// Canary wrapper: runs the full paid pipeline with canary-specific config.
// Uses the canary payload, schema, and price cap instead of the service's
// production test_input and expected values.
export async function runCanaryCheck(
  config: ServiceConfig,
  canary: CanaryConfig
): Promise<CheckResult> {
  const canaryConfig: ServiceConfig = {
    ...config,
    test_input: canary.payload,
    expected_schema: canary.expected_schema,
    max_price: canary.max_price_usdc,
    expected_price: canary.max_price_usdc,
  };
  const result = await runFullCheck(canaryConfig);
  return { ...result, check_type: 'canary' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
