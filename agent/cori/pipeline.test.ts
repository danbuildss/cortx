// End-to-end Scout pipeline against a fake Bazaar + fake x402 services, with
// the in-memory store. The same flow runs against real Postgres as the
// least-privilege role in pg.integration.test.ts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from './config.ts';
import { silentLogger } from './log.ts';
import { HostLimiter } from './limiter.ts';
import { MemoryStore } from './memory-store.ts';
import { runCycle, type Deps } from './pipeline.ts';
import { startFakeEcosystem, standardListings, type FakeEcosystem } from './fake-ecosystem.ts';

let eco: FakeEcosystem;
before(async () => { eco = await startFakeEcosystem(); });
after(() => eco.close());

function setup(overrides: { cap?: number } = {}) {
  eco.items = standardListings(eco);
  eco.hits.length = 0;
  let clock = new Date('2026-09-28T10:00:00Z');
  const store = new MemoryStore({
    now: () => clock,
    sources: [{ id: 'cdp_bazaar', url: eco.bazaarUrl, enabled: true, interval_minutes: 360, last_run_at: null }],
    known: {
      services: [{ id: 'svc-1', endpoint_url: eco.url('svc.test', '/svc/monitored') }],
      seeds: [],
      submissions: [{ id: 'sub-1', endpoint_url: eco.url('svc.test', '/svc/submitted'), status: 'pending', source: 'public', discovered_service_id: null }],
    },
  });
  const deps: Deps = {
    store,
    config: defaultConfig({ dailyQueueCap: overrides.cap ?? 25, bazaarPageLimit: 5, perHostMinIntervalMs: 0 }),
    log: silentLogger,
    limiter: new HostLimiter(0, 1000),
    now: () => clock,
    fetchOptions: eco.fetchOptions,
    sleep: async () => {},
  };
  return { store, deps, advance: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
}

const byName = (store: MemoryStore) => {
  const out: Record<string, string> = {};
  for (const s of store.services.values()) out[s.service_name ?? s.canonical_url] = s.classification;
  return out;
};

test('one cycle: discovers, dedupes, classifies, probes for free, queues', async () => {
  const { store, deps } = setup();
  const stats = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  const d = stats.discovery.cdp_bazaar;

  assert.equal(d.pages, 3, '15 items at 5 per page');
  assert.equal(d.items, 15);
  assert.equal(d.invalid_items, 1);
  assert.equal(d.skipped_non_http, 1);
  assert.equal(d.duplicates_in_pass, 1, 'same URL written differently');
  assert.equal(store.services.size, 12);

  assert.deepEqual(byName(store), {
    'v2-get': 'eligible',
    'v1-post': 'eligible',         // GET 405 → POST with the Bazaar example body → 402
    'v2-get-2': 'eligible',
    'post-noex': 'needs_input',
    expensive: 'too_expensive',
    othernet: 'unsupported_network',
    permit2: 'unsupported_scheme',
    not402: 'not_x402',
    monitored: 'already_monitored',
    submitted: 'already_submitted',
    rebind: 'blocked',
    down: 'pending',               // unreachable once — retries with backoff
  });

  const down = [...store.services.values()].find((s) => s.service_name === 'down')!;
  assert.equal(down.probe_failures, 1);
  assert.ok(down.next_probe_at!.getTime() > Date.parse('2026-09-28T10:00:00Z'), 'backed off');
  assert.ok(down.classification_reasons.some((r) => r.startsWith('probe:retrying')));

  // Queue: eligible first, then needs_input
  assert.equal(stats.queue.queued, 4);
  assert.deepEqual(store.submissions.map((s) => s.name).sort(), ['post-noex', 'v1-post', 'v2-get', 'v2-get-2']);
  const v2 = store.submissions.find((s) => s.name === 'v2-get')!;
  assert.equal(v2.endpoint_url, eco.url('svc.test', '/svc/v2-get'));
  assert.equal(v2.candidate_metadata.price_usdc, 0.002);
  assert.equal(v2.candidate_metadata.network, 'eip155:8453');
  assert.equal(v2.candidate_metadata.evidence_state, 'observed');
  assert.deepEqual(v2.candidate_metadata.sources, ['cdp_bazaar']);

  // History
  assert.equal(store.events.filter((e) => e.event === 'first_seen').length, 12);
  assert.equal(store.events.filter((e) => e.event === 'queued').length, 4);
});

test('never pays and never probes what the listing already rules out', async () => {
  const { deps } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  const svcHits = eco.hits.filter((h) => h.path.startsWith('/svc/'));
  assert.ok(svcHits.length > 0);
  for (const h of svcHits) {
    assert.equal(h.headers['x-payment'], undefined, `no X-PAYMENT to ${h.path}`);
    assert.equal(h.headers['payment-signature'], undefined, `no PAYMENT-SIGNATURE to ${h.path}`);
    assert.match(String(h.headers['user-agent']), /^CORTX-Cori\//);
    assert.ok(['GET', 'POST'].includes(h.method));
  }
  const probed = new Set(svcHits.map((h) => h.path));
  for (const never of ['/svc/expensive', '/svc/othernet', '/svc/permit2', '/svc/monitored', '/svc/submitted']) {
    assert.equal(probed.has(never), false, `${never} must not be probed`);
  }
  assert.ok(!eco.hits.some((h) => h.host === 'rebind.test'), 'private address never contacted');
});

test('daily queue cap, then the rest the next day; no duplicates', async () => {
  const { store, deps, advance } = setup({ cap: 2 });
  let s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.queue.queued, 2);
  assert.ok(store.submissions.every((x) => ['v2-get', 'v1-post', 'v2-get-2'].includes(x.name)), 'eligible before needs_input');

  s = await runCycle(deps, { forceSources: true });
  assert.equal(s.queue.queued, 0, 'cap reached for today');
  assert.equal(s.queue.cap_hit, true);

  advance(24 * 3_600_000);
  s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.queue.queued, 2);
  assert.equal(store.submissions.length, 4);

  advance(24 * 3_600_000);
  s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.queue.queued, 0, 'nothing is ever queued twice');
  assert.equal(new Set(store.submissions.map((x) => x.discovered_service_id)).size, 4);
  assert.equal(s.discovery.cdp_bazaar.new_services, 0, 'known services are updated, not duplicated');
});

test('listing change: price change is recorded, service re-probed and re-classified', async () => {
  const { store, deps, advance } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });

  const idx = eco.items.findIndex((i) => (i as { serviceName?: string }).serviceName === 'v2-get-2');
  const item = eco.items[idx] as { accepts: Array<Record<string, unknown>> };
  item.accepts[0].amount = '90000'; // $0.09 > $0.05 cap
  advance(7 * 3_600_000);

  const s = await runCycle(deps, { maxProbeBatches: 5 });
  assert.equal(s.discovery.cdp_bazaar.changed_listings, 1);
  const row = [...store.services.values()].find((r) => r.service_name === 'v2-get-2')!;
  assert.equal(row.classification, 'too_expensive');
  const events = store.events.filter((e) => e.serviceId === row.id).map((e) => e.event);
  assert.ok(events.includes('listing_changed'));
  assert.ok(events.includes('price_changed'));
  assert.ok(events.includes('classification_changed'));
});

test('a service becomes unreachable only after 3 failures; source cadence respected', async () => {
  const { store, deps, advance } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  const down = () => [...store.services.values()].find((r) => r.service_name === 'down')!;
  for (let i = 0; i < 2; i++) {
    advance(25 * 3_600_000);
    await runCycle(deps, { maxProbeBatches: 5 });
  }
  assert.equal(down().classification, 'unreachable');
  assert.equal(down().probe_failures, 3);

  const pagesBefore = eco.hits.filter((h) => h.path === '/discovery/resources').length;
  advance(60_000);
  const s = await runCycle(deps, { maxProbeBatches: 1 });
  assert.deepEqual(s.discovery, {}, 'source not due again within its interval');
  assert.equal(eco.hits.filter((h) => h.path === '/discovery/resources').length, pagesBefore);
});

test('denylisted hosts are never probed', async () => {
  const { store, deps } = setup();
  store.denylist.add('svc.test');
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(eco.hits.filter((h) => h.host === 'svc.test').length, 0);
  assert.equal(byName(store)['v2-get'], 'blocked');
  assert.equal(store.submissions.length, 0);
});

test('a failing source is recorded, does not stop the cycle, and backs off', async () => {
  const { store, deps, advance } = setup();
  store.sources.push({ id: 'broken', url: eco.url('rebind.test', '/discovery/resources'), enabled: true, interval_minutes: 360, last_run_at: null });
  const s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.ok(s.source_errors.broken);
  assert.ok(s.discovery.cdp_bazaar, 'the healthy source still ran');
  assert.equal(store.runs.find((r) => r.kind === 'discover:broken')?.ok, false);

  // Not retried on the next tick — only after the 30-minute backoff
  const attempts = () => store.runs.filter((r) => r.kind === 'discover:broken').length;
  advance(60_000);
  await runCycle(deps);
  assert.equal(attempts(), 1, 'no retry a minute later');
  advance(30 * 60_000);
  await runCycle(deps);
  assert.equal(attempts(), 2, 'retried after 30 minutes');
});
