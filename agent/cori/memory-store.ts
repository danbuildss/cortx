// In-memory Store: dry runs (seeded with read-only data from the database)
// and tests. Nothing written here ever reaches the database.
//
// `lean` (dry runs): keeps only what classification, queueing and the summary
// need. Listing snapshots, Bazaar metadata and observation rows are dropped —
// a dry run never saves them, and across the whole Bazaar they don't fit in
// memory (the first live dry run ran out of heap, Oct 6).
import { randomUUID } from 'node:crypto';
import type { ListingSnapshot } from '../../lib/cori/bazaar';
import type {
  CompanyCandidate, DiscoveryEvent, HostSpread, IndexRow, SiteCheck, KnownRecords, NewService, NewSubmission, Observation, ServicePatch, ServiceRow,
  SourceRow, Store,
} from './store';

// Website checks: never checked → now; ok → weekly; failed → after a day, weekly after 3 failures
export function isSiteCheckDue(c: { site_checked_at: Date | null; site_ok: boolean | null; site_failures: number }, now: Date): boolean {
  if (!c.site_checked_at) return true;
  const age = now.getTime() - c.site_checked_at.getTime();
  const day = 86_400_000;
  if (c.site_ok || c.site_failures >= 3) return age >= 7 * day;
  return age >= day;
}

// Keep at most `perHost` rows per host (in the given order), skipping excluded hosts
function spreadByHost(rows: ServiceRow[], spread?: HostSpread): ServiceRow[] {
  if (!spread) return rows;
  const skip = new Set(spread.excludeHosts);
  const taken = new Map<string, number>();
  return rows.filter((r) => {
    if (skip.has(r.host)) return false;
    const n = taken.get(r.host) ?? 0;
    if (n >= spread.perHost) return false;
    taken.set(r.host, n + 1);
    return true;
  });
}

export type MemorySeed = {
  sources?: SourceRow[];
  denylist?: string[];
  watchlist?: string[];
  known?: KnownRecords;
  /** Clock for event and submission timestamps (the database uses now()); tests pass their fake clock */
  now?: () => Date;
  lean?: boolean;
};

export class MemoryStore implements Store {
  sources: SourceRow[];
  denylist: Set<string>;
  known: KnownRecords;
  services = new Map<string, ServiceRow>();       // by id
  private byUrl = new Map<string, string>();      // canonical_url → id
  sourcesSeen = new Map<string, { first: Date; last: Date; hash: string }>(); // `${id}|${source}`
  private sourcesById = new Map<string, string[]>();
  events: Array<{ serviceId: string; event: DiscoveryEvent; at: Date; details?: Record<string, unknown> }> = [];
  submissions: Array<NewSubmission & { id: string; status: string; source: string; submitted_at: Date }> = [];
  runs: Array<{ id: number; kind: string; ok?: boolean; stats?: Record<string, unknown>; error?: string | null }> = [];
  listings: Array<{ serviceId: string; source: string; hash: string; first: Date; last: Date; snapshot: ListingSnapshot | null }> = [];
  private listingKeys = new Map<string, number>(); // `${id}|${source}|${hash}` → index in listings
  observations: Array<Observation & { serviceId: string }> = [];
  observationCount = 0;
  watchlist: Set<string>;
  companies = new Map<string, {
    domain: string; name: string | null; first_seen_at: Date; last_seen_at: Date;
    site_checked_at: Date | null; site_ok: boolean | null; site_status: number | null; site_failures: number;
    linked_submission_id: string | null;
  }>();
  siteChecks: Array<SiteCheck & { domain: string; at: Date }> = [];
  readonly lean: boolean;
  private readonly now: () => Date;

  constructor(seed: MemorySeed = {}) {
    this.now = seed.now ?? (() => new Date());
    this.lean = seed.lean ?? false;
    this.watchlist = new Set(seed.watchlist ?? []);
    this.sources = seed.sources ?? [];
    this.denylist = new Set(seed.denylist ?? []);
    this.known = seed.known ?? { services: [], seeds: [], submissions: [] };
  }

  async loadSources() { return this.sources.map((s) => ({ ...s })); }
  async markSourceRun(id: string, at: Date) {
    const s = this.sources.find((x) => x.id === id);
    if (s) s.last_run_at = at;
  }
  async loadDenylist() { return new Set(this.denylist); }
  async loadKnown(): Promise<KnownRecords> {
    return {
      services: [...this.known.services],
      seeds: [...this.known.seeds],
      submissions: [
        ...this.known.submissions,
        ...this.submissions.map((s) => ({ id: s.id, endpoint_url: s.endpoint_url, status: s.status, source: s.source, discovered_service_id: s.discovered_service_id })),
      ],
    };
  }

  async getByUrl(url: string) {
    const id = this.byUrl.get(url);
    const row = id ? this.services.get(id) : undefined;
    return row ? { ...row } : null;
  }

  async loadIndex() {
    const out = new Map<string, IndexRow>();
    for (const r of this.services.values()) {
      out.set(r.canonical_url, {
        id: r.id, first_seen_at: r.first_seen_at, company_domain: r.company_domain, listing_hash: r.listing_hash, classification: r.classification, last_seen_at: r.last_seen_at,
        disappeared_at: r.disappeared_at, linked_service_id: r.linked_service_id, linked_seed_id: r.linked_seed_id,
        sources: await this.sourcesFor(r.id),
      });
    }
    return out;
  }

  async touchSeen(ids: string[], source: string, at: Date) {
    for (const id of ids) {
      const row = this.services.get(id);
      if (!row) continue;
      this.services.set(id, { ...row, last_seen_at: at });
      const seen = this.sourcesSeen.get(`${id}|${source}`);
      if (seen) seen.last = at;
      const i = this.listingKeys.get(`${id}|${source}|${row.listing_hash}`);
      if (i != null) this.listings[i].last = at;
    }
  }

  // Lean mode keeps facts, not payloads: classification only needs to know
  // whether an example input exists
  private slim(patch: ServicePatch): ServicePatch {
    if (!this.lean) return patch;
    const out = { ...patch };
    if ('bazaar_metadata' in out) out.bazaar_metadata = null;
    if ('input_example' in out) out.input_example = out.input_example ? {} : null;
    return out;
  }

  async insertService(f: NewService, at: Date): Promise<ServiceRow> {
    const row: ServiceRow = {
      id: randomUUID(),
      first_seen_at: at,
      last_seen_at: at,
      service_name: null, description: null, tags: [], bazaar_metadata: null,
      http_method: 'GET', input_example: null, x402_version: null, network: null, asset: null,
      scheme: null, transfer_method: null, price_atomic: null, price_usdc: null,
      pay_to_fingerprint: null, pay_to: null, facilitator_url: null, listing_hash: null,
      route_template: null, resource_url: null, source_last_updated: null, disappeared_at: null, company_domain: null,
      last_probe_at: null, next_probe_at: null, probe_failures: 0, last_probe: null,
      classification: 'pending', classification_reasons: [],
      linked_service_id: null, linked_seed_id: null, linked_submission_id: null,
      ...this.slim(f) as NewService, // canonical_url, host, first_source (+ any facts)
    };
    this.services.set(row.id, row);
    this.byUrl.set(row.canonical_url, row.id);
    return { ...row };
  }

  async updateService(id: string, patch: ServicePatch) {
    const row = this.services.get(id);
    if (row) this.services.set(id, { ...row, ...this.slim(patch) });
  }

  async touchSource(serviceId: string, source: string, at: Date, hash: string) {
    const key = `${serviceId}|${source}`;
    const prev = this.sourcesSeen.get(key);
    this.sourcesSeen.set(key, { first: prev?.first ?? at, last: at, hash });
    if (!prev) this.sourcesById.set(serviceId, [...(this.sourcesById.get(serviceId) ?? []), source]);
    return { seenBefore: prev != null };
  }

  async sourcesFor(serviceId: string) {
    return [...(this.sourcesById.get(serviceId) ?? [])];
  }

  async addEvent(serviceId: string, event: DiscoveryEvent, details?: Record<string, unknown>) {
    this.events.push({ serviceId, event, at: this.now(), details });
  }

  async recordListing(serviceId: string, source: string, hash: string, snapshot: ListingSnapshot, at: Date) {
    const key = `${serviceId}|${source}|${hash}`;
    const i = this.listingKeys.get(key);
    if (i != null) { this.listings[i].last = at; return { newVersion: false }; }
    this.listingKeys.set(key, this.listings.length);
    this.listings.push({ serviceId, source, hash, first: at, last: at, snapshot: this.lean ? null : snapshot });
    return { newVersion: true };
  }

  async addObservation(serviceId: string, o: Observation) {
    this.observationCount++;
    if (!this.lean) this.observations.push({ ...o, serviceId });
  }

  async notSeenSince(cutoff: Date, limit: number) {
    return [...this.services.values()]
      .filter((s) => s.disappeared_at == null && s.last_seen_at.getTime() < cutoff.getTime())
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }

  async dueProbes(now: Date, limit: number, spread?: HostSpread) {
    const probedHosts = new Set([...this.services.values()].filter((s) => s.last_probe_at != null).map((s) => s.host));
    const due = [...this.services.values()]
      .filter((s) => s.next_probe_at != null && s.next_probe_at.getTime() <= now.getTime())
      .sort((a, b) => a.next_probe_at!.getTime() - b.next_probe_at!.getTime() || a.first_seen_at.getTime() - b.first_seen_at.getTime());
    // Hosts never probed come first (Postgres store does the same)
    const ordered = spread
      ? [...due.filter((s) => !probedHosts.has(s.host)), ...due.filter((s) => probedHosts.has(s.host))]
      : due;
    return spreadByHost(ordered, spread).slice(0, limit).map((s) => ({ ...s }));
  }

  async queueCandidates(limit: number, spread?: HostSpread) {
    const rank = (c: string) => (c === 'eligible' ? 0 : 1);
    const rows = [...this.services.values()]
      .filter((s) => (s.classification === 'eligible' || s.classification === 'needs_input')
        && !s.linked_submission_id && !s.linked_service_id && !s.linked_seed_id)
      .sort((a, b) => rank(a.classification) - rank(b.classification) || a.first_seen_at.getTime() - b.first_seen_at.getTime());
    return spreadByHost(rows, spread).slice(0, limit).map((s) => ({ ...s }));
  }

  async loadWatchlist() { return new Set(this.watchlist); }

  async upsertCompany(domain: string, name: string | null, at: Date) {
    const c = this.companies.get(domain);
    if (c) { c.last_seen_at = at; c.name = c.name ?? name; return; }
    this.companies.set(domain, {
      domain, name, first_seen_at: at, last_seen_at: at, site_checked_at: null, site_ok: null, site_status: null,
      site_failures: 0, linked_submission_id: null,
    });
  }

  async dueSiteChecks(now: Date, limit: number, excludeDomains: string[]) {
    const skip = new Set(excludeDomains);
    return [...this.companies.values()]
      .filter((c) => !skip.has(c.domain) && isSiteCheckDue(c, now))
      .sort((a, b) => a.first_seen_at.getTime() - b.first_seen_at.getTime())
      .slice(0, limit)
      .map((c) => c.domain);
  }

  async recordSiteCheck(domain: string, check: SiteCheck, at: Date) {
    this.siteChecks.push({ ...check, domain, at });
    const c = this.companies.get(domain);
    if (c) Object.assign(c, { site_checked_at: at, site_ok: check.ok, site_status: check.http_status, site_failures: check.ok ? 0 : c.site_failures + 1 });
  }

  async queueCompanies(limit: number) {
    const rank = (r: ServiceRow) => (r.classification === 'eligible' ? 0 : 1);
    const out: CompanyCandidate[] = [];
    const companies = [...this.companies.values()]
      .filter((c) => c.linked_submission_id == null && (c.site_ok === true || this.watchlist.has(c.domain)))
      .sort((a, b) => Number(this.watchlist.has(b.domain)) - Number(this.watchlist.has(a.domain)) || a.first_seen_at.getTime() - b.first_seen_at.getTime());
    for (const c of companies) {
      const services = [...this.services.values()]
        .filter((r) => r.company_domain === c.domain && (r.classification === 'eligible' || r.classification === 'needs_input')
          && !r.linked_submission_id && !r.linked_service_id && !r.linked_seed_id)
        .sort((a, b) => rank(a) - rank(b) || (a.price_usdc ?? 0) - (b.price_usdc ?? 0) || a.first_seen_at.getTime() - b.first_seen_at.getTime());
      if (services.length === 0) continue;
      out.push({
        domain: c.domain, name: c.name, first_seen_at: c.first_seen_at, site_ok: c.site_ok, site_status: c.site_status,
        watched: this.watchlist.has(c.domain), services: services.slice(0, 5).map((r) => ({ ...r })), services_total: services.length,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  async linkCompanySubmission(domain: string, submissionId: string) {
    const c = this.companies.get(domain);
    if (c) c.linked_submission_id = submissionId;
  }

  async countCompanies() {
    const all = [...this.companies.values()];
    return { known: all.length, site_ok: all.filter((c) => c.site_ok).length, queued: all.filter((c) => c.linked_submission_id).length };
  }

  async hostsQueuedSince(since: Date) {
    return this.events
      .filter((e) => e.event === 'queued' && e.at.getTime() >= since.getTime())
      .map((e) => this.services.get(e.serviceId)?.host)
      .filter((h): h is string => !!h);
  }

  async countQueuedSince(since: Date) {
    return this.events.filter((e) => e.event === 'queued' && e.at.getTime() >= since.getTime()).length;
  }

  async insertSubmission(s: NewSubmission) {
    if (this.submissions.some((x) => x.discovered_service_id === s.discovered_service_id && x.status === 'pending')) return null;
    const id = randomUUID();
    this.submissions.push({ ...s, id, status: 'pending', source: 'cori_scout', submitted_at: this.now() });
    return id;
  }

  async countByClassification() {
    const out: Record<string, number> = {};
    for (const s of this.services.values()) out[s.classification] = (out[s.classification] ?? 0) + 1;
    return out;
  }

  async startRun(kind: string) {
    const id = this.runs.length + 1;
    this.runs.push({ id, kind });
    return id;
  }

  async finishRun(id: number, ok: boolean, stats: Record<string, unknown>, error?: string | null) {
    const r = this.runs.find((x) => x.id === id);
    if (r) Object.assign(r, { ok, stats, error: error ?? null });
  }
}
