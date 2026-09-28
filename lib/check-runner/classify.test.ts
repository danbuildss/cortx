import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyStatus, isCortxSidePaymentFailure } from './classify.ts';
import type { StageResult } from './types.ts';

test('wallet and budget failures are CORTX-side', () => {
  for (const code of [
    'WALLET_NOT_CONFIGURED',
    'INSUFFICIENT_BALANCE',
    'BALANCE_READ_FAILED',
    'SPEND_RESERVATION_FAILED',
    'DAILY_SPEND_CAP_EXCEEDED',
    'MONTHLY_SPEND_CAP_EXCEEDED',
    'PAYMENT_TIMEOUT',
  ]) {
    assert.equal(isCortxSidePaymentFailure(code), true, code);
  }
});

test('service-side payment failures still count against the service', () => {
  for (const code of ['NO_USDC_OPTION', 'PAYMENT_SIGNING_FAILED', 'WALLET_ERROR', '']) {
    assert.equal(isCortxSidePaymentFailure(code), false, code);
  }
  assert.equal(isCortxSidePaymentFailure(null), false);
  assert.equal(isCortxSidePaymentFailure(undefined), false);
});

const stage = (s: StageResult['stage'], passed: boolean | null): StageResult =>
  ({ stage: s, passed, duration_ms: 0, evidence: null });

test('failure at a critical stage marks the service critical', () => {
  const r = classifyStatus([stage('availability', true), stage('payment_terms', true), stage('price_check', true), stage('payment', false)], 100);
  assert.deepEqual(r, { check_status: 'failed', service_status: 'critical', failure_stage: 'payment' });
});

test('failure before payment marks the service degraded', () => {
  const r = classifyStatus([stage('availability', true), stage('payment_terms', false)], 100);
  assert.equal(r.service_status, 'degraded');
});

test('slow but passing check is degraded, fast one is operational', () => {
  const ok = [stage('availability', true), stage('delivery', true)];
  assert.equal(classifyStatus(ok, 6000, 5000).service_status, 'degraded');
  assert.equal(classifyStatus(ok, 100, 5000).service_status, 'operational');
});
