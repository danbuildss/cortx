import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canResolveIncident, paidIntervalMinutes, worseStatus } from './schedule.ts';

test('paid checks go daily only when readiness is ready and the paid check passed', () => {
  assert.equal(paidIntervalMinutes(240, 'ready', true), 1440);
  assert.equal(paidIntervalMinutes(240, 'ready', false), 240, 'failed paid check re-checks within hours');
  for (const s of ['not_ready', 'unavailable', 'error', 'unknown', null, undefined]) {
    assert.equal(paidIntervalMinutes(240, s, true), 240, String(s));
  }
  assert.equal(paidIntervalMinutes(2880, 'ready', true), 2880, 'never makes a longer interval shorter');
});

test('incident resolution tiers', () => {
  // readiness resolves only readiness incidents
  assert.equal(canResolveIncident('readiness', 'readiness'), true);
  assert.equal(canResolveIncident('readiness', 'canary'), false);
  assert.equal(canResolveIncident('readiness', 'full'), false);
  // paid checks resolve readiness incidents
  assert.equal(canResolveIncident('canary', 'readiness'), true);
  assert.equal(canResolveIncident('full', 'readiness'), true);
  assert.equal(canResolveIncident('full', 'canary'), true);
  assert.equal(canResolveIncident('canary', 'full'), false);
  // lightweight never resolves anything
  assert.equal(canResolveIncident('lightweight', 'lightweight'), false);
  assert.equal(canResolveIncident('lightweight', 'readiness'), false);
});

test('a readiness failure never hides a worse paid-check status', () => {
  assert.equal(worseStatus('critical', 'degraded'), 'critical');
  assert.equal(worseStatus('operational', 'critical'), 'critical');
  assert.equal(worseStatus('unknown', 'degraded'), 'degraded');
  assert.equal(worseStatus('degraded', 'degraded'), 'degraded');
});
