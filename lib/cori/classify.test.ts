import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, QUEUEABLE, type ClassifyInput } from './classify.ts';

const base: ClassifyInput = {
  probe: 'ok',
  terms: { network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', scheme: 'exact', transferMethod: null, priceUsdc: 0.002, facilitatorPublished: false },
  input: { method: 'GET', hasExample: true },
  maxPriceUsdc: 0.05,
};
const run = (over: Partial<ClassifyInput>, terms: Partial<NonNullable<ClassifyInput['terms']>> = {}) =>
  classify({ ...base, ...over, terms: over.terms === null ? null : { ...base.terms!, ...terms } });

test('eligible: Base + USDC + exact + cheap + probed + usable input', () => {
  const r = run({});
  assert.equal(r.classification, 'eligible');
  assert.deepEqual(r.reasons, ['network:base', 'asset:usdc', 'scheme:exact', 'price:0.002', 'facilitator:unpublished', 'probe:ok', 'input:get']);
  assert.ok(QUEUEABLE.has(r.classification));
});

test('rule order and every class', () => {
  const cases: Array<[string, Partial<ClassifyInput>, Partial<NonNullable<ClassifyInput['terms']>>?]> = [
    ['blocked', { blockedReason: 'ssrf', linked: 'monitored' }],
    ['gone', { gone: true, linked: 'monitored' }],
    ['already_monitored', { linked: 'monitored' }],
    ['already_listed', { linked: 'listed' }],
    ['already_submitted', { linked: 'submitted' }],
    ['unreachable', { probe: 'unreachable' }],
    ['not_x402', { probe: 'not_x402' }],
    ['invalid_terms', { probe: 'invalid_terms' }],
    ['invalid_terms', { terms: null }],
    ['unsupported_network', {}, { network: 'eip155:1' }],
    ['unsupported_network', {}, { network: 'solana' }],
    ['unsupported_asset', {}, { asset: '0xdeadbeef' }],
    ['unsupported_scheme', {}, { scheme: 'upto' }],
    ['unsupported_scheme', {}, { transferMethod: 'permit2' }],
    ['invalid_terms', {}, { priceUsdc: 0 }],
    ['invalid_terms', {}, { priceUsdc: null }],
    ['too_expensive', {}, { priceUsdc: 0.06 }],
    ['pending', { probe: null }],
    ['needs_input', { input: { method: 'POST', hasExample: false } }],
    ['needs_input', { input: { method: 'OTHER', hasExample: false } }],
    ['eligible', { input: { method: 'POST', hasExample: true } }],
    ['eligible', {}, { network: 'base', asset: 'USDC', transferMethod: 'eip3009' }],
    ['eligible', {}, { priceUsdc: 0.05 }], // exactly at the cap
  ];
  for (const [expected, over, terms] of cases) {
    assert.equal(run(over, terms).classification, expected, `${expected} ${JSON.stringify({ over, terms })}`);
  }
});

test('only eligible and needs_input are queued', () => {
  assert.deepEqual([...QUEUEABLE].sort(), ['eligible', 'needs_input']);
});

test('reasons explain the decision', () => {
  assert.deepEqual(run({}, { priceUsdc: 2 }).reasons, ['network:base', 'asset:usdc', 'scheme:exact', 'price:2>0.05']);
  assert.ok(run({ input: { method: 'POST', hasExample: false } }).reasons.includes('input:post_without_example'));
  assert.ok(run({}, { facilitatorPublished: true }).reasons.includes('facilitator:published'));
});
