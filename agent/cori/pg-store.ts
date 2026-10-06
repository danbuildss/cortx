// Store backed by Supabase Postgres, connected as the least-privilege
// `cori_agent` role (migration 023). Every query here stays inside that
// role's grants: Cori's own tables, a few id/url columns for deduplication,
// and inserting pending candidates into endpoint_submissions.
import type { Sql } from 'postgres';
import type { ListingSnapshot } from '../../lib/cori/bazaar';
import type {
  DiscoveryEvent, HostSpread, IndexRow, KnownRecords, NewService, NewSubmission, Observation, ServicePatch, ServiceRow,
  SourceRow, Store,
} from './store';

const JSON_COLUMNS = new Set(['bazaar_metadata', 'input_example', 'last_probe']);
const ARRAY_COLUMNS = new Set(['tags', 'classification_reasons']);
const NUMERIC_COLUMNS = new Set(['price_usdc']);

// Columns Cori may set on discovered_services (identity columns excluded)
const PATCHABLE = new Set([
  'last_seen_at', 'service_name', 'description', 'tags', 'bazaar_metadata', 'http_method', 'input_example',
  'x402_version', 'network', 'asset', 'scheme', 'transfer_method', 'price_atomic', 'price_usdc',
  'pay_to_fingerprint', 'facilitator_url', 'listing_hash', 'last_probe_at', 'next_probe_at', 'probe_failures',
  'last_probe', 'classification', 'classification_reasons', 'linked_service_id', 'linked_seed_id', 'linked_submission_id',
  'pay_to', 'route_template', 'resource_url', 'source_last_updated', 'disappeared_at',
]);

type Row = Record<string, unknown>;

const TOUCH_BATCH = 1000;

function toServiceRow(r: Row): ServiceRow {
  const out = { ...r } as Record<string, unknown>;
  delete out.host_rank;   // helper columns from the spread queries
  delete out.host_probed;
  for (const c of NUMERIC_COLUMNS) out[c] = r[c] == null ? null : Number(r[c]);
  out.price_atomic = r.price_atomic == null ? null : String(r.price_atomic);
  return out as unknown as ServiceRow;
}

export class PgStore implements Store {
  private readonly sql: Sql;
  private readonly version: string | null;

  /** `version`: the Cori build (git SHA) stamped on every run row */
  constructor(sql: Sql, opts: { version?: string } = {}) {
    this.sql = sql;
    this.version = opts.version ?? null;
  }

  // Encode values for the columns that need explicit types
  private encode(key: string, value: unknown): unknown {
    if (value === undefined) return null;
    if (JSON_COLUMNS.has(key)) return value == null ? null : this.sql.json(value as never);
    if (ARRAY_COLUMNS.has(key)) return this.sql.array((value as string[]) ?? [], 25 /* text */);
    return value;
  }

  async loadSources(): Promise<SourceRow[]> {
    return (await this.sql`select id, url, enabled, interval_minutes, last_run_at from public.cori_sources order by id`) as unknown as SourceRow[];
  }

  async markSourceRun(id: string, at: Date) {
    await this.sql`update public.cori_sources set last_run_at = ${at} where id = ${id}`;
  }

  async loadDenylist() {
    const rows = await this.sql`select host from public.cori_denylist`;
    return new Set(rows.map((r) => String(r.host)));
  }

  async loadKnown(): Promise<KnownRecords> {
    const [services, seeds, submissions] = await Promise.all([
      this.sql`select id, endpoint_url from public.services where deleted_at is null`,
      this.sql`select id, endpoint_url from public.registry_seeds`,
      this.sql`select id, endpoint_url, status, source, discovered_service_id from public.endpoint_submissions`,
    ]);
    return {
      services: services as unknown as KnownRecords['services'],
      seeds: seeds as unknown as KnownRecords['seeds'],
      submissions: submissions as unknown as KnownRecords['submissions'],
    };
  }

  async getByUrl(url: string) {
    const [r] = await this.sql`select * from public.discovered_services where canonical_url = ${url}`;
    return r ? toServiceRow(r) : null;
  }

  async loadIndex() {
    const rows = await this.sql`
      select s.id, s.canonical_url, s.listing_hash, s.classification, s.last_seen_at, s.disappeared_at,
             s.linked_service_id, s.linked_seed_id,
             coalesce(array_agg(ss.source) filter (where ss.source is not null), '{}') as sources
      from public.discovered_services s
      left join public.discovery_sources_seen ss on ss.discovered_service_id = s.id
      group by s.id`;
    const out = new Map<string, IndexRow>();
    for (const r of rows) {
      out.set(String(r.canonical_url), {
        id: String(r.id), listing_hash: r.listing_hash ?? null, classification: r.classification,
        last_seen_at: r.last_seen_at, disappeared_at: r.disappeared_at ?? null,
        linked_service_id: r.linked_service_id ?? null, linked_seed_id: r.linked_seed_id ?? null,
        sources: (r.sources as string[]) ?? [],
      });
    }
    return out;
  }

  async touchSeen(ids: string[], source: string, at: Date) {
    for (let i = 0; i < ids.length; i += TOUCH_BATCH) {
      const batch = this.sql.array(ids.slice(i, i + TOUCH_BATCH), 25 /* text */);
      await this.sql`
        update public.discovered_services set last_seen_at = ${at}, updated_at = now()
        where id = any(${batch}::uuid[])`;
      await this.sql`
        update public.discovery_sources_seen set last_seen_at = ${at}
        where source = ${source} and discovered_service_id = any(${batch}::uuid[])`;
      await this.sql`
        update public.discovery_listings l set last_seen_at = ${at}
        from public.discovered_services s
        where s.id = l.discovered_service_id and l.listing_hash = s.listing_hash and l.source = ${source}
          and s.id = any(${batch}::uuid[])`;
    }
  }

  async insertService(f: NewService, at: Date): Promise<ServiceRow> {
    // Insert identity + timestamps only; facts arrive via updateService
    const [r] = await this.sql`
      insert into public.discovered_services (canonical_url, host, first_source, first_seen_at, last_seen_at)
      values (${f.canonical_url}, ${f.host}, ${f.first_source}, ${at}, ${at})
      on conflict (canonical_url) do update set last_seen_at = excluded.last_seen_at
      returning *`;
    return toServiceRow(r);
  }

  async updateService(id: string, patch: ServicePatch) {
    const entries = Object.entries(patch).filter(([k, v]) => PATCHABLE.has(k) && v !== undefined);
    if (entries.length === 0) return;
    const values: Record<string, unknown> = { updated_at: new Date() };
    for (const [k, v] of entries) values[k] = this.encode(k, v);
    await this.sql`update public.discovered_services set ${this.sql(values as never)} where id = ${id}`;
  }

  async touchSource(serviceId: string, source: string, at: Date, hash: string) {
    const [r] = await this.sql`
      insert into public.discovery_sources_seen (discovered_service_id, source, first_seen_at, last_seen_at, last_listing_hash)
      values (${serviceId}, ${source}, ${at}, ${at}, ${hash})
      on conflict (discovered_service_id, source)
        do update set last_seen_at = excluded.last_seen_at, last_listing_hash = excluded.last_listing_hash
      returning (xmax = 0) as inserted`;
    return { seenBefore: !r.inserted };
  }

  async sourcesFor(serviceId: string) {
    const rows = await this.sql`select source from public.discovery_sources_seen where discovered_service_id = ${serviceId} order by first_seen_at`;
    return rows.map((r) => String(r.source));
  }

  async addEvent(serviceId: string, event: DiscoveryEvent, details?: Record<string, unknown>) {
    await this.sql`
      insert into public.discovery_events (discovered_service_id, event, details)
      values (${serviceId}, ${event}, ${details ? this.sql.json(details as never) : null})`;
  }

  async recordListing(serviceId: string, source: string, hash: string, snap: ListingSnapshot, at: Date) {
    const json = (v: unknown) => (v == null ? null : this.sql.json(v as never));
    const [r] = await this.sql`
      insert into public.discovery_listings
        (discovered_service_id, source, listing_hash, first_seen_at, last_seen_at, source_last_updated,
         resource, x402_version, accepts, resource_meta, extensions, item_bytes)
      values (${serviceId}, ${source}, ${hash}, ${at}, ${at}, ${snap.sourceLastUpdated},
              ${snap.resource}, ${snap.x402Version}, ${json(snap.accepts)}, ${json(snap.resourceMeta)},
              ${json(snap.extensions)}, ${snap.itemBytes})
      on conflict (discovered_service_id, source, listing_hash) do update set last_seen_at = excluded.last_seen_at
      returning (xmax = 0) as inserted`;
    return { newVersion: Boolean(r.inserted) };
  }

  async addObservation(serviceId: string, o: Observation) {
    await this.sql`
      insert into public.discovery_observations
        (discovered_service_id, at, probe_url, method, outcome, error_code, http_status, latency_ms, terms_source,
         x402_version, network, asset, scheme, transfer_method, price_atomic, price_usdc, pay_to,
         facilitator_published, cori_version)
      values (${serviceId}, ${o.at}, ${o.probe_url}, ${o.method}, ${o.outcome}, ${o.error}, ${o.http_status},
              ${o.latency_ms}, ${o.terms_source}, ${o.x402_version}, ${o.network}, ${o.asset}, ${o.scheme},
              ${o.transfer_method}, ${o.price_atomic}, ${o.price_usdc}, ${o.pay_to}, ${o.facilitator_published},
              ${o.cori_version})`;
  }

  async notSeenSince(cutoff: Date, limit: number) {
    const rows = await this.sql`
      select * from public.discovered_services
      where disappeared_at is null and last_seen_at < ${cutoff}
      order by last_seen_at
      limit ${limit}`;
    return rows.map(toServiceRow);
  }

  async dueProbes(now: Date, limit: number, spread?: HostSpread) {
    if (!spread) {
      const rows = await this.sql`
        select * from public.discovered_services
        where next_probe_at is not null and next_probe_at <= ${now}
        order by next_probe_at
        limit ${limit}`;
      return rows.map(toServiceRow);
    }
    // At most perHost rows per host; hosts never probed first (company-first, B3)
    const exclude = this.sql.array(spread.excludeHosts, 25 /* text */);
    const rows = await this.sql`
      with probed as (
        select distinct host from public.discovered_services where last_probe_at is not null
      ), due as (
        select s.*, row_number() over (partition by s.host order by s.next_probe_at, s.first_seen_at) as host_rank
        from public.discovered_services s
        where s.next_probe_at is not null and s.next_probe_at <= ${now} and s.host <> all(${exclude}::text[])
      )
      select due.*, (due.host in (select host from probed)) as host_probed
      from due
      where host_rank <= ${spread.perHost}
      order by host_probed, next_probe_at, first_seen_at
      limit ${limit}`;
    return rows.map(toServiceRow);
  }

  async queueCandidates(limit: number, spread?: HostSpread) {
    if (!spread) {
      const rows = await this.sql`
        select * from public.discovered_services
        where classification in ('eligible', 'needs_input')
          and linked_submission_id is null and linked_service_id is null and linked_seed_id is null
        order by case classification when 'eligible' then 0 else 1 end, first_seen_at
        limit ${limit}`;
      return rows.map(toServiceRow);
    }
    const exclude = this.sql.array(spread.excludeHosts, 25 /* text */);
    const rows = await this.sql`
      select * from (
        select s.*, row_number() over (
                 partition by s.host
                 order by case s.classification when 'eligible' then 0 else 1 end, s.first_seen_at) as host_rank
        from public.discovered_services s
        where s.classification in ('eligible', 'needs_input')
          and s.linked_submission_id is null and s.linked_service_id is null and s.linked_seed_id is null
          and s.host <> all(${exclude}::text[])
      ) c
      where host_rank <= ${spread.perHost}
      order by case classification when 'eligible' then 0 else 1 end, first_seen_at
      limit ${limit}`;
    return rows.map(toServiceRow);
  }

  async hostsQueuedSince(since: Date) {
    const rows = await this.sql`
      select s.host from public.discovery_events e
      join public.discovered_services s on s.id = e.discovered_service_id
      where e.event = 'queued' and e.at >= ${since}`;
    return rows.map((r) => String(r.host));
  }

  async countQueuedSince(since: Date) {
    const [r] = await this.sql`select count(*)::int as n from public.discovery_events where event = 'queued' and at >= ${since}`;
    return Number(r.n);
  }

  async insertSubmission(s: NewSubmission) {
    try {
      const [r] = await this.sql`
        insert into public.endpoint_submissions
          (endpoint_url, name, description, website_url, category, source, discovered_service_id, candidate_metadata)
        values (${s.endpoint_url}, ${s.name}, ${s.description}, ${s.website_url}, ${s.category},
                'cori_scout', ${s.discovered_service_id}, ${this.sql.json(s.candidate_metadata as never)})
        returning id`;
      return String(r.id);
    } catch (err) {
      // One pending submission per discovered service (unique index)
      if ((err as { code?: string }).code === '23505') return null;
      throw err;
    }
  }

  async countByClassification() {
    const rows = await this.sql`select classification, count(*)::int as n from public.discovered_services group by classification`;
    return Object.fromEntries(rows.map((r) => [String(r.classification), Number(r.n)]));
  }

  async startRun(kind: string) {
    const [r] = await this.sql`insert into public.cori_runs (kind, cori_version) values (${kind}, ${this.version}) returning id`;
    return Number(r.id);
  }

  async finishRun(id: number, ok: boolean, stats: Record<string, unknown>, error?: string | null) {
    await this.sql`
      update public.cori_runs
      set finished_at = now(), ok = ${ok}, stats = ${this.sql.json(stats as never)}, error = ${error ?? null}
      where id = ${id}`;
  }
}
