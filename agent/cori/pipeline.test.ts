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

function setup(overrides: { cap?: number; globalMaxPerHour?: number } = {}) {
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
    // The fake ecosystem listens on a random port; production allows 443 only
    // Most fake services share one host; the B3 per-host limits get their own tests
    config: defaultConfig({
      dailyQueueCap: overrides.cap ?? 25, bazaarPageLimit: 5, perHostMinIntervalMs: 0, allowedPorts: [eco.port],
      probePerHostPerBatch: 100, queuePerHostPerDay: 100, probeRecheckHours: 24,
    }),
    log: silentLogger,
    limiter: new HostLimiter(0, 1000, { globalMaxPerHour: overrides.globalMaxPerHour }),
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
    'v1-post': 'eligible',         // GET 405 → POST {} → 402 (the Bazaar example is kept for later, never sent)
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

// ─── Phase B2: memory, safer probes, disappearance (spec v2) ─────────────────

const svcRow = (store: MemoryStore, name: string) => [...store.services.values()].find((r) => r.service_name === name)!;

test('POST probes send {} — never the body from a listing', async () => {
  const { deps } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  const posts = eco.hits.filter((h) => h.method === 'POST' && h.path.startsWith('/svc/'));
  assert.ok(posts.some((h) => h.path === '/svc/v1-post'));
  for (const h of posts) assert.equal(h.body, '{}', `${h.path} got a third-party body`);
});

test('every probe is kept as an observation, failures included, never overwritten', async () => {
  const { store, deps, advance } = setup();
  const s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(store.observations.length, s.probe.probed, 'one observation per probe');

  const v2 = svcRow(store, 'v2-get');
  const obs = store.observations.find((o) => o.serviceId === v2.id)!;
  assert.equal(obs.outcome, 'ok');
  assert.equal(obs.method, 'GET');
  assert.equal(obs.price_atomic, '2000');
  assert.equal(obs.price_usdc, 0.002);
  assert.equal(obs.pay_to, '0x209693Bc6afc0C5328bA36FaF03C514EF312287C');
  assert.equal(obs.probe_url, eco.url('svc.test', '/svc/v2-get'));
  assert.equal(obs.cori_version, deps.config.version);

  const down = store.observations.find((o) => o.serviceId === svcRow(store, 'down').id)!;
  assert.equal(down.outcome, 'unreachable', "couldn't check is recorded too");

  advance(25 * 3_600_000);
  await runCycle(deps, { maxProbeBatches: 5 });
  assert.equal(store.observations.filter((o) => o.serviceId === v2.id).length, 2, 'history grows, nothing replaced');
});

test('listing versions: a new row only when the content changes', async () => {
  const { store, deps, advance } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(store.listings.length, 12, 'one version per service');

  advance(7 * 3_600_000);
  await runCycle(deps, { maxProbeBatches: 5 });
  assert.equal(store.listings.length, 12, 'unchanged listings add nothing');

  const item = eco.items.find((i) => (i as { serviceName?: string }).serviceName === 'v2-get-2') as { accepts: Array<Record<string, unknown>> };
  item.accepts[0].amount = '3000';
  advance(7 * 3_600_000);
  await runCycle(deps, { maxProbeBatches: 5 });

  const row = svcRow(store, 'v2-get-2');
  const versions = store.listings.filter((l) => l.serviceId === row.id);
  assert.equal(versions.length, 2, 'old and new version both kept');
  assert.deepEqual(versions.map((v) => (v.snapshot?.accepts?.[0] as { amount: string }).amount), ['2000', '3000']);
  const changed = store.events.find((e) => e.serviceId === row.id && e.event === 'listing_changed')!;
  assert.equal(changed.details?.from_hash, versions[0].hash);
  assert.equal(changed.details?.to_hash, versions[1].hash);
});

test('only port 443 (here: the fake port): other ports are blocked from the listing, never contacted', async () => {
  const { store, deps } = setup();
  eco.items.push({ resource: `https://svc.test:8443/svc/v2-get`, type: 'http', x402Version: 2, serviceName: 'odd-port',
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' }] });
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  const row = svcRow(store, 'odd-port');
  assert.equal(row.classification, 'blocked');
  assert.deepEqual(row.classification_reasons, ['blocked:port']);
  assert.equal(store.observations.filter((o) => o.serviceId === row.id).length, 0, 'never probed');
});

test('DELETE/PUT/PATCH endpoints are never called', async () => {
  const { store, deps } = setup();
  eco.items.push({ resource: eco.url('svc.test', '/svc/del'), type: 'http', x402Version: 2, serviceName: 'del',
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' }],
    extensions: { bazaar: { info: { input: { type: 'http', method: 'DELETE' } } } } });
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(svcRow(store, 'del').classification, 'unsupported_method');
  assert.equal(eco.hits.filter((h) => h.path === '/svc/del').length, 0);
});

test('dynamic routes: one service per template, probed and queued at a concrete URL', async () => {
  const { store, deps } = setup();
  const user = (id: string) => ({ resource: eco.url('svc.test', `/svc/users/${id}`), type: 'http', x402Version: 2, serviceName: 'users',
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' }],
    extensions: { bazaar: { routeTemplate: '/svc/users/:id', info: { input: { type: 'http', method: 'GET', pathParams: { id } } } } } });
  eco.items.push(user('1'), user('2'));
  const s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.discovery.cdp_bazaar.duplicates_in_pass, 2, 'the second user URL is the same service');

  const rows = [...store.services.values()].filter((r) => r.service_name === 'users');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].canonical_url, eco.url('svc.test', '/svc/users/:id'));
  assert.equal(rows[0].route_template, '/svc/users/:id');
  assert.equal(rows[0].classification, 'eligible');
  assert.ok(eco.hits.some((h) => h.path === '/svc/users/1'), 'probed at the concrete URL');
  assert.equal(store.submissions.find((x) => x.name === 'users')!.endpoint_url, eco.url('svc.test', '/svc/users/1'));
});

test('disappearance: after 7 days unlisted (with complete passes); listing-only classes become gone; reappear', async () => {
  const { store, deps, advance } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  const all = eco.items;
  const keep = (n: string) => (i: unknown) => (i as { serviceName?: string }).serviceName !== n;
  eco.items = all.filter(keep('othernet')).filter(keep('v2-get'));

  for (let i = 0; i < 30; i++) { advance(6 * 3_600_000 + 60_000); await runCycle(deps, { maxProbeBatches: 5 }); }

  const othernet = svcRow(store, 'othernet');
  assert.ok(othernet.disappeared_at, 'marked disappeared');
  assert.equal(othernet.classification, 'gone');
  const v2 = svcRow(store, 'v2-get');
  assert.ok(v2.disappeared_at);
  assert.equal(v2.classification, 'eligible', 'still answers its free probe: delisted, not dead');
  assert.equal(store.events.filter((e) => e.serviceId === othernet.id && e.event === 'disappeared').length, 1, 'once');

  eco.items = all;
  advance(6 * 3_600_000 + 60_000);
  await runCycle(deps, { maxProbeBatches: 5 });
  const back = svcRow(store, 'othernet');
  assert.equal(back.disappeared_at, null);
  assert.equal(back.classification, 'unsupported_network');
  assert.ok(store.events.some((e) => e.serviceId === othernet.id && e.event === 'reappeared'));
});

test('a source outage never looks like services disappearing', async () => {
  const { store, deps, advance } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  store.sources[0].url = eco.url('rebind.test', '/discovery/resources'); // every pass now fails
  for (let i = 0; i < 40; i++) { advance(6 * 3_600_000); await runCycle(deps, { maxProbeBatches: 1 }); }
  assert.equal(store.events.filter((e) => e.event === 'disappeared').length, 0);
});

test('global hourly probe budget', async () => {
  const { deps, advance } = setup({ globalMaxPerHour: 3 });
  const s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.probe.probed, 3);
  assert.equal(s.probe.budget_left, 0);
  advance(10 * 60_000);
  assert.equal((await runCycle(deps, { maxProbeBatches: 5 })).probe.probed, 0, 'still within the hour');
});

test('shutdown: an aborted signal stops probing between probes', async () => {
  const { deps } = setup();
  const ac = new AbortController();
  ac.abort();
  const s = await runCycle({ ...deps, signal: ac.signal }, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.probe.probed, 0);
});

test('with several sources, no sweep until every source completed a pass', async () => {
  const { store, deps, advance } = setup();
  store.sources.push({ id: 'broken', url: eco.url('rebind.test', '/discovery/resources'), enabled: true, interval_minutes: 360, last_run_at: null });
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  eco.items = eco.items.filter((i) => (i as { serviceName?: string }).serviceName !== 'othernet');
  for (let i = 0; i < 40; i++) { advance(6 * 3_600_000 + 60_000); await runCycle(deps, { maxProbeBatches: 1 }); }
  assert.equal(store.events.filter((e) => e.event === 'disappeared').length, 0, 'a broken source could be the one listing it');
});

test('dry-run (lean) store: same classes and queue, without keeping payloads', async () => {
  const full = setup();
  await runCycle(full.deps, { forceSources: true, maxProbeBatches: 5 });

  eco.items = standardListings(eco);
  const lean = new MemoryStore({
    lean: true,
    sources: [{ id: 'cdp_bazaar', url: eco.bazaarUrl, enabled: true, interval_minutes: 360, last_run_at: null }],
    known: { services: [{ id: 'svc-1', endpoint_url: eco.url('svc.test', '/svc/monitored') }], seeds: [],
      submissions: [{ id: 'sub-1', endpoint_url: eco.url('svc.test', '/svc/submitted'), status: 'pending', source: 'public', discovered_service_id: null }] },
  });
  await runCycle({ ...full.deps, store: lean }, { forceSources: true, maxProbeBatches: 5 });

  assert.deepEqual(byName(lean), byName(full.store), 'classification unchanged');
  assert.deepEqual(lean.submissions.map((s) => s.name).sort(), full.store.submissions.map((s) => s.name).sort());
  assert.ok([...lean.services.values()].every((r) => r.bazaar_metadata == null), 'no Bazaar metadata kept');
  assert.ok(lean.listings.every((l) => l.snapshot == null), 'no listing snapshots kept');
  assert.equal(lean.observations.length, 0);
  assert.equal(lean.observationCount, full.store.observations.length, 'probes still counted');
});

// ─── Phase B3: company-first probing, fair queue, no writes for unchanged listings ─

const onHost = (host: string, q = '') => ({
  resource: `${eco.url(host, '/svc/v2-get')}${q}`, type: 'http', x402Version: 2, serviceName: `${host}${q}`,
  accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C' }],
});

function b3Setup(opts: { globalMaxPerHour?: number } = {}) {
  const s = setup();
  eco.items = [...Array.from({ length: 20 }, (_, i) => onHost('big.test', `?i=${i}`)), onHost('a.test'), onHost('b.test'), onHost('c.test')];
  s.deps.config = { ...s.deps.config, probePerHostPerBatch: 1, queuePerHostPerDay: 1, perHostMaxPerDay: 5 };
  s.deps.limiter = new HostLimiter(0, 1000, { maxPerDay: 5, globalMaxPerHour: opts.globalMaxPerHour, now: () => s.deps.now!().getTime() });
  return s;
}
const hostHits = (host: string) => eco.hits.filter((h) => h.host === host && h.path.startsWith('/svc/')).length;

test('company-first: one big host gets at most 5 checks a day; every company gets checked', async () => {
  const { store, deps, advance } = b3Setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 30 });
  assert.equal(hostHits('big.test'), 5, 'the big host is capped at 5 a day');
  for (const h of ['a.test', 'b.test', 'c.test']) assert.equal(hostHits(h), 1, `${h} checked`);
  assert.equal([...store.services.values()].filter((r) => r.host === 'big.test' && r.classification === 'pending').length, 15, 'the rest wait');

  advance(24 * 3_600_000 + 60_000);
  await runCycle(deps, { maxProbeBatches: 30 });
  assert.equal(hostHits('big.test'), 10, 'five more the next day');
});

test('hosts never checked go first', async () => {
  const { deps, advance } = b3Setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 30 });
  eco.items.push(onHost('d.test'));
  advance(24 * 3_600_000 + 60_000);
  // A budget of exactly one check: it must go to the new company, not the big one
  deps.limiter = new HostLimiter(0, 1000, { maxPerDay: 5, globalMaxPerHour: 1, now: () => deps.now!().getTime() });
  const s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(s.probe.probed, 1);
  assert.equal(hostHits('d.test'), 1);
});

test('fair review queue: at most one new candidate per company per day', async () => {
  const { store, deps, advance } = b3Setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 30 });
  const hosts = store.submissions.map((x) => new URL(x.endpoint_url).hostname).sort();
  assert.deepEqual(hosts, ['a.test', 'b.test', 'big.test', 'c.test'], 'one each, though big.test has 5 eligible');

  await runCycle(deps, { maxProbeBatches: 5 });
  assert.equal(store.submissions.length, 4, 'not again the same day');

  advance(24 * 3_600_000 + 60_000);
  await runCycle(deps, { maxProbeBatches: 30 });
  assert.equal(store.submissions.filter((x) => x.endpoint_url.includes('big.test')).length, 2, 'the next one from big.test the next day');
});

test('unchanged listings cost no per-item queries; last seen refreshed once a day in bulk', async () => {
  const { store, deps, advance } = setup();
  await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.ok([...store.services.values()].every((r) => r.bazaar_metadata == null), 'Bazaar metadata kept once, in listing versions');

  let lookups = 0;
  const getByUrl = store.getByUrl.bind(store);
  store.getByUrl = async (u) => { lookups++; return getByUrl(u); };

  advance(7 * 3_600_000);
  let s = await runCycle(deps, { maxProbeBatches: 5 });
  assert.ok(s.discovery.cdp_bazaar.unchanged >= 11, `unchanged: ${s.discovery.cdp_bazaar.unchanged}`);
  assert.ok(lookups <= 1, `per-item lookups: ${lookups} (only the SSRF-blocked one re-checks)`);
  assert.equal(s.discovery.cdp_bazaar.touched, 0, 'seen 7 h ago: no write');

  advance(14 * 3_600_000);
  const before = svcRow(store, 'v2-get').last_seen_at.getTime();
  s = await runCycle(deps, { maxProbeBatches: 5 });
  assert.ok(s.discovery.cdp_bazaar.touched >= 11, 'refreshed after 20 h');
  assert.ok(svcRow(store, 'v2-get').last_seen_at.getTime() > before);
});

test('one failing listing does not stop the pass; many in a row do', async () => {
  const { store, deps } = setup();
  const record = store.recordListing.bind(store);
  store.recordListing = async (id, src, hash, snap, at) => {
    if (snap?.resource?.includes('/svc/permit2')) throw new Error('unsupported Unicode escape sequence');
    return record(id, src, hash, snap, at);
  };
  const s = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.deepEqual(s.source_errors, {}, 'the pass still completes');
  assert.equal(s.discovery.cdp_bazaar.item_errors, 1);
  assert.equal(byName(store)['v2-get'], 'eligible', 'listings after the bad one are processed');

  const broken = setup();
  eco.items.push(...Array.from({ length: 25 }, (_, i) => onHost('a.test', `?n=${i}`)));
  broken.store.recordListing = async () => { throw new Error('connection lost'); };
  const b = await runCycle(broken.deps, { forceSources: true, maxProbeBatches: 1 });
  assert.match(b.source_errors.cdp_bazaar ?? '', /in a row failed: connection lost/, 'a dead database fails the pass (retried in 30 min)');
});
