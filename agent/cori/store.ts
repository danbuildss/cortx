// Cori's storage interface (spec §4). Two implementations:
//   PgStore     — Supabase Postgres as the least-privilege `cori_agent` role
//   MemoryStore — dry runs and tests (optionally seeded from the database)
import type { Classification } from '../../lib/cori/classify';
import type { Demand, ListingSnapshot } from '../../lib/cori/bazaar';

export type SourceRow = {
  id: string;
  url: string;
  enabled: boolean;
  interval_minutes: number;
  last_run_at: Date | null;
};

export type ProbeRecord = {
  outcome: 'ok' | 'unreachable' | 'not_x402' | 'invalid_terms' | 'blocked';
  at: string;
  method: string | null;              // the method of the request that produced the result
  price_atomic: string | null;
  pay_to: string | null;
  http_status: number | null;
  latency_ms: number | null;
  error: string | null;
  terms_source: string | null;
  x402_version: number | null;
  network: string | null;
  asset: string | null;
  scheme: string | null;
  transfer_method: string | null;
  price_usdc: number | null;
  facilitator_published: boolean;
};

export type ServiceRow = {
  id: string;
  canonical_url: string;
  host: string;
  first_seen_at: Date;
  first_source: string;
  last_seen_at: Date;
  service_name: string | null;
  description: string | null;
  tags: string[];
  bazaar_metadata: Record<string, unknown> | null;
  http_method: string;
  input_example: Record<string, unknown> | null;
  x402_version: number | null;
  network: string | null;
  asset: string | null;
  scheme: string | null;
  transfer_method: string | null;
  price_atomic: string | null;
  price_usdc: number | null;
  pay_to_fingerprint: string | null;
  pay_to: string | null;
  facilitator_url: string | null;
  route_template: string | null;
  resource_url: string | null;        // concrete URL to probe (differs from canonical_url for dynamic routes)
  source_last_updated: Date | null;
  disappeared_at: Date | null;
  company_domain: string | null;
  listing_hash: string | null;
  last_probe_at: Date | null;
  next_probe_at: Date | null;
  probe_failures: number;
  last_probe: ProbeRecord | null;
  classification: Classification;
  classification_reasons: string[];
  linked_service_id: string | null;
  linked_seed_id: string | null;
  linked_submission_id: string | null;
  // Problem Finder step 1 (030): the latest CDP demand numbers (a cache of discovery_demand)
  demand_payers: number | null;
  demand_calls: number | null;
  demand_last_called_at: Date | null;
  demand_at: Date | null;
};

// Everything settable on a discovered service (identity fields excluded)
export type ServicePatch = Partial<Omit<ServiceRow, 'id' | 'canonical_url' | 'first_seen_at' | 'first_source'>>;

export type NewService = Pick<ServiceRow, 'canonical_url' | 'host' | 'first_source'> & ServicePatch;

export type KnownSubmission = { id: string; status: string; source: string | null; discovered_service_id: string | null };

// Existing CORTX records, keyed by canonical URL (built by the caller)
export type KnownRecords = {
  services: Array<{ id: string; endpoint_url: string }>;
  seeds: Array<{ id: string; endpoint_url: string }>;
  submissions: Array<KnownSubmission & { endpoint_url: string }>;
};

export type DiscoveryEvent =
  | 'first_seen' | 'listing_changed' | 'reappeared' | 'disappeared' | 'terms_changed'
  | 'price_changed' | 'probe_status_changed' | 'classification_changed' | 'queued' | 'approved' | 'rejected';

// One free probe, as kept forever in discovery_observations
export type Observation = ProbeRecord & { probe_url: string; cori_version: string };

// Just enough of a known service to tell, without loading it, that a listing hasn't changed
export type IndexRow = {
  id: string;
  first_seen_at: Date;
  company_domain: string | null;
  listing_hash: string | null;
  classification: Classification;
  last_seen_at: Date;
  disappeared_at: Date | null;
  linked_service_id: string | null;
  linked_seed_id: string | null;
  sources: string[];
  demand_payers: number | null;
  demand_calls: number | null;
  demand_at: Date | null;
};

// Q1: a company (registrable domain) and its website check
export type SiteCheck = { url: string; http_status: number | null; latency_ms: number | null; error_code: string | null; ok: boolean; cori_version: string };

// Q1: a company ready for review, with its best services (eligible first, cheapest first)
export type CompanyCandidate = {
  domain: string;
  name: string | null;
  first_seen_at: Date;
  site_ok: boolean | null;
  site_status: number | null;
  watched: boolean;
  services: ServiceRow[];
  services_total: number;
  /** The company's demand (030): busiest service's payers, all services' calls */
  demand_payers: number | null;
  demand_calls: number | null;
  demand_last_called_at: Date | null;
};

/**
 * Q2: classes a daily free check can answer for a company being watched or waiting for review.
 * Includes listing-level rejections (too_expensive, other networks…): a free check never pays, and
 * a watched company whose only services are "too expensive" must not look dead (miroshark.xyz, Oct 15).
 * Excluded: blocked (never contacted), gone, low_quality, unsupported_method (no safe request to send).
 */
export const LIVENESS_CLASSES = [
  'eligible', 'needs_input', 'unreachable', 'not_x402', 'invalid_terms', 'pending',
  'already_listed', 'already_monitored', 'already_submitted',
  'too_expensive', 'unsupported_network', 'unsupported_asset', 'unsupported_scheme',
] as const;

// Host spread (spec v2 B3): which rows a batch may take per host, and hosts to skip
export type HostSpread = { perHost: number; excludeHosts: string[] };

export type NewSubmission = {
  endpoint_url: string;
  name: string;
  description: string | null;
  website_url: string | null;
  category: string | null;
  discovered_service_id: string;
  candidate_metadata: Record<string, unknown>;
};

export interface Store {
  loadSources(): Promise<SourceRow[]>;
  markSourceRun(id: string, at: Date): Promise<void>;
  loadDenylist(): Promise<Set<string>>;
  loadKnown(): Promise<KnownRecords>;

  getByUrl(canonicalUrl: string): Promise<ServiceRow | null>;
  /** One query per pass: every known service by canonical URL, light columns only */
  loadIndex(): Promise<Map<string, IndexRow>>;
  /** Bulk "still listed": last_seen_at on the service, its source row and its current listing version */
  touchSeen(ids: string[], source: string, at: Date): Promise<void>;
  insertService(fields: NewService, at: Date): Promise<ServiceRow>;
  updateService(id: string, patch: ServicePatch): Promise<void>;
  /** Upsert (service, source). Returns whether this source had listed it before. */
  touchSource(serviceId: string, source: string, at: Date, listingHash: string): Promise<{ seenBefore: boolean }>;
  sourcesFor(serviceId: string): Promise<string[]>;
  addEvent(serviceId: string, event: DiscoveryEvent, details?: Record<string, unknown>): Promise<void>;
  /** Keep this listing version (by hash). Returns whether it's a version not seen before. */
  recordListing(serviceId: string, source: string, hash: string, snapshot: ListingSnapshot, at: Date): Promise<{ newVersion: boolean }>;
  /** Append one probe result (failures included). Never updated afterwards. */
  addObservation(serviceId: string, o: Observation): Promise<void>;
  /** Services no source has listed since `cutoff`, not yet marked disappeared */
  notSeenSince(cutoff: Date, limit: number): Promise<ServiceRow[]>;

  /** Due rows, at most `spread.perHost` per host, hosts never probed first, skipping `spread.excludeHosts` */
  dueProbes(now: Date, limit: number, spread?: HostSpread): Promise<ServiceRow[]>;
  /** eligible first, then needs_input; oldest first; not yet queued; not linked to CORTX records;
   *  at most `spread.perHost` per host, skipping `spread.excludeHosts` */
  queueCandidates(limit: number, spread?: HostSpread): Promise<ServiceRow[]>;
  /** Q1: companies the founder always wants watched */
  loadWatchlist(): Promise<Set<string>>;
  /** Q1: create or refresh a company row (last seen; name only if it has none) */
  upsertCompany(domain: string, name: string | null, at: Date): Promise<void>;
  /** Q1: companies whose website hasn't been checked, or not recently (failures retried sooner) */
  dueSiteChecks(now: Date, limit: number, excludeDomains: string[]): Promise<string[]>;
  /** Q1: append the website check and update the company's current site state */
  recordSiteCheck(domain: string, check: SiteCheck, at: Date): Promise<void>;
  /** Q1/Q2: companies ready for review — website ok (or watched/partner), never queued, with a usable
   *  service; `priorityDomains` (x402 ecosystem partners) first and exempt from the website check.
   *  Oct 24: only companies with at least `minBuyers` paying wallets (30 d); partners / watch list exempt. */
  queueCompanies(limit: number, priorityDomains?: string[], minBuyers?: number): Promise<CompanyCandidate[]>;
  /** Q2: schedule today's free check for every service of a company waiting for review or being watched
   *  (any class a free check can answer, too_expensive included). Runs before the probes. */
  scheduleLiveness(now: Date): Promise<number>;
  /** Q2: after the probes, set alive / went quiet from checks of the last 26 h. A company with no
   *  check in that window keeps its state (unknown, not quiet): no check isn't a failed check. */
  markLiveness(now: Date): Promise<{ alive: number; quiet: number; unchecked: number }>;
  /** 030: keep today's demand numbers for a service (one row per UTC day) and update its cache */
  recordDemand(serviceId: string, source: string, demand: Demand, at: Date, coriVersion: string): Promise<void>;
  /** 030: refresh every company's demand cache from its kept services. Returns companies updated. */
  refreshCompanyDemand(): Promise<number>;
  linkCompanySubmission(domain: string, submissionId: string): Promise<void>;
  countCompanies(): Promise<{ known: number; site_ok: number; queued: number }>;
  /** The host of every candidate queued since `since` (one entry per candidate, so it can be counted) */
  hostsQueuedSince(since: Date): Promise<string[]>;
  countQueuedSince(since: Date): Promise<number>;
  /** Returns the new submission id, or null if one is already pending for this service */
  insertSubmission(s: NewSubmission): Promise<string | null>;
  countByClassification(): Promise<Record<string, number>>;

  startRun(kind: string): Promise<number>;
  finishRun(id: number, ok: boolean, stats: Record<string, unknown>, error?: string | null): Promise<void>;
}
