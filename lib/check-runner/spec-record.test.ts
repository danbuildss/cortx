import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSpecRecord } from './spec-record.ts';
import type { CheckResult, StageName, StageResult } from './types.ts';

const ok = (stage: StageName, evidence: Record<string, unknown> = {}): StageResult => ({ stage, passed: true, duration_ms: 5, evidence });
const skip = (stage: StageName): StageResult => ({ stage, passed: null, duration_ms: null, evidence: null });
const terms = ok('payment_terms', { x402_protocol_version: 'v2', network: 'eip155:8453', terms_source: 'payment-required', payment_scheme: 'exact' });
const price = ok('price_check', { parsed_price: '0.001000', atomic_units_detected: true });

function result(status: CheckResult['status'], stages: StageResult[], error_message: string | null = null): CheckResult {
  return {
    service_id: 's', started_at: new Date('2026-09-28T12:00:00Z'), completed_at: new Date(), latency_ms: null,
    status, failure_stage: null, stages, observed_price: '0.001000', error_message, check_type: 'full',
  };
}

test('public output hides CORTX wallet details on checker-side errors', () => {
  const r = result('error', [
    ok('availability'), terms, price,
    { stage: 'payment', passed: false, duration_ms: 3, error: 'INSUFFICIENT_BALANCE', evidence: { error: 'CORTX wallet has 0.5 USDC, need 1', cortx_side: true } },
    skip('delivery'), skip('json_parse'), skip('schema_validation'),
  ]);
  const internal = toSpecRecord(r, { endpoint: 'https://x.example/a' });
  const pub = toSpecRecord(r, { endpoint: 'https://x.example/a', redactCheckerErrors: true });
  assert.equal(internal.stages[4].error, 'CORTX wallet has 0.5 USDC, need 1');
  assert.doesNotMatch(String(pub.stages[4].error), /USDC|wallet has/);
  assert.equal(pub.outcome, 'checker_error');
  assert.equal(pub.stages[4].fault, 'checker');
  assert.equal(pub.overall_passed, false);
});

test('a CORTX crash with no failed stage still becomes a checker-side error', () => {
  const r = result('error', [ok('availability'), terms], 'TypeError: boom');
  const rec = toSpecRecord(r, { endpoint: 'https://x.example/a', redactCheckerErrors: true });
  assert.equal(rec.outcome, 'checker_error');
  const failed = rec.stages.filter((s) => s.passed === false);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].stage, 4, 'marked on the first stage after the last one that ran');
  assert.equal(failed[0].error_code, 'CHECKER_ERROR');
  assert.equal(failed[0].fault, 'checker');
  assert.doesNotMatch(String(failed[0].error), /boom/);
});

test('CORTX codes the spec names differently are translated, the original kept', () => {
  const r = result('failed', [
    { stage: 'availability', passed: false, duration_ms: 1, error: 'SSRF_BLOCKED', evidence: {} },
    skip('payment_terms'), skip('price_check'), skip('payment'), skip('delivery'), skip('json_parse'), skip('schema_validation'),
  ]);
  const rec = toSpecRecord(r, { endpoint: 'https://x.example/a' });
  assert.equal(rec.stages[0].error_code, 'BLOCKED_ADDRESS');
  assert.equal(rec.stages[0].cortx_error_code, 'SSRF_BLOCKED');
  assert.equal(rec.stages[0].fault, 'service');
  assert.equal(rec.highest_stage_passed, 0);
  assert.equal(rec.x402_version, null);
});

test('an empty paid body: payment processed (5), delivery failed (6)', () => {
  const r = result('failed', [
    ok('availability'), terms, price, ok('payment', { payment_header: 'PAYMENT-SIGNATURE' }),
    { stage: 'delivery', passed: false, duration_ms: 9, error: 'EMPTY_BODY', evidence: { http_status: 200, error: 'Empty response body', settlement: { status: 'confirmed', tx_hash: '0xab', network: 'eip155:8453', explorer_url: null, error_reason: null, receipt_header: 'PAYMENT-RESPONSE' } } },
    skip('json_parse'), skip('schema_validation'),
  ]);
  const rec = toSpecRecord(r, { endpoint: 'https://x.example/a' });
  assert.equal(rec.stages[4].passed, true);
  assert.equal(rec.stages[4].settlement_status, 'confirmed');
  assert.equal(rec.stages[5].passed, false);
  assert.equal(rec.stages[5].error_code, 'EMPTY_BODY');
  assert.equal(rec.highest_stage_passed, 5);
});
