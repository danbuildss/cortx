/**
 * CORTX check results as x402 Reliability Spec evidence records (v0.3):
 * https://github.com/danbuildss/x402-reliability-spec
 *
 * CORTX stores its own stage list (availability, payment_terms, price_check,
 * payment, delivery, json_parse, schema_validation). The spec numbers 7
 * stages differently, so this maps one onto the other:
 *
 *   CORTX availability      → spec 1 availability + 2 402_response
 *   CORTX payment_terms     → spec 3 payment_terms
 *   CORTX price_check       → spec 4 price_validity
 *   CORTX payment + delivery→ spec 5 payment_processing (paid response) and
 *                             spec 6 delivery (non-empty body)
 *   CORTX json_parse + schema_validation → spec 7 schema_validity
 *
 * Checks with status `error` (wallet, budget, our own crash) become
 * `outcome: "checker_error"` and are never attributed to the service.
 * Pure function: no network, no database.
 */
import type { CheckResult, StageName, StageResult } from './types';
import type { SettlementEvidence } from './x402';

export const SPEC_VERSION = '0.3';

const SPEC_STAGE_NAMES = [
  'availability', '402_response', 'payment_terms', 'price_validity',
  'payment_processing', 'delivery', 'schema_validity',
] as const;

export type SpecStage = {
  stage: number;
  name: (typeof SPEC_STAGE_NAMES)[number];
  passed: boolean | null;
  error: string | null;
  error_code?: string | null;
  fault?: 'service' | 'checker' | null;
  latency_ms?: number | null;
  [field: string]: unknown;
};

export type SpecEvidenceRecord = {
  spec_version: string;
  endpoint: string;
  checked_at: string;
  network: string;
  check_type: 'lightweight' | 'full';
  outcome: 'passed' | 'failed' | 'partial' | 'checker_error';
  overall_passed: boolean;
  highest_stage_passed: number;
  x402_version: 1 | 2 | null;
  input_source?: 'owner_provided' | 'service_example' | 'none';
  checker_id: string;
  stages: SpecStage[];
};

// CORTX codes that the spec names differently
const CODE_ALIASES: Record<string, string> = {
  SSRF_BLOCKED: 'BLOCKED_ADDRESS',
  BLOCKED_PORT: 'BLOCKED_ADDRESS',
  NON_HTTPS: 'INVALID_URL',
  BETA_PRICE_CAP_EXCEEDED: 'PRICE_EXCEEDS_MAXIMUM',
  SCHEMA_COMPILE_ERROR: 'SCHEMA_VALIDATION_FAILED',
};

const CHECKER_ERROR_TEXT = 'CORTX-side problem (not the service\'s fault); not counted against the service';

// Paid response never arrived or wasn't 2xx: the payment wasn't processed (spec 5)
const PAID_REQUEST_CODES = new Set(['UNEXPECTED_STATUS', 'NO_RESPONSE', 'TIMEOUT', 'UNREACHABLE']);

function versionOf(v: unknown): 1 | 2 | null {
  if (v === 1 || v === 'v1') return 1;
  if (v === 2 || v === 'v2') return 2;
  return null;
}

export function toSpecRecord(
  result: CheckResult,
  ctx: {
    endpoint: string;
    checkerId?: string;
    inputSource?: SpecEvidenceRecord['input_source'];
    /** Public output: replace CORTX-side error details (wallet, budget) with a generic line */
    redactCheckerErrors?: boolean;
  },
): SpecEvidenceRecord {
  const by = new Map<StageName, StageResult>(result.stages.map((s) => [s.stage, s]));
  const get = (n: StageName) => by.get(n);
  const ev = (n: StageName) => (get(n)?.evidence ?? {}) as Record<string, unknown>;

  const out: SpecStage[] = SPEC_STAGE_NAMES.map((name, i) => ({ stage: i + 1, name, passed: null, error: null }));
  const set = (n: number, fields: Partial<SpecStage>) => Object.assign(out[n - 1], fields);
  const failAt = (n: number, cortx: StageResult, fault: 'service' | 'checker', extra: Partial<SpecStage> = {}) => {
    const code = cortx.error ?? 'UNKNOWN';
    const message = typeof cortx.evidence?.error === 'string' ? cortx.evidence.error.slice(0, 300) : null;
    set(n, {
      passed: false,
      error_code: CODE_ALIASES[code] ?? code,
      fault,
      error: fault === 'checker' && ctx.redactCheckerErrors ? CHECKER_ERROR_TEXT : (message ?? code),
      latency_ms: cortx.duration_ms,
      ...(CODE_ALIASES[code] ? { cortx_error_code: code } : {}),
      ...extra,
    });
  };
  const faultOf = (s: StageResult): 'service' | 'checker' =>
    s.evidence?.cortx_side === true || result.status === 'error' ? 'checker' : 'service';

  // ── 1 + 2: availability / 402 ────────────────────────────────────────────
  const avail = get('availability');
  if (avail?.passed === true) {
    set(1, { passed: true, latency_ms: avail.duration_ms });
    set(2, { passed: true, status_code: 402 });
  } else if (avail?.passed === false) {
    if (avail.error === 'UNEXPECTED_STATUS') {
      // It answered — just not with a 402
      set(1, { passed: true, latency_ms: avail.duration_ms });
      failAt(2, avail, faultOf(avail), { status_code: (avail.evidence?.http_status as number) ?? null });
    } else {
      failAt(1, avail, faultOf(avail));
    }
  }

  // ── 3: payment terms ─────────────────────────────────────────────────────
  const terms = get('payment_terms');
  const termsEv = ev('payment_terms');
  const x402_version = versionOf(termsEv.x402_protocol_version);
  if (terms?.passed === true) {
    set(3, {
      passed: true,
      latency_ms: terms.duration_ms,
      x402_version,
      terms_source: termsEv.terms_source ?? null,
      scheme: termsEv.payment_scheme ?? null,
      network: termsEv.network ?? null,
    });
  } else if (terms?.passed === false) {
    failAt(3, terms, faultOf(terms));
  }

  // ── 4: price ─────────────────────────────────────────────────────────────
  const price = get('price_check');
  const priceEv = ev('price_check');
  if (price?.passed === true) {
    set(4, {
      passed: true,
      price_usdc: Number(priceEv.parsed_price),
      price_atomic_units: priceEv.atomic_units_detected ?? null,
      currency: 'USDC',
    });
  } else if (price?.passed === false) {
    failAt(4, price, faultOf(price), priceEv.parsed_price != null ? { price_usdc: Number(priceEv.parsed_price) } : {});
  }

  // ── 5 + 6: paid request, delivery ────────────────────────────────────────
  const pay = get('payment');
  const delivery = get('delivery');
  const delEv = ev('delivery');
  const settlement = delEv.settlement as SettlementEvidence | undefined;
  const receipt: Partial<SpecStage> = settlement
    ? { settlement_status: settlement.status, tx_hash: settlement.tx_hash, receipt_header: settlement.receipt_header }
    : {};
  const paymentHeader = ev('payment').payment_header ?? null;

  if (pay?.passed === false) {
    failAt(5, pay, faultOf(pay), { payment_header: paymentHeader });
  } else if (pay?.passed === true && delivery) {
    const status = (delEv.http_status as number | undefined) ?? null;
    if (delivery.passed === false && PAID_REQUEST_CODES.has(delivery.error ?? '')) {
      failAt(5, delivery, faultOf(delivery), { response_status: status, payment_header: paymentHeader, ...receipt });
    } else if (delivery.passed !== null) {
      set(5, { passed: true, latency_ms: delivery.duration_ms, response_status: status, payment_header: paymentHeader, network: settlement?.network ?? termsEv.network ?? null, ...receipt });
      if (delivery.passed === true) set(6, { passed: true, body_bytes: delEv.body_length_bytes ?? null });
      else failAt(6, delivery, faultOf(delivery));
    }
  }

  // ── 7: JSON + schema ─────────────────────────────────────────────────────
  const json = get('json_parse');
  const schema = get('schema_validation');
  if (json?.passed === false) {
    failAt(7, json, faultOf(json));
  } else if (schema?.passed === false) {
    failAt(7, schema, faultOf(schema));
  } else if (schema?.passed === true) {
    set(7, ev('schema_validation').skipped
      ? { passed: null, schema_source: null }
      : { passed: true, validation_errors: [] });
  }

  // ── Checker-side error without a failed stage (e.g. CORTX crashed) ───────
  if (result.status === 'error' && !out.some((s) => s.fault === 'checker')) {
    const lastRun = out.reduce((n, s) => (s.passed !== null ? s.stage : n), 0);
    const at = out[Math.min(lastRun, 6)];
    const error = ctx.redactCheckerErrors ? CHECKER_ERROR_TEXT : (result.error_message ?? 'CORTX internal error');
    Object.assign(at, { passed: false, error_code: 'CHECKER_ERROR', fault: 'checker', error });
  }

  const highest = out.reduce((n, s) => (s.passed === true ? s.stage : n), 0);
  const outcome: SpecEvidenceRecord['outcome'] =
    result.status === 'error' ? 'checker_error'
      : result.status === 'failed' ? 'failed'
        : result.check_type === 'lightweight' ? 'partial'
          : 'passed';

  return {
    spec_version: SPEC_VERSION,
    endpoint: ctx.endpoint,
    checked_at: result.started_at.toISOString(),
    network: String(termsEv.network ?? 'base'),
    check_type: result.check_type === 'lightweight' ? 'lightweight' : 'full',
    outcome,
    overall_passed: outcome === 'passed',
    highest_stage_passed: highest,
    x402_version,
    ...(ctx.inputSource ? { input_source: ctx.inputSource } : {}),
    checker_id: ctx.checkerId ?? 'cortx',
    stages: out,
  };
}
