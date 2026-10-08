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
  assert.deepEqual(l.input, { method: 'POST', rawMethod: 'POST', hasExample: true, example: { city: 'Lagos' } });
  assert.equal(l.serviceName, 'Weather Forecast', 'control characters stripped');
  assert.equal(l.facilitatorUrl, null);
  assert.ok(l.metadata && 'info' in l.metadata);
});

test('V1 item: maxAmountRequired, published facilitator, GET with query example', () => {
  const l = parseBazaarItem(v1Item) as Listing;
  assert.equal(l.option?.network, 'base');
  assert.equal(l.priceUsdc, 0.001);
  assert.equal(l.facilitatorUrl, 'https://api.bankr.bot/facilitator');
  assert.deepEqual(l.input, { method: 'GET', rawMethod: 'GET', hasExample: true, example: { symbol: 'BTC' } });
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

test('dynamic routes: identity is origin + routeTemplate; probe URL fills path params', () => {
  const item = (id: string) => ({
    ...v2Item,
    resource: `https://api.users.example/users/${id}`,
    extensions: { bazaar: { routeTemplate: '/users/:userId', info: { input: { type: 'http', method: 'GET', pathParams: { userId: id } } } } },
  });
  const a = parseBazaarItem(item('123')) as Listing;
  const b = parseBazaarItem(item('456')) as Listing;
  assert.equal(a.canonicalUrl, 'https://api.users.example/users/:userId');
  assert.equal(a.canonicalUrl, b.canonicalUrl, 'one service per template');
  assert.equal(a.routeTemplate, '/users/:userId');
  assert.equal(a.probeUrl, 'https://api.users.example/users/123');

  // Listed with the template itself as the path: filled from the example
  const t = parseBazaarItem({ ...item('789'), resource: 'https://api.users.example/users/:userId' }) as Listing;
  assert.equal(t.probeUrl, 'https://api.users.example/users/789');
});

test('route templates are validated as the bazaar spec requires', async () => {
  const { validRouteTemplate } = await import('./bazaar.ts');
  assert.equal(validRouteTemplate('/weather/:country/:city'), '/weather/:country/:city');
  for (const bad of ['', 'users/:id', '/users/../admin', '/a/%2e%2e/b', '/x/http://evil.example', '/sp ace', '/%zz', 42, null]) {
    assert.equal(validRouteTemplate(bad), null, String(bad));
  }
  // An invalid template is ignored: identity falls back to the concrete URL
  const l = parseBazaarItem({ ...v2Item, extensions: { bazaar: { routeTemplate: '/../etc', info: { input: { type: 'http', method: 'GET' } } } } }) as Listing;
  assert.equal(l.routeTemplate, null);
  assert.equal(l.canonicalUrl, 'https://api.weather.example/forecast');
});

test('methods other than GET/POST are kept as listed (never probed)', () => {
  for (const m of ['DELETE', 'put', 'PATCH', 'HEAD']) {
    const l = parseBazaarItem({ ...v2Item, extensions: { bazaar: { info: { input: { type: 'http', method: m, body: {} } } } } }) as Listing;
    assert.equal(l.input.method, 'OTHER');
    assert.equal(l.input.rawMethod, m.toUpperCase());
  }
});

test('listing snapshot: what Cori keeps of each version, capped', () => {
  const l = parseBazaarItem(v2Item) as Listing;
  assert.equal(l.payTo, '0x2222222222222222222222222222222222222222', 'raw pay-to of the Base option');
  assert.equal(l.lastUpdated, '2026-09-27T10:00:00.000Z');
  assert.equal(l.snapshot.resource, v2Item.resource, 'the URL exactly as listed');
  assert.deepEqual(l.snapshot.accepts, v2Item.accepts);
  assert.deepEqual(l.snapshot.extensions, v2Item.extensions);
  assert.equal(l.snapshot.resourceMeta?.description, 'Hourly forecast');
  assert.ok(l.snapshot.itemBytes > 100);

  const big = parseBazaarItem({ ...v2Item, lastUpdated: 'not a date', extensions: { bazaar: { blob: 'z'.repeat(20_000) } } }) as Listing;
  assert.equal(big.snapshot.extensions, null, 'oversized extensions dropped');
  assert.ok(big.snapshot.itemBytes > 20_000, 'but the size is kept, so the drop is visible');
  assert.equal(big.lastUpdated, null);
});

test('NUL characters are removed everywhere (Postgres rejects them in text and jsonb)', async () => {
  const { stripNul } = await import('./bazaar.ts');
  assert.deepEqual(stripNul({ 'k\u0000': ['a\u0000b', { c: 'd\u0000' }], n: 1 }), { k: ['ab', { c: 'd' }], n: 1 });
  const dirty = {
    ...v2Item,
    description: 'bad\u0000text',
    accepts: [{ ...v2Item.accepts[1], extra: { name: 'USD\u0000C' } }],
    extensions: { bazaar: { info: { input: { type: 'http', method: 'POST', body: { q: 'x\u0000y' } } } } },
  };
  const l = parseBazaarItem(dirty) as Listing;
  assert.ok(isListing(l));
  assert.ok(!JSON.stringify(l).includes('\\u0000'), 'no NUL anywhere in what Cori stores');
  assert.equal(l.description, 'badtext');
});
