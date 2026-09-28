// Runs the Scout pipeline against real Postgres, connected as the
// least-privilege `cori_agent` role — proving Cori can do its whole job with
// only the grants from migrations 023/024.
//
// Skipped unless CORI_TEST_ADMIN_DATABASE_URL points at a disposable Postgres
// superuser connection (it creates and drops its own database), e.g.
//   CORI_TEST_ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { defaultConfig } from './config.ts';
import { silentLogger } from './log.ts';
import { HostLimiter } from './limiter.ts';
import { PgStore } from './pg-store.ts';
import { runCycle, type Deps } from './pipeline.ts';
import { startFakeEcosystem, standardListings, type FakeEcosystem } from './fake-ecosystem.ts';

const ADMIN_URL = process.env.CORI_TEST_ADMIN_DATABASE_URL;
const DB = `cori_it_${Date.now()}`;

// Production-shaped baseline (endpoint_submissions as it exists in prod)
const BASELINE = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql as 'select null::uuid';
  create table public.services (id uuid primary key default gen_random_uuid(), user_id uuid, name text, endpoint_url text, deleted_at timestamptz);
  alter table public.services enable row level security;
  create policy "Users manage own services" on public.services using (auth.uid() = user_id);
  create table public.checks (id uuid primary key default gen_random_uuid());
  create table public.registry_seeds (id uuid primary key default gen_random_uuid(), name text not null, endpoint_url text not null,
    description text, status text default 'unknown', is_verified boolean default false, created_at timestamptz default now(),
    x_handle text, website_url text, category text);
  create table public.endpoint_submissions (id uuid primary key default gen_random_uuid(), endpoint_url text not null, name text not null,
    submitter_email text, submitted_at timestamptz default now(), status text not null default 'pending', reviewed_at timestamptz,
    reviewed_by uuid, rejection_reason text, service_id uuid);
  alter table public.endpoint_submissions enable row level security;
  create policy "Service role only" on public.endpoint_submissions using (false);
`;

let eco: FakeEcosystem;
let admin: postgres.Sql;
let dbAdmin: postgres.Sql;
let cori: postgres.Sql;

before(async () => {
  if (!ADMIN_URL) return;
  eco = await startFakeEcosystem();
  admin = postgres(ADMIN_URL, { onnotice: () => {} });
  await admin.unsafe(`create database ${DB}`);
  const dbUrl = new URL(ADMIN_URL); dbUrl.pathname = `/${DB}`;
  dbAdmin = postgres(dbUrl.toString(), { onnotice: () => {} });
  await dbAdmin.unsafe(BASELINE);
  for (const m of ['023_cori_scout.sql', '024_fix_endpoint_submissions_columns.sql']) {
    await dbAdmin.unsafe(readFileSync(new URL(`../../supabase/migrations/${m}`, import.meta.url), 'utf8'));
  }
  await dbAdmin.unsafe(`alter role cori_agent with login password 'integration-test-only'`);
  await dbAdmin`insert into public.services (name, endpoint_url) values ('private-name', ${eco.url('svc.test', '/svc/monitored')})`;
  await dbAdmin`update public.cori_sources set url = ${eco.bazaarUrl}`;
  const coriUrl = new URL(dbUrl.toString()); coriUrl.username = 'cori_agent'; coriUrl.password = 'integration-test-only';
  cori = postgres(coriUrl.toString(), { onnotice: () => {} });
});

after(async () => {
  if (!ADMIN_URL) return;
  await cori?.end();
  await dbAdmin?.end();
  await admin?.unsafe(`drop database if exists ${DB}`);
  await admin?.end();
  eco?.close();
});

test('Scout runs end to end as cori_agent on real Postgres', { skip: !ADMIN_URL && 'set CORI_TEST_ADMIN_DATABASE_URL' }, async () => {
  eco.items = standardListings(eco);
  const deps: Deps = {
    store: new PgStore(cori),
    config: defaultConfig({ bazaarPageLimit: 5, perHostMinIntervalMs: 0 }),
    log: silentLogger,
    limiter: new HostLimiter(0, 1000),
    fetchOptions: eco.fetchOptions,
    sleep: async () => {},
  };

  const first = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.deepEqual(first.source_errors, {});
  assert.equal(first.queue.queued, 4);

  const classes = Object.fromEntries(
    (await dbAdmin`select service_name, classification from public.discovered_services`).map((r) => [r.service_name, r.classification])
  );
  assert.equal(classes['v2-get'], 'eligible');
  assert.equal(classes['v1-post'], 'eligible');
  assert.equal(classes['post-noex'], 'needs_input');
  assert.equal(classes.monitored, 'already_monitored');
  assert.equal(classes.rebind, 'blocked');
  assert.equal(classes.expensive, 'too_expensive');

  const subs = await dbAdmin`select name, status, source, description, website_url, candidate_metadata from public.endpoint_submissions order by name`;
  assert.equal(subs.length, 4);
  for (const s of subs) {
    assert.equal(s.status, 'pending');
    assert.equal(s.source, 'cori_scout');
    assert.equal(s.candidate_metadata.evidence_state, 'observed');
  }

  // Second cycle: nothing duplicated
  const second = await runCycle(deps, { forceSources: true, maxProbeBatches: 5 });
  assert.equal(second.queue.queued, 0);
  assert.equal(second.discovery.cdp_bazaar.new_services, 0);
  const [{ n }] = await dbAdmin`select count(*)::int as n from public.endpoint_submissions`;
  assert.equal(n, 4);

  // History and run log written
  const [{ events }] = await dbAdmin`select count(*)::int as events from public.discovery_events where event = 'first_seen'`;
  assert.equal(events, 12);
  const runs = await dbAdmin`select kind, ok from public.cori_runs order by id`;
  assert.ok(runs.some((r) => r.kind === 'discover:cdp_bazaar' && r.ok === true));

  // The role still can't see what it shouldn't
  await assert.rejects(cori`select name from public.services`, /permission denied/);
  await assert.rejects(cori`select * from public.checks`, /permission denied/);
  await assert.rejects(cori`select submitter_email from public.endpoint_submissions`, /permission denied/);
  await assert.rejects(cori`update public.endpoint_submissions set status = 'approved'`, /permission denied/);
});
