// Server-side reads of Cori's tables for the admin UI. Cori's tables have no
// policies for app users, so these use the service role — callers must have
// already checked the viewer is the owner.
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { CLASS_ORDER, heartbeatState, type HeartbeatState } from '@/lib/cori/status';
import type { Classification } from '@/lib/cori/classify';
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
};

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
  loadedAt: number;
};

/** Everything the Cori page shows. Counts per class use head-count queries (PostgREST caps row reads at 1000). */
export async function loadCoriOverview(service: SupabaseClient): Promise<CoriOverview> {
  const [runsRes, totalRes, companiesRes, siteOkRes, eventsRes, candidatesRes, ...classRes] = await Promise.all([
    service.from('cori_runs').select('kind, started_at, ok, stats, error').order('started_at', { ascending: false }).limit(50),
    service.from('discovered_services').select('id', { count: 'exact', head: true }).neq('classification', 'low_quality'),
    service.from('discovered_companies').select('domain', { count: 'exact', head: true }),
    service.from('discovered_companies').select('domain', { count: 'exact', head: true }).eq('site_ok', true),
    service.from('discovery_events').select('at, event, details, discovered_services(service_name, canonical_url)').order('at', { ascending: false }).limit(20),
    service.from('endpoint_submissions').select('id, endpoint_url, name, description, submitted_at, candidate_metadata')
      .eq('source', 'cori_scout').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(100),
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
    candidates: (candidatesRes.data ?? []) as CoriCandidate[],
    loadedAt: Date.now(),
  };
}
