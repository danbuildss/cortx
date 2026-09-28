import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BazaarPageSchema, isListing, parseBazaarItem, stableStringify, type Listing } from './bazaar.ts';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const v2Item = {
  resource: 'https://API.weather.example/forecast/?utm_source=bazaar',
  type: 'http',
  x402Version: 2,
  accepts: [
    { scheme: 'exact', network: 'eip155:1', amount: '5000', asset: '0xA0b8', payTo: '0x1111111111111111111111111111111111111111' },
    { scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: USDC, payTo: '0x2222222222222222222222222222222222222222', maxTimeoutSeconds: 60 },
  ],
  lastUpdated: '2026-09-27T10:00:00Z',
  serviceName: 'Weather\u0000 Forecast',
  description: 'Hourly forecast',
  tags: ['weather', 'data'],
  extensions: { bazaar: { info: { input: { type: 'http', method: 'POST', body: { city: 'Lagos' } }, output: { type: 'json', example: { temp: 31 } } } } },
};

const v1Item = {
  resource: 'https://x402.bankr.bot/0xabc/price',
  type: 'http',
  x402Version: 1,
  accepts: [{
    scheme: 'exact', network: 'base', maxAmountRequired: '1000', asset: USDC, payTo: '0x3333333333333333333333333333333333333333',
    facilitator: 'https://api.bankr.bot/facilitator',
    outputSchema: { input: { type: 'http', method: 'GET', queryParams: { symbol: 'BTC' } } },
  }],
};

test('V2 item: picks the Base USDC option, amount in atomic units, POST example body', () => {
  const l = parseBazaarItem(v2Item) as Listing;
  assert.ok(isListing(l));
  assert.equal(l.canonicalUrl, 'https://api.weather.example/forecast');
  assert.equal(l.option?.network, 'eip155:8453');
  assert.equal(l.priceUsdc, 0.002);
  assert.equal(l.priceAtomic, '2000');
  assert.deepEqual(l.input, { method: 'POST', hasExample: true, example: { city: 'Lagos' } });
  assert.equal(l.serviceName, 'Weather Forecast', 'control characters stripped');
  assert.equal(l.facilitatorUrl, null);
  assert.ok(l.metadata && 'info' in l.metadata);
});

test('V1 item: maxAmountRequired, published facilitator, GET with query example', () => {
  const l = parseBazaarItem(v1Item) as Listing;
  assert.equal(l.option?.network, 'base');
  assert.equal(l.priceUsdc, 0.001);
  assert.equal(l.facilitatorUrl, 'https://api.bankr.bot/facilitator');
  assert.deepEqual(l.input, { method: 'GET', hasExample: true, example: { symbol: 'BTC' } });
});

test('POST without an example → hasExample false', () => {
  const l = parseBazaarItem({ ...v2Item, extensions: { bazaar: { info: { input: { method: 'POST' } } } } }) as Listing;
  assert.equal(l.input.hasExample, false);
});

test('no Base option → option null (classifier will say unsupported_network)', () => {
  const l = parseBazaarItem({ ...v2Item, accepts: [v2Item.accepts[0]] }) as Listing;
  assert.equal(l.option, null);
});

test('rejects invalid, non-http and non-https items', () => {
  assert.deepEqual(parseBazaarItem({ nope: true }), { ok: false, reason: 'invalid_item' });
  assert.equal((parseBazaarItem({ ...v1Item, type: 'mcp' }) as { reason: string }).reason, 'not_http');
  assert.equal((parseBazaarItem({ ...v1Item, resource: 'http://insecure.example/x' }) as { reason: string }).reason, 'invalid_url');
});

test('untrusted text is capped', () => {
  const l = parseBazaarItem({ ...v1Item, serviceName: 'x'.repeat(500), description: 'y'.repeat(5000), tags: Array(50).fill('t'.repeat(100)) }) as Listing;
  assert.equal(l.serviceName!.length, 120);
  assert.equal(l.description!.length, 1000);
  assert.equal(l.tags.length, 20);
  assert.equal(l.tags[0].length, 40);
});

test('oversized example/metadata is dropped, not stored', () => {
  const big = { blob: 'z'.repeat(20_000) };
  const l = parseBazaarItem({ ...v2Item, extensions: { bazaar: { info: { input: { method: 'POST', body: big } } } } }) as Listing;
  assert.equal(l.input.example, null);
  assert.equal(l.input.hasExample, false);
  assert.equal(l.metadata, null);
});

test('listing hash: stable across key order, changes when the price changes', () => {
  const a = parseBazaarItem(v1Item) as Listing;
  const reordered = JSON.parse(stableStringify(v1Item));
  assert.equal((parseBazaarItem(reordered) as Listing).listingHash, a.listingHash);
  const pricier = { ...v1Item, accepts: [{ ...v1Item.accepts[0], maxAmountRequired: '5000' }] };
  assert.notEqual((parseBazaarItem(pricier) as Listing).listingHash, a.listingHash);
});

test('page schema tolerates extra fields and missing pagination', () => {
  assert.ok(BazaarPageSchema.safeParse({ items: [], extra: 1 }).success);
  assert.ok(BazaarPageSchema.safeParse({ x402Version: 2, items: [v2Item], pagination: { limit: 100, offset: 0, total: 16170 } }).success);
  assert.equal(BazaarPageSchema.safeParse({ nope: [] }).success, false);
});
