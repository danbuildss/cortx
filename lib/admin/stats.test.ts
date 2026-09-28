import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUsdc, isCortxSide, isSuccess, splitStageFailures, successRate, sumPaid } from './stats.ts';

test('success rate leaves CORTX-side errors out', () => {
  // Screenshot numbers: 57 checks, 43 passed, 10 facilitator auth errors
  assert.equal(successRate(57, 43, 0), '75.4');
  assert.equal(successRate(57, 43, 10), '91.5');
  assert.equal(successRate(10, 0, 10), null);
  assert.equal(successRate(0, 0, 0), null);
});

test('statuses: legacy success counts, error is ours', () => {
  assert.equal(isSuccess('passed'), true);
  assert.equal(isSuccess('success'), true);
  assert.equal(isSuccess('failed'), false);
  assert.equal(isCortxSide('error'), true);
  assert.equal(isCortxSide('failed'), false);
});

test('paid sums add every row and respect the window', () => {
  const rows = [
    { started_at: '2026-09-28T10:00:00Z', observed_price: '0.001' },
    { started_at: '2026-09-01T10:00:00Z', observed_price: 0.002 },
    { started_at: '2026-06-01T10:00:00Z', observed_price: '0.3' },
    { started_at: '2026-06-01T10:00:00Z', observed_price: null },
  ];
  assert.equal(sumPaid(rows).toFixed(4), '0.3030');
  assert.equal(sumPaid(rows, Date.parse('2026-09-01T00:00:00Z')).toFixed(4), '0.0030');
});

test('USDC formatting never rounds small spend to zero', () => {
  assert.equal(formatUsdc(0), '$0.00');
  assert.equal(formatUsdc(0.004), '$0.0040');
  assert.equal(formatUsdc(0.389), '$0.3890');
  assert.equal(formatUsdc(12.5), '$12.50');
});

test('stage failures split service vs CORTX-side, most first', () => {
  const checks = [
    ...Array.from({ length: 10 }, () => ({ status: 'error', failure_stage: 'facilitator_verify' })),
    ...Array.from({ length: 4 }, () => ({ status: 'failed', failure_stage: 'price_check' })),
    { status: 'failed', failure_stage: 'delivery' },
    { status: 'passed', failure_stage: null },
    { status: 'failed', failure_stage: null },
  ];
  const { service, cortx } = splitStageFailures(checks);
  assert.deepEqual(service, [['price_check', 4], ['delivery', 1]]);
  assert.deepEqual(cortx, [['facilitator_verify', 10]]);
});
