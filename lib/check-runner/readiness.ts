/**
 * Track 2 experiment — payment readiness check via facilitator /verify.
 *
 * Calls the facilitator's /verify endpoint with a signed EIP-3009 authorization
 * to confirm that a payment WOULD succeed, without settling on-chain.
 * No USDC moves. Result is not persisted to the database.
 *
 * This file is intentionally not imported from any production code path.
 * It exists to generate data for docs/track2-findings.md.
 */

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { preparePaymentHeader, signPaymentHeader } from 'x402/client';
import { useFacilitator, verify as defaultVerify } from 'x402/verify';
import type { X402PaymentTerms } from './types';
import { StageError, validateAndResolveUrl } from './ssrf';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const USDC_DECIMALS = 6;
const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const DEFAULT_FACILITATOR = 'https://x402.org/facilitator';
const REQUEST_TIMEOUT_MS = 10_000;
const VERIFY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_MAX_BYTES = 1_048_576;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadinessStage =
  | 'availability'
  | 'payment_terms'
  | 'price_check'
  | 'facilitator_verify';

export type ReadinessStageResult = {
  stage: ReadinessStage;
  passed: boolean | null;
  duration_ms: number | null;
  evidence: Record<string, unknown> | null;
  error?: string;
};

export type ReadinessStatus = 'ready' | 'not_ready' | 'error';

export type ReadinessResult = {
  service_id: string;
  endpoint_url: string;
  started_at: Date;
  completed_at: Date | null;
  status: ReadinessStatus;
  failure_stage: ReadinessStage | null;
  stages: ReadinessStageResult[];
  observed_price: string | null;
  // Metadata for the experiment findings doc
  facilitator_url: string | null;
  facilitator_is_custom: boolean;
  facilitator_responded: boolean;
  verify_is_valid: boolean | null;
  verify_invalid_reason: string | null;
  // Replay risk context
  authorization_ttl_seconds: number | null;
  error_message: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stage(
  s: ReadinessStage,
  passed: boolean | null,
  duration_ms: number | null,
  evidence: Record<string, unknown> | null,
  error?: string
): ReadinessStageResult {
  return { stage: s, passed, duration_ms, evidence, error };
}

function notReached(s: ReadinessStage): ReadinessStageResult {
  return { stage: s, passed: null, duration_ms: null, evidence: null };
}

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
    if (parsed.network || parsed.maxAmountRequired) {
      return {
        accepts: [{
          network: String(parsed.network ?? ''),
          maxAmountRequired: String(parsed.maxAmountRequired ?? ''),
          asset: String(parsed.asset ?? 'USDC'),
          payTo: String(parsed.payTo ?? parsed.recipient ?? ''),
        }],
      };
    }
  } catch { /* ignore */ }
  return null;
}

const CAIP2_TO_X402: Record<string, string> = {
  'eip155:8453':  'base',
  'eip155:84532': 'base-sepolia',
};

const NETWORK_ALIASES: Record<string, string[]> = {
  mainnet: ['base', 'eip155:8453'],
  testnet: ['base-sepolia', 'eip155:84532'],
};

function getTestWalletKey(): `0x${string}` {
  const key = process.env.CORTX_TEST_WALLET_KEY;
  if (!key) throw new Error('CORTX_TEST_WALLET_KEY not set');
  if (!key.startsWith('0x') || key.length !== 66) {
    throw new Error('CORTX_TEST_WALLET_KEY must be a 0x-prefixed 32-byte hex string');
  }
  return key as `0x${string}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export type ReadinessConfig = {
  service_id: string;
  endpoint_url: string;
  max_price: string;
  environment: 'mainnet' | 'testnet';
  test_input?: Record<string, unknown> | null;
};

export async function runReadinessCheck(config: ReadinessConfig): Promise<ReadinessResult> {
  const started_at = new Date();
  const stages: ReadinessStageResult[] = [];
  let failure_stage: ReadinessStage | null = null;
  let observed_price: string | null = null;
  let facilitator_url: string | null = null;
  let facilitator_is_custom = false;
  let facilitator_responded = false;
  let verify_is_valid: boolean | null = null;
  let verify_invalid_reason: string | null = null;
  let authorization_ttl_seconds: number | null = null;

  const remaining: ReadinessStage[] = [
    'availability', 'payment_terms', 'price_check', 'facilitator_verify',
  ];
  const advance = (): ReadinessStage => remaining.shift()!;
  const markRemaining = () => { for (const s of remaining) stages.push(notReached(s)); };

  const fail = (s: ReadinessStage, error: string, evidence: Record<string, unknown> | null, duration_ms: number) => {
    stages.push(stage(s, false, duration_ms, evidence, error));
    failure_stage = s;
  };

  const done = (status: ReadinessStatus): ReadinessResult => ({
    service_id: config.service_id,
    endpoint_url: config.endpoint_url,
    started_at,
    completed_at: new Date(),
    status,
    failure_stage,
    stages,
    observed_price,
    facilitator_url,
    facilitator_is_custom,
    facilitator_responded,
    verify_is_valid,
    verify_invalid_reason,
    authorization_ttl_seconds,
    error_message: null,
  });

  try {
    // ── Stage 1: Availability — confirm endpoint returns 402 ──────────────────
    const stageAvail = advance();
    let validatedUrl: URL;
    try {
      validatedUrl = await validateAndResolveUrl(config.endpoint_url);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'INVALID_URL';
      fail(stageAvail, code, { url: config.endpoint_url }, 0);
      markRemaining();
      return done('not_ready');
    }

    const t1 = Date.now();
    let response402: Response;
    let probeMethod: 'POST' | 'GET' = 'POST';

    try {
      response402 = await fetchWithTimeout(
        validatedUrl.toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config.test_input ?? {}),
        },
        REQUEST_TIMEOUT_MS
      );
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'UNREACHABLE';
      fail(stageAvail, code, { url: config.endpoint_url }, Date.now() - t1);
      markRemaining();
      return done('not_ready');
    }

    if (response402.status !== 402) {
      // Try GET fallback (some endpoints only gate on GET)
      try {
        const getResp = await fetchWithTimeout(validatedUrl.toString(), { method: 'GET' }, REQUEST_TIMEOUT_MS);
        if (getResp.status === 402) { response402 = getResp; probeMethod = 'GET'; }
      } catch { /* ignore */ }
    }

    const d1 = Date.now() - t1;
    if (response402.status !== 402) {
      fail(stageAvail, 'UNEXPECTED_STATUS', { http_status: response402.status, expected: 402 }, d1);
      markRemaining();
      return done('not_ready');
    }

    stages.push(stage(stageAvail, true, d1, { http_status: 402, probe_method: probeMethod }));

    // ── Stage 2: Payment terms — parse 402 body/headers ──────────────────────
    const stageTerms = advance();
    const t2 = Date.now();

    let rawBody: string;
    try {
      rawBody = await readBodyCapped(response402);
    } catch (err) {
      const code = err instanceof StageError ? err.code : 'INVALID_PAYMENT_TERMS';
      fail(stageTerms, code, { error: String(err) }, 0);
      markRemaining();
      return done('not_ready');
    }

    const v2Header = response402.headers.get('payment-required') ?? '';
    const xPayHeader = response402.headers.get('x-payment-required') ?? '';
    const paymentTerms = parseToPaymentTerms(rawBody) ?? parseToPaymentTerms(v2Header) ?? parseToPaymentTerms(xPayHeader);
    const x402ProtocolVersion = v2Header ? 'v2' : xPayHeader ? 'v1_compat' : 'v1';

    if (!paymentTerms || !paymentTerms.accepts?.length) {
      fail(stageTerms, 'INVALID_PAYMENT_TERMS', { body_preview: rawBody.slice(0, 200) }, Date.now() - t2);
      markRemaining();
      return done('not_ready');
    }

    const acceptedNetworks = NETWORK_ALIASES[config.environment] ?? ['base', 'eip155:8453'];
    const matchingOption = paymentTerms.accepts.find(opt => acceptedNetworks.includes(opt.network));

    if (!matchingOption) {
      fail(stageTerms, 'UNSUPPORTED_NETWORK', {
        expected: acceptedNetworks,
        available: paymentTerms.accepts.map(o => o.network),
      }, Date.now() - t2);
      markRemaining();
      return done('not_ready');
    }

    if (!matchingOption.payTo || !matchingOption.maxAmountRequired || !matchingOption.network) {
      fail(stageTerms, 'MISSING_FIELDS', { option: matchingOption }, Date.now() - t2);
      markRemaining();
      return done('not_ready');
    }

    // Extract facilitator URL from extra field (if provided)
    const extraFacilitator = matchingOption.extra?.['facilitator'] ?? matchingOption.extra?.['facilitatorUrl'];
    if (typeof extraFacilitator === 'string' && extraFacilitator.startsWith('https://')) {
      facilitator_url = extraFacilitator;
      facilitator_is_custom = true;
    } else {
      facilitator_url = DEFAULT_FACILITATOR;
      facilitator_is_custom = false;
    }

    authorization_ttl_seconds = matchingOption.maxTimeoutSeconds ?? 300;

    const d2 = Date.now() - t2;
    stages.push(stage(stageTerms, true, d2, {
      network: matchingOption.network,
      x402_protocol_version: x402ProtocolVersion,
      facilitator_url,
      facilitator_is_custom,
      authorization_ttl_seconds,
    }));

    // ── Stage 3: Price check — is this within our max_price? ─────────────────
    const stagePrice = advance();
    const rawPrice = matchingOption.maxAmountRequired;
    const rawNum = parseFloat(rawPrice);

    if (isNaN(rawNum) || rawNum <= 0) {
      fail(stagePrice, 'INVALID_PRICE', { raw_price: rawPrice }, 0);
      markRemaining();
      return done('not_ready');
    }

    const atomicUnits = rawNum >= 1 && Number.isInteger(rawNum);
    const parsedPrice = atomicUnits ? rawNum / 1_000_000 : rawNum;
    const maxPrice = parseFloat(config.max_price);
    observed_price = parsedPrice.toFixed(6);

    if (parsedPrice > maxPrice) {
      fail(stagePrice, 'PRICE_EXCEEDS_MAXIMUM', {
        observed_price,
        max_price: config.max_price,
      }, 0);
      markRemaining();
      return done('not_ready');
    }

    stages.push(stage(stagePrice, true, 0, {
      observed_price,
      max_price: config.max_price,
      atomic_units_detected: atomicUnits,
    }));

    // ── Stage 4: Facilitator /verify — no USDC moves ─────────────────────────
    const stageVerify = advance();
    const t4 = Date.now();

    try {
      const privateKey = getTestWalletKey();
      const account = privateKeyToAccount(privateKey);

      // Check we have enough balance to make the authorization meaningful.
      // (We don't spend — but an authorization for more than we have should
      //  always fail /verify, which is useful data for Q3 of the findings.)
      const publicClient = createPublicClient({ chain: base, transport: http() });
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }) as bigint;
      const balanceUsdc = formatUnits(balance, USDC_DECIMALS);
      const hasBalance = balance >= parseUnits(observed_price!, USDC_DECIMALS);

      // Build the x402 payment requirements shape the library expects
      const network = CAIP2_TO_X402[matchingOption.network] ?? matchingOption.network;
      const paymentRequirements = {
        scheme:            matchingOption.scheme            ?? 'exact',
        network,
        maxAmountRequired: matchingOption.maxAmountRequired,
        resource:          matchingOption.resource          ?? '',
        description:       matchingOption.description       ?? '',
        mimeType:          matchingOption.mimeType          ?? 'application/json',
        payTo:             matchingOption.payTo as string,
        maxTimeoutSeconds: matchingOption.maxTimeoutSeconds ?? 300,
        asset:             matchingOption.asset as string,
        extra: {
          name:    'USD Coin',
          version: '2',
          ...matchingOption.extra,
        },
      };

      // Build signed payment payload (EIP-3009 authorization)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unsigned = preparePaymentHeader(account.address, 1, paymentRequirements as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signed = await signPaymentHeader(account as any, paymentRequirements as any, unsigned as any);

      // Call facilitator /verify — with timeout guard
      let verifyResult: { isValid: boolean; invalidReason?: string };
      const verifyFn = facilitator_is_custom
        ? useFacilitator({ url: facilitator_url as `${string}://${string}` }).verify
        : defaultVerify;

      try {
        const resultPromise = verifyFn(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signed as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          paymentRequirements as any
        ) as Promise<{ isValid: boolean; invalidReason?: string }>;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('VERIFY_TIMEOUT')), VERIFY_TIMEOUT_MS)
        );

        verifyResult = await Promise.race([resultPromise, timeoutPromise]);
        facilitator_responded = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg === 'VERIFY_TIMEOUT';
        const d4 = Date.now() - t4;
        fail(stageVerify, isTimeout ? 'VERIFY_TIMEOUT' : 'VERIFY_ERROR', {
          facilitator_url,
          error: msg,
          wallet_balance_usdc: balanceUsdc,
          has_sufficient_balance: hasBalance,
        }, d4);
        return done('error');
      }

      verify_is_valid = verifyResult.isValid;
      verify_invalid_reason = verifyResult.invalidReason ?? null;

      const d4 = Date.now() - t4;

      if (!verifyResult.isValid) {
        fail(stageVerify, 'VERIFY_REJECTED', {
          facilitator_url,
          is_valid: false,
          invalid_reason: verifyResult.invalidReason,
          wallet_balance_usdc: balanceUsdc,
          has_sufficient_balance: hasBalance,
          authorization_ttl_seconds,
        }, d4);
        return done('not_ready');
      }

      stages.push(stage(stageVerify, true, d4, {
        facilitator_url,
        is_valid: true,
        wallet_balance_usdc: balanceUsdc,
        has_sufficient_balance: hasBalance,
        authorization_ttl_seconds,
      }));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const walletKey = process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__';
      fail(stageVerify, 'WALLET_ERROR', {
        error: msg.replaceAll(walletKey, '[REDACTED]'),
        facilitator_url,
      }, Date.now() - t4);
      return done('error');
    }

    return done('ready');

  } catch (err) {
    const walletKey = process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__';
    return {
      service_id: config.service_id,
      endpoint_url: config.endpoint_url,
      started_at,
      completed_at: new Date(),
      status: 'error',
      failure_stage,
      stages,
      observed_price,
      facilitator_url,
      facilitator_is_custom,
      facilitator_responded,
      verify_is_valid,
      verify_invalid_reason,
      authorization_ttl_seconds,
      error_message: String(err).replaceAll(process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__', '[REDACTED]'),
    };
  }
}
