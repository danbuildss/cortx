// Server-side reads of Cori's tables for the admin UI. Cori's tables have no
// policies for app users, so these use the service role — callers must have
// already checked the viewer is the owner.
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { CLASS_ORDER, heartbeatState, type HeartbeatState } from '@/lib/cori/status';
import type { Classification } from '@/lib/cori/classify';
import { PARTNER_DOMAINS, SERVICE_PARTNERS, type Partner } from '@/lib/cori/partners';
import type { CoriEvent, CoriRun } from './cori-panel';

export function adminServiceClient(): SupabaseClient {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type CoriCandidate = {
  id: string;
  endpoint_url: string;
  name: string;
  description: string | null;
  submitted_at: string;
  candidate_metadata: unknown;
  /** Q2: the company's liveness (null until Cori's first daily check after queueing) */
  alive: boolean | null;
  last_alive_at: string | null;
  quiet_since: string | null;
} & Demand;

/** Problem Finder step 1 (030): CDP's latest 30-day numbers for the company (null before 030 / no data) */
export type Demand = {
  demand_payers: number | null;
  demand_calls: number | null;
  demand_last_called_at: string | null;
};

const NO_DEMAND: Demand = { demand_payers: null, demand_calls: null, demand_last_called_at: null };

// Q2: an approved company, re-checked by Cori every day
export type CoriWatched = {
  domain: string;
  name: string | null;
  approved_at: string | null;
  alive: boolean | null;
  last_alive_at: string | null;
  quiet_since: string | null;
  endpoint_url: string | null;
  candidate_metadata: unknown;
} & Demand;

// Real buyers first (most distinct payers in 30 days); no numbers last
export function byDemand<T extends Demand>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.demand_payers ?? -1) - (a.demand_payers ?? -1));
}

// Pending Cori candidates in the review queue
const waitingQuery = (service: SupabaseClient) =>
  service.from('endpoint_submissions').select('id', { count: 'exact', head: true })
    .eq('source', 'cori_scout').eq('status', 'pending');

export type CoriNav = { state: HeartbeatState; waiting: number };

/** Sidebar / admin line: health and how many candidates wait for review. Null if unavailable. */
export async function loadCoriNav(service: SupabaseClient, now = new Date()): Promise<CoriNav | null> {
  try {
    const [lastRun, waiting] = await Promise.all([
      service.from('cori_runs').select('started_at').order('started_at', { ascending: false }).limit(1),
      waitingQuery(service),
    ]);
    if (lastRun.error) return null;
    const last = lastRun.data?.[0]?.started_at as string | undefined;
    return { state: heartbeatState(last ? new Date(last) : null, now), waiting: waiting.count ?? 0 };
  } catch {
    return null;
  }
}

export type CoriOverview = {
  runs: CoriRun[];
  totalDiscovered: number;
  /** Q1: companies that passed the quality gate, and those whose website answers (0 before migration 028) */
  companies: number;
  companiesSiteOk: number;
  events: CoriEvent[];
  classCounts: Partial<Record<Classification, number>>;
  candidates: CoriCandidate[];
  /** Q2: cards hidden because the company stopped answering */
  quietCandidates: number;
  watching: CoriWatched[];
  /** Q2: x402 ecosystem services Cori hasn't found a paid endpoint for */
  partnersMissing: Partner[];
  loadedAt: number;
};

/** Everything the Cori page shows. Counts per class use head-count queries (PostgREST caps row reads at 1000). */
export async function loadCoriOverview(service: SupabaseClient): Promise<CoriOverview> {
  const [runsRes, totalRes, companiesRes, siteOkRes, eventsRes, candidatesRes, watchingRes, partnersFoundRes, ...classRes] = await Promise.all([
    service.from('cori_runs').select('kind, started_at, ok, stats, error').order('started_at', { ascending: false }).limit(50),
    service.from('discovered_services').select('id', { count: 'exact', head: true }).neq('classification', 'low_quality'),
    service.from('discovered_companies').select('domain', { count: 'exact', head: true }),
    service.from('discovered_companies').select('domain', { count: 'exact', head: true }).eq('site_ok', true),
    service.from('discovery_events').select('at, event, details, discovered_services(service_name, canonical_url)').order('at', { ascending: false }).limit(20),
    withDemandFallback((d) => service.from('endpoint_submissions')
      .select(`id, endpoint_url, name, description, submitted_at, candidate_metadata, discovered_companies(alive, last_alive_at, quiet_since${d})`)
      .eq('source', 'cori_scout').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(100)),
    withDemandFallback((d) => service.from('discovered_companies')
      .select(`domain, name, approved_at, alive, last_alive_at, quiet_since${d}, endpoint_submissions(endpoint_url, candidate_metadata)`)
      .eq('watching', true).order('approved_at', { ascending: false }).limit(100)),
    service.from('discovered_companies').select('domain').in('domain', PARTNER_DOMAINS),
    ...CLASS_ORDER.map((c) => service.from('discovered_services').select('id', { count: 'exact', head: true }).eq('classification', c)),
  ]);
  const classCounts: Partial<Record<Classification, number>> = {};
  CLASS_ORDER.forEach((c, i) => { classCounts[c] = classRes[i]?.count ?? 0; });
  return {
    runs: (runsRes.data ?? []) as CoriRun[],
    totalDiscovered: totalRes.count ?? 0,
    companies: companiesRes.count ?? 0,
    companiesSiteOk: siteOkRes.count ?? 0,
    events: (eventsRes.data ?? []) as unknown as CoriEvent[],
    classCounts,
    ...splitCandidates(candidatesRes.data ?? []),
    watching: byDemand(((watchingRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
      const sub = (Array.isArray(r.endpoint_submissions) ? r.endpoint_submissions[0] : r.endpoint_submissions) as
        { endpoint_url?: string; candidate_metadata?: unknown } | null;
      return {
        domain: String(r.domain), name: (r.name as string | null) ?? null, approved_at: (r.approved_at as string | null) ?? null,
        alive: (r.alive as boolean | null) ?? null, last_alive_at: (r.last_alive_at as string | null) ?? null,
        quiet_since: (r.quiet_since as string | null) ?? null,
        endpoint_url: sub?.endpoint_url ?? null, candidate_metadata: sub?.candidate_metadata ?? null,
        ...demandOf(r),
      };
    })),
    partnersMissing: missingPartners(new Set(((partnersFoundRes.data ?? []) as Array<{ domain: string }>).map((r) => r.domain))),
    loadedAt: Date.now(),
  };
}

type CompanyState = { alive: boolean | null; last_alive_at: string | null; quiet_since: string | null } & Partial<Demand>;
type CandidateRow = Omit<CoriCandidate, 'alive' | 'last_alive_at' | 'quiet_since' | keyof Demand> & {
  discovered_companies?: CompanyState | CompanyState[] | null;
};

const DEMAND_COLUMNS = ', demand_payers, demand_calls, demand_last_called_at';

// The demand columns arrive with migration 030; until it has run, read without them
// (so merging before running 030 never breaks this page)
async function withDemandFallback<R extends { error: unknown }>(query: (demandColumns: string) => PromiseLike<R>): Promise<R> {
  const res = await query(DEMAND_COLUMNS);
  return res.error ? query('') : res;
}

function demandOf(r: Partial<Record<keyof Demand, unknown>> | null | undefined): Demand {
  if (!r) return NO_DEMAND;
  return {
    demand_payers: typeof r.demand_payers === 'number' ? r.demand_payers : null,
    demand_calls: typeof r.demand_calls === 'number' ? r.demand_calls : null,
    demand_last_called_at: typeof r.demand_last_called_at === 'string' ? r.demand_last_called_at : null,
  };
}

// Q2: cards whose company stopped answering are hidden (counted, not deleted)
function splitCandidates(rows: unknown[]): { candidates: CoriCandidate[]; quietCandidates: number } {
  const all = (rows as CandidateRow[]).map(({ discovered_companies: dc, ...c }) => {
    const company = Array.isArray(dc) ? dc[0] : dc;
    return { ...c, alive: company?.alive ?? null, last_alive_at: company?.last_alive_at ?? null, quiet_since: company?.quiet_since ?? null, ...demandOf(company) };
  });
  return { candidates: byDemand(all.filter((c) => c.alive !== false)), quietCandidates: all.filter((c) => c.alive === false).length };
}

function missingPartners(found: Set<string>): Partner[] {
  const seen = new Set<string>();
  return SERVICE_PARTNERS.filter((p) => {
    if (found.has(p.domain) || seen.has(p.domain)) return false;
    seen.add(p.domain);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}
