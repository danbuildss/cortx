// In-memory Store: dry runs (seeded with read-only data from the database)
// and tests. Nothing written here ever reaches the database.
import { randomUUID } from 'node:crypto';
import type { ListingSnapshot } from '../../lib/cori/bazaar';
import type {
  DiscoveryEvent, KnownRecords, NewService, NewSubmission, Observation, ServicePatch, ServiceRow, SourceRow, Store,
} from './store';

export type MemorySeed = {
  sources?: SourceRow[];
  denylist?: string[];
  known?: KnownRecords;
  /** Clock for event and submission timestamps (the database uses now()); tests pass their fake clock */
  now?: () => Date;
};

export class MemoryStore implements Store {
  sources: SourceRow[];
  denylist: Set<string>;
  known: KnownRecords;
  services = new Map<string, ServiceRow>();       // by id
  sourcesSeen = new Map<string, { first: Date; last: Date; hash: string }>(); // `${id}|${source}`
  events: Array<{ serviceId: string; event: DiscoveryEvent; at: Date; details?: Record<string, unknown> }> = [];
  submissions: Array<NewSubmission & { id: string; status: string; source: string; submitted_at: Date }> = [];
  runs: Array<{ id: number; kind: string; ok?: boolean; stats?: Record<string, unknown>; error?: string | null }> = [];
  listings: Array<{ serviceId: string; source: string; hash: string; first: Date; last: Date; snapshot: ListingSnapshot }> = [];
  observations: Array<Observation & { serviceId: string }> = [];
  private readonly now: () => Date;

  constructor(seed: MemorySeed = {}) {
    this.now = seed.now ?? (() => new Date());
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
    for (const s of this.services.values()) if (s.canonical_url === url) return { ...s };
    return null;
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
      route_template: null, resource_url: null, source_last_updated: null, disappeared_at: null,
      last_probe_at: null, next_probe_at: null, probe_failures: 0, last_probe: null,
      classification: 'pending', classification_reasons: [],
      linked_service_id: null, linked_seed_id: null, linked_submission_id: null,
      ...f, // canonical_url, host, first_source (+ any facts)
    };
    this.services.set(row.id, row);
    return { ...row };
  }

  async updateService(id: string, patch: ServicePatch) {
    const row = this.services.get(id);
    if (row) this.services.set(id, { ...row, ...patch });
  }

  async touchSource(serviceId: string, source: string, at: Date, hash: string) {
    const key = `${serviceId}|${source}`;
    const prev = this.sourcesSeen.get(key);
    this.sourcesSeen.set(key, { first: prev?.first ?? at, last: at, hash });
    return { seenBefore: prev != null };
  }

  async sourcesFor(serviceId: string) {
    return [...this.sourcesSeen.keys()].filter((k) => k.startsWith(`${serviceId}|`)).map((k) => k.split('|')[1]);
  }

  async addEvent(serviceId: string, event: DiscoveryEvent, details?: Record<string, unknown>) {
    this.events.push({ serviceId, event, at: this.now(), details });
  }

  async recordListing(serviceId: string, source: string, hash: string, snapshot: ListingSnapshot, at: Date) {
    const prev = this.listings.find((l) => l.serviceId === serviceId && l.source === source && l.hash === hash);
    if (prev) { prev.last = at; return { newVersion: false }; }
    this.listings.push({ serviceId, source, hash, first: at, last: at, snapshot });
    return { newVersion: true };
  }

  async addObservation(serviceId: string, o: Observation) {
    this.observations.push({ ...o, serviceId });
  }

  async notSeenSince(cutoff: Date, limit: number) {
    return [...this.services.values()]
      .filter((s) => s.disappeared_at == null && s.last_seen_at.getTime() < cutoff.getTime())
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }

  async dueProbes(now: Date, limit: number) {
    return [...this.services.values()]
      .filter((s) => s.next_probe_at != null && s.next_probe_at.getTime() <= now.getTime())
      .sort((a, b) => a.next_probe_at!.getTime() - b.next_probe_at!.getTime())
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }

  async queueCandidates(limit: number) {
    const rank = (c: string) => (c === 'eligible' ? 0 : 1);
    return [...this.services.values()]
      .filter((s) => (s.classification === 'eligible' || s.classification === 'needs_input')
        && !s.linked_submission_id && !s.linked_service_id && !s.linked_seed_id)
      .sort((a, b) => rank(a.classification) - rank(b.classification) || a.first_seen_at.getTime() - b.first_seen_at.getTime())
      .slice(0, limit)
      .map((s) => ({ ...s }));
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
