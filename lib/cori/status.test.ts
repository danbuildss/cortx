import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASS_LABELS, CLASS_ORDER, describeEvent, explainReasons, heartbeatState, isDryRunKind,
  parseWatchdogState, watchdogDecision,
} from './status.ts';
import { classify } from './classify.ts';

const now = new Date('2026-09-30T12:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

test('heartbeat: green < 10 min, amber < 30 min, red after, none before first run', () => {
  assert.equal(heartbeatState(null, now), 'not_started');
  assert.equal(heartbeatState(minsAgo(2), now), 'healthy');
  assert.equal(heartbeatState(minsAgo(9.9), now), 'healthy');
  assert.equal(heartbeatState(minsAgo(10), now), 'late');
  assert.equal(heartbeatState(minsAgo(29), now), 'late');
  assert.equal(heartbeatState(minsAgo(30), now), 'silent');
});

test('dry-run runs are recognised', () => {
  assert.equal(isDryRunKind('dry:discover:cdp_bazaar'), true);
  assert.equal(isDryRunKind('heartbeat'), false);
  assert.equal(isDryRunKind(null), false);
});

test('every classification has a label and a place in the panel', () => {
  assert.equal(new Set(CLASS_ORDER).size, CLASS_ORDER.length);
  for (const c of CLASS_ORDER) assert.ok(CLASS_LABELS[c], c);
  assert.equal(CLASS_ORDER.length, Object.keys(CLASS_LABELS).length);
});

test('"why eligible" reads as plain English, straight from the classifier reasons', () => {
  const r = classify({
    probe: 'ok',
    terms: { network: 'eip155:8453', asset: 'usdc', scheme: 'exact', transferMethod: null, priceUsdc: 0.002, facilitatorPublished: false },
    input: { method: 'GET', hasExample: true },
    maxPriceUsdc: 0.05,
  });
  assert.deepEqual(explainReasons(r.reasons), [
    'Base ✓', 'USDC ✓', 'Standard payment ✓', '$0.002 per call ✓', 'Facilitator not published', 'Free check passed ✓', 'Callable with GET ✓',
  ]);
  assert.deepEqual(explainReasons(['price:0.09>0.05']), ['$0.09 per call, over the $0.05 cap ✗']);
  assert.deepEqual(explainReasons(['input:post_without_example']), ['POST with no example input — a paid check would need one']);
  assert.deepEqual(explainReasons(['probe:retrying(1/3)']), ['Free check failed, retrying (1/3)']);
  assert.deepEqual(explainReasons(['something:unknown']), [], 'unknown reasons are not shown raw');
  assert.deepEqual(explainReasons(null), []);
});

test('activity descriptions', () => {
  assert.equal(describeEvent('first_seen', { source: 'cdp_bazaar' }), 'first seen via Coinbase Bazaar');
  assert.equal(describeEvent('price_changed', { from: 0.001, to: 0.003 }), 'price changed $0.001 → $0.003');
  assert.equal(describeEvent('queued', null), 'added to review queue');
  assert.equal(describeEvent('probe_status_changed', { from: null, to: 'ok' }), 'free check passed');
  assert.equal(describeEvent('probe_status_changed', { from: 'ok', to: 'not_x402' }), 'free check: not x402');
  assert.equal(describeEvent('classification_changed', { to: 'too_expensive' }), 'now: too expensive');
  assert.equal(describeEvent('rejected', { reason: 'spam' }), 'rejected: spam');
  assert.equal(describeEvent('approved', {}), 'approved into the registry');
});

test('watchdog: quiet before Cori ever ran, and while healthy', () => {
  assert.equal(watchdogDecision(null, null, now).send, null);
  assert.equal(watchdogDecision(minsAgo(5), null, now).send, null);
  assert.equal(watchdogDecision(minsAgo(20), null, now).send, null, 'late is not silent yet');
});

test('watchdog: alerts once when silent, repeats at most every 6 hours, then says it is back', () => {
  let d = watchdogDecision(minsAgo(42), null, now);
  assert.equal(d.send, 'down');
  assert.equal(d.next.down, true);

  let state = d.next;
  const later = (h: number) => new Date(now.getTime() + h * 3_600_000);
  d = watchdogDecision(minsAgo(42), state, later(1));
  assert.equal(d.send, null, 'no repeat within 6 hours');
  d = watchdogDecision(minsAgo(42), state, later(6));
  assert.equal(d.send, 'down', 'reminder after 6 hours');
  state = d.next;

  d = watchdogDecision(later(6.1), state, later(6.1));
  assert.equal(d.send, 'recovered');
  assert.equal(d.next.down, false);
  assert.equal(watchdogDecision(later(6.2), d.next, later(6.2)).send, null, 'only one recovery message');
});

test('watchdog state survives storage round-trips and bad values', () => {
  const s = { down: true, last_alert_at: now.toISOString() };
  assert.deepEqual(parseWatchdogState(JSON.stringify(s)), s);
  assert.equal(parseWatchdogState(null), null);
  assert.equal(parseWatchdogState('not json'), null);
  assert.deepEqual(parseWatchdogState('{}'), { down: false, last_alert_at: null });
});
