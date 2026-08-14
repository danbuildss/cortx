import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createClient } from '@supabase/supabase-js';
import { StageError, validateAndResolveUrl } from './ssrf';
import { executePayment, getWalletAddress, getWalletBalance } from './payment';
import { classifyStatus } from './classify';
import type { ServiceConfig, CanaryConfig, CheckResult, StageResult, StageName, X402PaymentTerms } from './types';

const REQUEST_TIMEOUT_MS = 10_000;
const DELIVERY_TIMEOUT_MS = 15_000;
const PAYMENT_TIMEOUT_MS = 30_000;
const RESPONSE_BODY_MAX_BYTES = 1_048_576; // 1 MB cap on any remote response body

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new StageError('TIMEOUT', `Request timed out after ${timeoutMs}ms`);
    }
    throw new StageError('UNREACHABLE', `Network error: ${err}`);
  } finally {
    clearTimeout(timer);
  }
}

// Parses raw JSON string into normalized X402PaymentTerms.
// Handles x402v1 { accepts: [] } envelope and Bankr flat format from body or header.
// Maps recipient → payTo for gateways that use the Bankr field name.
function parseToPaymentTerms(raw: string): X402PaymentTerms | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed.accepts) && parsed.accepts.length > 0) {
      const normalizedAccepts = (parsed.accepts as Record<string, unknown>[]).map((opt) => ({
        ...opt,
        payTo: String(opt.payTo ?? opt.recipient ?? ''),
      }));
      return { ...parsed, accepts: normalizedAccepts } as unknown as X402PaymentTerms;
    }
    // Flat format: { network, maxAmountRequired, recipient|payTo, asset, ... }
    if (parsed.network || parsed.maxAmountRequired) {
      return {
        accepts: [{
          network: String(parsed.network ?? ''),
          maxAmountRequired: String(parsed.maxAmountRequired ?? ''),
          asset: String(parsed.asset ?? 'USDC'),
          payTo: String(parsed.payTo ?? parsed.recipient ?? ''),
          description: parsed.description ? String(parsed.description) : undefined,
          resource: parsed.resource ? String(parsed.resource) : undefined,
        }],
      };
    }
  } catch { /* ignore */ }
  return null;
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

async function getCumulativeSpendToday(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 0;
  const db = createClient(url, key);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart);
  monthStart.setUTCDate(1);
  const { data } = await db
    .from('checks')
    .select('observed_price')
    .gte('started_at', todayStart.toISOString())
    .eq('status', 'passed')
    .not('observed_price', 'is', null);
  return (data ?? []).reduce((sum, r) => sum + parseFloat(String(r.observed_price ?? 0)), 0);
}

async function getCumulativeSpendThisMonth(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 0;
  const db = createClient(url, key);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data } = await db
    .from('checks')
    .select('observed_price')
    .gte('started_at', monthStart.toISOString())
    .eq('status', 'passed')
    .not('observed_price', 'is', null);
  return (data ?? []).reduce((sum, r) => sum + parseFloat(String(r.observed_price ?? 0)), 0);
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

  const advance = (): StageName => remainingStages.shift()!;
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
    let paymentTerms: X402PaymentTerms;
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

    // Parse body first; fall back to X-Payment-Required header (used by Bankr and similar gateways)
    const xPayHeader = response402.headers.get('x-payment-required') ?? '';
    const parsed402 = parseToPaymentTerms(rawBody) ?? parseToPaymentTerms(xPayHeader);

    if (!parsed402) {
      fail(stageTerms, 'INVALID_PAYMENT_TERMS', {
        error: 'Could not parse payment terms from body or X-Payment-Required header',
        body_preview: rawBody.slice(0, 200),
      }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    paymentTerms = parsed402;

    if (!paymentTerms.accepts || paymentTerms.accepts.length === 0) {
      fail(stageTerms, 'NO_PAYMENT_OPTIONS', { raw: paymentTerms }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    // Accept both short names ("base") and CAIP-2 format ("eip155:8453")
    const NETWORK_ALIASES: Record<string, string[]> = {
      mainnet: ['base', 'eip155:8453'],
      testnet: ['base-sepolia', 'eip155:84532'],
    };
    const acceptedNetworks = NETWORK_ALIASES[config.environment] ?? ['base', 'eip155:8453'];
    const matchingOption = paymentTerms.accepts.find(
      (opt) => acceptedNetworks.includes(opt.network)
    );

    if (!matchingOption) {
      fail(stageTerms, 'UNSUPPORTED_NETWORK', {
        expected_network: acceptedNetworks.join(' | '),
        available_networks: paymentTerms.accepts.map((o) => o.network),
      }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (!matchingOption.payTo || !matchingOption.maxAmountRequired || !matchingOption.network) {
      fail(stageTerms, 'MISSING_FIELDS', { option: matchingOption }, Math.round(performance.now() - t4));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const d4 = Math.round(performance.now() - t4);
    stages.push(makeStage(stageTerms, true, d4, {
      payment_required: true,
      accepted_tokens: ['USDC'],
      network: matchingOption.network,
      payee_address: '[REDACTED]',
      raw_payment_terms: { accepts_count: paymentTerms.accepts.length, network: matchingOption.network },
    }));

    // ── Stage 5: Parse Observed Price ─────────────────────────────────────
    const stagePrice = advance();
    const rawPrice = matchingOption.maxAmountRequired;

    if (!rawPrice) {
      fail(stagePrice, 'MISSING_PRICE', { option: matchingOption }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const rawNum = parseFloat(rawPrice);

    if (isNaN(rawNum)) {
      fail(stagePrice, 'INVALID_PRICE_FORMAT', { raw_price_field: rawPrice }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (rawNum <= 0) {
      fail(stagePrice, 'ZERO_PRICE', { raw_price_field: rawPrice, parsed_price: rawNum }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    // x402v2 sends maxAmountRequired in atomic USDC units (6 decimals), e.g. "1000" = $0.001
    // x402v1 / some implementations send decimal USDC, e.g. "0.001"
    const parsedPrice = rawNum >= 1 && Number.isInteger(rawNum)
      ? rawNum / 1_000_000
      : rawNum;

    observed_price = parsedPrice.toFixed(6);
    stages.push(makeStage(stagePrice, true, 0, {
      raw_price_field: rawPrice,
      parsed_price: observed_price,
      unit: 'USDC',
    }));

    // ── Stage 6: Compare Price Against Expected and Maximum ───────────────
    const stagePriceCheck = advance();
    const expectedPrice = parseFloat(config.expected_price);
    const maxPrice = parseFloat(config.max_price);
    const priceMatch = Math.abs(parsedPrice - expectedPrice) < 0.000001;

    if (parsedPrice > maxPrice) {
      fail(stagePriceCheck, 'PRICE_EXCEEDS_MAXIMUM', {
        expected_price: config.expected_price,
        observed_price,
        max_price: config.max_price,
        result: 'exceeds_maximum',
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const betaCap = parseFloat(process.env.BETA_MAX_ENDPOINT_PRICE_USDC ?? '1.00');
    if (parsedPrice > betaCap) {
      fail(stagePriceCheck, 'BETA_PRICE_CAP_EXCEEDED', {
        observed_price,
        beta_max_price_usdc: betaCap.toFixed(2),
        result: 'exceeds_beta_cap',
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (!priceMatch) {
      fail(stagePriceCheck, 'PRICE_MISMATCH', {
        expected_price: config.expected_price,
        observed_price,
        max_price: config.max_price,
        result: 'mismatch',
      }, 0);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    stages.push(makeStage(stagePriceCheck, true, 0, {
      expected_price: config.expected_price,
      observed_price,
      max_price: config.max_price,
      result: 'match',
    }));

    // ── Stage 7: Execute Controlled Payment ───────────────────────────────
    const stagePayment = advance();
    const t7 = performance.now();

    let txHash: string;
    let walletAddress: string;

    try {
      const walletAddr = getWalletAddress();

      // Enforce cumulative daily and monthly spend caps
      const dailyCap = parseFloat(process.env.CORTX_DAILY_SPEND_CAP_USDC ?? '1.00');
      const monthlyCap = parseFloat(process.env.CORTX_MONTHLY_SPEND_CAP_USDC ?? '10.00');

      const [dailySpent, monthlySpent] = await Promise.all([
        getCumulativeSpendToday(),
        getCumulativeSpendThisMonth(),
      ]);

      if (dailySpent + parsedPrice > dailyCap) {
        throw new StageError('DAILY_SPEND_CAP_EXCEEDED', `Daily cap of ${dailyCap} USDC reached (spent ${dailySpent.toFixed(6)} today)`);
      }
      if (monthlySpent + parsedPrice > monthlyCap) {
        throw new StageError('MONTHLY_SPEND_CAP_EXCEEDED', `Monthly cap of ${monthlyCap} USDC reached (spent ${monthlySpent.toFixed(6)} this month)`);
      }

      const result = await Promise.race([
        executePayment(paymentTerms, observed_price),
        sleep(PAYMENT_TIMEOUT_MS).then(() => { throw new StageError('PAYMENT_TIMEOUT', 'Payment confirmation timed out'); }),
      ]) as { txHash: string; walletAddress: string; amountPaid: string };

      txHash = result.txHash;
      walletAddress = result.walletAddress;
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'WALLET_ERROR';
      const rawMsg = err instanceof Error ? err.message : String(err);
      const walletKey = process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__';
      const msg = rawMsg.replaceAll(walletKey, '[REDACTED]');
      fail(stagePayment, code, {
        error: msg,
        network: 'base',
      }, Math.round(performance.now() - t7));
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    const d7 = Math.round(performance.now() - t7);
    stages.push(makeStage(stagePayment, true, d7, {
      tx_hash: '[REDACTED]',
      amount_paid: observed_price,
      network: 'base',
      wallet_address: '[REDACTED]',
      confirmed: true,
    }));

    // ── Stage 8: Confirm Result Delivery ──────────────────────────────────
    const stageDelivery = advance();
    const t8 = performance.now();
    let deliveryResponse: Response;

    try {
      // Use the same method (GET/POST) that produced the 402 on the probe request
      const deliveryInit: RequestInit = probeMethod === 'GET'
        ? { method: 'GET', headers: { 'X-Payment': txHash } }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Payment': txHash },
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

    if (!deliveryResponse.ok) {
      fail(stageDelivery, 'UNEXPECTED_STATUS', {
        http_status: deliveryResponse.status,
        response_headers: deliveryHeaders,
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
      fail(stageDelivery, code, { http_status: deliveryResponse.status, error: msg }, d8);
      markRemaining();
      return buildResult(config.id, started_at, stages, failure_stage, observed_price, 'failed');
    }

    if (!responseBody || responseBody.trim().length === 0) {
      fail(stageDelivery, 'EMPTY_BODY', {
        http_status: deliveryResponse.status,
        body_received: false,
        error: 'Empty response body',
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

    // ── Stage 11: Record Latency ──────────────────────────────────────────
    const latency_ms = Math.round(performance.now() - wallClockStart);

    // ── Stage 12: Classify Status ─────────────────────────────────────────
    const classification = classifyStatus(stages, latency_ms, config.latency_threshold_ms);

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
  status: 'passed' | 'failed'
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
    error_message: null,
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
