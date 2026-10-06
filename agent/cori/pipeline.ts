// Cori Scout pipeline (spec §3): discover → normalize → dedupe → link →
// classify → probe → queue. Deterministic; no payments; no public writes.
// Memory (spec v2 §8): every listing version and every probe is kept;
// discovered_services holds only the current facts (a cache).
import { createHash } from 'node:crypto';
import { canonicalUrl, hostOf } from '../../lib/cori/normalize';
import { classify, type Classification, type ClassifyInput, type Terms } from '../../lib/cori/classify';
import { isListing, parseBazaarItem, type Listing } from '../../lib/cori/bazaar';
import type { SafeFetchOptions } from '../../lib/net/safe-fetch';
import type { CoriConfig } from './config';
import type { Logger } from './log';
import { HostLimiter } from './limiter';
import { probe } from './probe';
import { fetchBazaarItems, type BazaarPassStats } from './sources/bazaar';
import type { IndexRow, KnownRecords, ProbeRecord, ServicePatch, ServiceRow, SourceRow, Store } from './store';

export type Deps = {
  store: Store;
  config: CoriConfig;
  log: Logger;
  limiter: HostLimiter;
  now?: () => Date;
  fetchOptions?: SafeFetchOptions;          // test seams only
  sleep?: (ms: number) => Promise<void>;
  /** Aborted on shutdown: probe batches stop between probes */
  signal?: AbortSignal;
  /** Last complete (not truncated) pass per source, kept across cycles by runCycle */
  passLog?: Map<string, Date>;
};

const HOUR = 3_600_000;
const GONE_AFTER_MS = 7 * 24 * HOUR;
const PROBE_BACKOFF_MS = [HOUR, 6 * HOUR, 24 * HOUR];
const UNREACHABLE_AFTER_FAILURES = 3;
// A failed source is retried after this long, not every tick
const SOURCE_RETRY_MS = 30 * 60_000;
// The disappearance sweep only runs when every enabled source completed a full pass this recently
const SWEEP_NEEDS_PASS_WITHIN_MS = 24 * HOUR;
const SWEEP_BATCH = 500;
// An unchanged listing only refreshes last_seen_at this often (disappearance works in days)
const TOUCH_EVERY_MS = 20 * HOUR;

// Classes decided from the listing alone never need a probe until the listing changes
const NO_PROBE: ReadonlySet<Classification> = new Set([
  'blocked', 'already_monitored', 'already_listed', 'already_submitted',
  'unsupported_network', 'unsupported_asset', 'unsupported_scheme', 'unsupported_method', 'too_expensive', 'gone',
]);

// Classes decided from the listing alone: when the listing disappears, they become 'gone'
// (probed classes become 'gone' through the probe rule instead)
const LISTING_ONLY: ReadonlySet<Classification> = new Set([
  'blocked', 'unsupported_network', 'unsupported_asset', 'unsupported_scheme', 'unsupported_method', 'too_expensive',
]);

const nowOf = (d: Deps) => (d.now ? d.now() : new Date());

// Canonical URLs omit :443, so any explicit port is a non-443 port
function portAllowed(url: string, allowed: readonly number[]): boolean {
  const u = new URL(url);
  return allowed.includes(u.port ? Number(u.port) : 443);
}

const probeUrlOf = (row: Pick<ServiceRow, 'canonical_url' | 'resource_url'>) => row.resource_url ?? row.canonical_url;
const after = (from: Date, ms: number) => new Date(from.getTime() + ms);

// ─── Linking against existing CORTX records (spec §5) ─────────────────────────

export type LinkIndex = {
  services: Map<string, string>;
  seeds: Map<string, string>;
  submissions: Map<string, Array<{ id: string; status: string; discovered_service_id: string | null }>>;
};

export function buildLinkIndex(known: KnownRecords): LinkIndex {
  const services = new Map<string, string>();
  const seeds = new Map<string, string>();
  const submissions: LinkIndex['submissions'] = new Map();
  for (const s of known.services) { const c = canonicalUrl(s.endpoint_url); if (c) services.set(c, s.id); }
  for (const s of known.seeds) { const c = canonicalUrl(s.endpoint_url); if (c) seeds.set(c, s.id); }
  for (const s of known.submissions) {
    const c = canonicalUrl(s.endpoint_url);
    if (!c) continue;
    submissions.set(c, [...(submissions.get(c) ?? []), { id: s.id, status: s.status, discovered_service_id: s.discovered_service_id }]);
  }
  return { services, seeds, submissions };
}

type Link = { linked: ClassifyInput['linked']; patch: ServicePatch };

// `urls`: the identity URL and, for dynamic routes, the concrete URL too
function linkFor(urls: Array<string | null>, rowId: string | null, idx: LinkIndex): Link {
  const keys = [...new Set(urls.filter((u): u is string => !!u))];
  const first = <T>(m: Map<string, T>) => keys.map((k) => m.get(k)).find((v) => v != null) ?? null;
  const serviceId = first(idx.services);
  const seedId = first(idx.seeds);
  // A submission someone else made (pending/approved) — not Cori's own candidate
  const other = keys.flatMap((k) => idx.submissions.get(k) ?? []).find(
    (s) => (s.status === 'pending' || s.status === 'approved') && (rowId == null || s.discovered_service_id !== rowId)
  );
  const patch: ServicePatch = { linked_service_id: serviceId, linked_seed_id: seedId };
  if (serviceId) return { linked: 'monitored', patch };
  if (seedId) return { linked: 'listed', patch };
  if (other) return { linked: 'submitted', patch };
  return { linked: null, patch };
}

// ─── Listing → facts ──────────────────────────────────────────────────────────

function payToFingerprint(payTo: string | undefined): string | null {
  return payTo ? createHash('sha256').update(payTo.toLowerCase()).digest('hex').slice(0, 16) : null;
}

function listingTerms(l: Listing): Terms | null {
  const o = l.option ?? l.parsed?.options[0];
  if (!o) return null;
  const transfer = o.extra?.assetTransferMethod;
  return {
    network: o.network,
    asset: o.asset,
    scheme: o.scheme,
    transferMethod: typeof transfer === 'string' ? transfer : null,
    priceUsdc: l.option ? l.priceUsdc : null,
    facilitatorPublished: l.facilitatorUrl != null,
  };
}

function listingPatch(l: Listing): ServicePatch {
  const o = l.option ?? l.parsed?.options[0] ?? null;
  const transfer = o?.extra?.assetTransferMethod;
  return {
    service_name: l.serviceName,
    description: l.description,
    tags: l.tags,
    // Bazaar metadata lives in discovery_listings (one copy per version); not duplicated here
    http_method: l.input.rawMethod,
    input_example: l.input.example,
    x402_version: l.x402Version,
    network: o?.network ?? null,
    asset: o?.asset ?? null,
    scheme: o?.scheme ?? null,
    transfer_method: typeof transfer === 'string' ? transfer : null,
    price_atomic: l.priceAtomic,
    price_usdc: l.priceUsdc,
    pay_to_fingerprint: payToFingerprint(o?.payTo),
    pay_to: l.payTo,
    facilitator_url: l.facilitatorUrl,
    listing_hash: l.listingHash,
    route_template: l.routeTemplate,
    resource_url: l.probeUrl === l.canonicalUrl ? null : l.probeUrl,
    source_last_updated: l.lastUpdated ? new Date(l.lastUpdated) : null,
  };
}

function probeTerms(p: ProbeRecord): Terms {
  return {
    network: p.network ?? '',
    asset: p.asset ?? '',
    scheme: p.scheme ?? '',
    transferMethod: p.transfer_method,
    priceUsdc: p.price_usdc,
    facilitatorPublished: p.facilitator_published,
  };
}

function hasExample(row: Pick<ServiceRow, 'http_method' | 'input_example'>): boolean {
  return row.http_method === 'GET' || (row.http_method === 'POST' && row.input_example != null);
}

function inputOf(row: Pick<ServiceRow, 'http_method' | 'input_example'>): ClassifyInput['input'] {
  const m = row.http_method === 'GET' || row.http_method === 'POST' ? row.http_method : 'OTHER';
  return { method: m, rawMethod: row.http_method, hasExample: hasExample(row) };
}

// ─── Discovery (one source pass) ──────────────────────────────────────────────

export type DiscoveryStats = BazaarPassStats & {
  invalid_items: number; skipped_non_http: number; new_services: number;
  changed_listings: number; new_listing_versions: number; reappeared: number; duplicates_in_pass: number;
  unchanged: number; touched: number;
  classes: Record<string, number>;
};

const LINKED_CLASS = { monitored: 'already_monitored', listed: 'already_listed', submitted: 'already_submitted' } as const;

/**
 * Fast path: same listing content from the same source, still listed, and
 * nothing around it changed (CORTX links, denylist, ports) — the stored
 * classification still holds, so the item needs no writes at all.
 */
function isUnchanged(
  known: IndexRow, l: Listing, sourceId: string, host: string, denylist: Set<string>, idx: LinkIndex, ports: readonly number[],
): boolean {
  if (known.listing_hash !== l.listingHash) return false;
  if (!known.sources.includes(sourceId)) return false;
  if (known.disappeared_at != null || known.classification === 'gone') return false;
  if (denylist.has(host) || !portAllowed(l.probeUrl, ports)) return known.classification === 'blocked';
  if (known.classification === 'blocked') return false;
  const link = linkFor([l.canonicalUrl, l.probeUrl], known.id, idx);
  if (link.patch.linked_service_id !== known.linked_service_id || link.patch.linked_seed_id !== known.linked_seed_id) return false;
  const linkedClass = link.linked ? LINKED_CLASS[link.linked] : null;
  const storedLinked = known.classification.startsWith('already_') ? known.classification : null;
  return linkedClass === storedLinked;
}

export async function discoverSource(d: Deps, source: SourceRow): Promise<DiscoveryStats> {
  const { store, config } = d;
  const log = d.log.child({ component: 'scout', source: source.id });
  const at = nowOf(d);
  const idx = buildLinkIndex(await store.loadKnown());
  const denylist = await store.loadDenylist();
  // One query for everything we already know; unchanged listings then cost no per-item queries (B3)
  const index = await store.loadIndex();
  const toTouch: string[] = [];
  const stats: DiscoveryStats = {
    pages: 0, items: 0, truncated: false, total: null,
    invalid_items: 0, skipped_non_http: 0, new_services: 0, changed_listings: 0, new_listing_versions: 0, reappeared: 0,
    unchanged: 0, touched: 0,
    duplicates_in_pass: 0, classes: {},
  };
  const seenThisPass = new Set<string>();

  const items = fetchBazaarItems({
    url: source.url,
    pageLimit: config.bazaarPageLimit,
    maxPages: config.bazaarMaxPages,
    userAgent: config.userAgent,
    log,
    fetchOptions: d.fetchOptions,
    sleep: d.sleep,
  }, stats);

  for await (const raw of items) {
    const l = parseBazaarItem(raw);
    if (!isListing(l)) {
      if (l.reason === 'not_http') stats.skipped_non_http++; else stats.invalid_items++;
      continue;
    }
    if (seenThisPass.has(l.canonicalUrl)) { stats.duplicates_in_pass++; continue; }
    seenThisPass.add(l.canonicalUrl);

    const host = hostOf(l.canonicalUrl);
    const known = index.get(l.canonicalUrl);
    if (known && isUnchanged(known, l, source.id, host, denylist, idx, config.allowedPorts)) {
      stats.unchanged++;
      stats.classes[known.classification] = (stats.classes[known.classification] ?? 0) + 1;
      if (at.getTime() - known.last_seen_at.getTime() >= TOUCH_EVERY_MS) toTouch.push(known.id);
      continue;
    }
    let row = await store.getByUrl(l.canonicalUrl);
    const isNew = row == null;
    if (!row) {
      row = await store.insertService({ canonical_url: l.canonicalUrl, host, first_source: source.id }, at);
      await store.addEvent(row.id, 'first_seen', { source: source.id });
      stats.new_services++;
    }

    const { seenBefore } = await store.touchSource(row.id, source.id, at, l.listingHash);
    const { newVersion } = await store.recordListing(row.id, source.id, l.listingHash, l.snapshot, at);
    if (newVersion) stats.new_listing_versions++;
    const changed = !isNew && row.listing_hash !== l.listingHash;
    if (changed) {
      stats.changed_listings++;
      await store.addEvent(row.id, 'listing_changed', { source: source.id, from_hash: row.listing_hash, to_hash: l.listingHash });
      if (row.price_usdc != null && l.priceUsdc != null && Number(row.price_usdc) !== l.priceUsdc) {
        await store.addEvent(row.id, 'price_changed', { from: Number(row.price_usdc), to: l.priceUsdc, via: 'listing' });
      }
    }
    const reappeared = !isNew && (row.classification === 'gone' || row.disappeared_at != null);
    if (reappeared) {
      stats.reappeared++;
      await store.addEvent(row.id, 'reappeared', { source: source.id, disappeared_at: row.disappeared_at?.toISOString() ?? null });
    }
    if (!isNew && !seenBefore) await store.addEvent(row.id, 'listing_changed', { new_source: source.id });

    const link = linkFor([l.canonicalUrl, l.probeUrl], row.id, idx);
    // Reuse the last probe only if the listing hasn't changed since
    const lastProbe = !isNew && !changed && row.classification !== 'gone' ? row.last_probe : null;
    const probeOutcome = lastProbe && lastProbe.outcome !== 'blocked' ? lastProbe.outcome : null;
    const facts = listingPatch(l);
    const blockedReason = denylist.has(host) ? 'denylist' : !portAllowed(l.probeUrl, config.allowedPorts) ? 'port' : null;
    const result = classify({
      blockedReason,
      linked: link.linked,
      probe: probeOutcome,
      terms: probeOutcome === 'ok' && lastProbe ? probeTerms(lastProbe) : listingTerms(l),
      input: inputOf({ http_method: facts.http_method ?? 'GET', input_example: facts.input_example ?? null }),
      maxPriceUsdc: config.maxEligiblePriceUsdc,
    });

    const patch: ServicePatch = {
      ...facts,
      ...link.patch,
      last_seen_at: at,
      classification: result.classification,
      classification_reasons: result.reasons,
      ...(reappeared ? { disappeared_at: null } : {}),
    };
    // Probe schedule: never for listing-level rejections; now for new/changed
    // candidates; otherwise keep the existing schedule
    if (NO_PROBE.has(result.classification)) patch.next_probe_at = null;
    else if (isNew || changed || row.next_probe_at == null) patch.next_probe_at = at;

    await store.updateService(row.id, patch);
    if (!isNew && row.classification !== result.classification) {
      await store.addEvent(row.id, 'classification_changed', { from: row.classification, to: result.classification, reasons: result.reasons });
    }
    stats.classes[result.classification] = (stats.classes[result.classification] ?? 0) + 1;
  }

  if (toTouch.length > 0) await store.touchSeen(toTouch, source.id, at);
  stats.touched = toTouch.length;
  await store.markSourceRun(source.id, at);
  log.info('discovery_pass_done', { ...stats });
  return stats;
}

// ─── Probing (free) ───────────────────────────────────────────────────────────

export type ProbeStats = {
  probed: number; rescheduled_rate_limit: number; budget_left: number;
  outcomes: Record<string, number>; classes: Record<string, number>;
};

async function probeOne(d: Deps, row: ServiceRow, idx: LinkIndex, denylist: Set<string>, stats: ProbeStats): Promise<void> {
  const { store, config } = d;
  const at = nowOf(d);

  const url = probeUrlOf(row);
  const blockedReason = denylist.has(row.host) ? 'denylist' : null;
  const p: ProbeRecord = blockedReason
    ? {
        outcome: 'blocked', at: at.toISOString(), method: null, http_status: null, latency_ms: null, error: 'DENYLIST',
        terms_source: null, x402_version: null, network: null, asset: null, scheme: null, transfer_method: null,
        price_atomic: null, price_usdc: null, pay_to: null, facilitator_published: false,
      }
    : await probe({ url, http_method: row.http_method }, { userAgent: config.userAgent, allowedPorts: config.allowedPorts, fetchOptions: d.fetchOptions });
  stats.probed++;
  stats.outcomes[p.outcome] = (stats.outcomes[p.outcome] ?? 0) + 1;
  // Every attempt is kept, including "couldn't check" (DATA COMPOUNDS)
  await store.addObservation(row.id, { ...p, probe_url: url, cori_version: config.version });

  const failures = p.outcome === 'ok' ? 0 : row.probe_failures + 1;
  const link = linkFor([row.canonical_url, row.resource_url], row.id, idx);
  const gone = p.outcome !== 'ok' && p.outcome !== 'blocked' && at.getTime() - row.last_seen_at.getTime() > GONE_AFTER_MS;

  let result: { classification: Classification; reasons: string[] };
  if (p.outcome === 'unreachable' && failures < UNREACHABLE_AFTER_FAILURES && !gone) {
    // Transient until 3 failures in a row
    result = { classification: 'pending', reasons: [`probe:retrying(${failures}/${UNREACHABLE_AFTER_FAILURES})`, `error:${p.error ?? 'unknown'}`] };
  } else {
    result = classify({
      blockedReason: blockedReason ?? (p.outcome === 'blocked' ? (p.error === 'BLOCKED_PORT' ? 'port' : (p.error ?? 'ssrf').toLowerCase()) : null),
      linked: link.linked,
      gone,
      probe: p.outcome === 'blocked' ? null : p.outcome,
      terms: p.outcome === 'ok' ? probeTerms(p) : null,
      input: inputOf(row),
      maxPriceUsdc: config.maxEligiblePriceUsdc,
    });
  }

  const nextProbeAt = NO_PROBE.has(result.classification)
    ? null
    : p.outcome === 'ok'
      ? after(at, config.probeRecheckHours * HOUR)
      : after(at, PROBE_BACKOFF_MS[Math.min(failures, PROBE_BACKOFF_MS.length) - 1]);

  await store.updateService(row.id, {
    ...link.patch,
    last_probe_at: at,
    last_probe: p,
    probe_failures: failures,
    next_probe_at: nextProbeAt,
    classification: result.classification,
    classification_reasons: result.reasons,
  });

  const prev = row.last_probe;
  if (prev?.outcome !== p.outcome) {
    await store.addEvent(row.id, 'probe_status_changed', { from: prev?.outcome ?? null, to: p.outcome, http_status: p.http_status, error: p.error });
  }
  if (prev?.outcome === 'ok' && p.outcome === 'ok') {
    if (prev.price_usdc !== p.price_usdc) {
      await store.addEvent(row.id, 'price_changed', { from: prev.price_usdc, to: p.price_usdc, via: 'probe' });
    }
    if (prev.network !== p.network || prev.asset !== p.asset || prev.scheme !== p.scheme || prev.x402_version !== p.x402_version) {
      await store.addEvent(row.id, 'terms_changed', {
        from: { network: prev.network, asset: prev.asset, scheme: prev.scheme, x402_version: prev.x402_version },
        to: { network: p.network, asset: p.asset, scheme: p.scheme, x402_version: p.x402_version },
      });
    }
  }
  if (row.classification !== result.classification) {
    await store.addEvent(row.id, 'classification_changed', { from: row.classification, to: result.classification, reasons: result.reasons });
  }
  stats.classes[result.classification] = (stats.classes[result.classification] ?? 0) + 1;
}

export async function probeDue(d: Deps, limit = d.config.probeBatch): Promise<ProbeStats> {
  const { store, config } = d;
  const log = d.log.child({ component: 'probe' });
  // Always a real timer: waiting on a busy host must yield to the event loop
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(ms, 10)));
  const stats: ProbeStats = { probed: 0, rescheduled_rate_limit: 0, budget_left: 0, outcomes: {}, classes: {} };
  // Global hourly probe budget: only take as many due rows as it still allows
  const budget = d.limiter.globalRemaining();
  stats.budget_left = budget;
  if (budget === 0 || d.signal?.aborted) return stats;
  // Company-first (B3): a few rows per host per batch, hosts never probed first,
  // hosts that used up today's checks skipped
  const due = await store.dueProbes(nowOf(d), Math.min(limit, budget), {
    perHost: config.probePerHostPerBatch,
    excludeHosts: d.limiter.cappedHosts(),
  });
  if (due.length === 0) return stats;

  const idx = buildLinkIndex(await store.loadKnown());
  const denylist = await store.loadDenylist();
  const queue = [...due];

  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      if (d.signal?.aborted) break; // shutting down: leave the rest for next time
      let wait = d.limiter.reserve(row.host);
      while (wait > 0 && !d.signal?.aborted) {
        await sleep(Math.min(wait, 5_000));
        wait = d.limiter.reserve(row.host);
      }
      if (wait > 0) break; // aborted while waiting
      if (wait < 0) {
        // Hourly cap (this host, or the global budget): try again in an hour
        await store.updateService(row.id, { next_probe_at: after(nowOf(d), HOUR) });
        stats.rescheduled_rate_limit++;
        continue;
      }
      try {
        await probeOne(d, row, idx, denylist, stats);
      } catch (err) {
        log.error('probe_failed', { canonical_url: row.canonical_url, error: err instanceof Error ? err.message : String(err) });
        await store.updateService(row.id, { next_probe_at: after(nowOf(d), HOUR) }).catch(() => {});
      } finally {
        d.limiter.release(row.host);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(config.probeConcurrency, due.length) }, worker));
  log.info('probe_batch_done', { ...stats });
  return stats;
}

// ─── Queue into the existing admin review (spec §3 step 9) ────────────────────

export type QueueStats = { queued: number; skipped_linked: number; skipped_existing: number; cap: number; cap_hit: boolean };

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function queueEligible(d: Deps): Promise<QueueStats> {
  const { store, config } = d;
  const log = d.log.child({ component: 'queue' });
  const at = nowOf(d);
  const already = await store.countQueuedSince(startOfUtcDay(at));
  const remaining = Math.max(0, config.dailyQueueCap - already);
  const stats: QueueStats = { queued: 0, skipped_linked: 0, skipped_existing: 0, cap: config.dailyQueueCap, cap_hit: remaining === 0 };
  if (remaining === 0) return stats;

  const idx = buildLinkIndex(await store.loadKnown());
  // At most queuePerHostPerDay new candidates per host per UTC day (B3: a fair review page)
  const queuedToday = new Map<string, number>();
  for (const h of await store.hostsQueuedSince(startOfUtcDay(at))) queuedToday.set(h, (queuedToday.get(h) ?? 0) + 1);
  const full = [...queuedToday].filter(([, n]) => n >= config.queuePerHostPerDay).map(([h]) => h);
  const candidates = await store.queueCandidates(remaining, { perHost: config.queuePerHostPerDay, excludeHosts: full });
  for (const row of candidates) {
    // Re-check against CORTX records right before queueing
    const link = linkFor([row.canonical_url, row.resource_url], row.id, idx);
    if (link.linked) {
      const cls = link.linked === 'monitored' ? 'already_monitored' : link.linked === 'listed' ? 'already_listed' : 'already_submitted';
      await store.updateService(row.id, { ...link.patch, classification: cls, classification_reasons: [`linked:${link.linked}`], next_probe_at: null });
      stats.skipped_linked++;
      continue;
    }
    const origin = new URL(row.canonical_url).origin;
    const sources = await store.sourcesFor(row.id);
    const submissionId = await store.insertSubmission({
      // Reviewers (and a later paid check) need a callable URL, not a route template
      endpoint_url: probeUrlOf(row),
      name: (row.service_name ?? `${row.host}${new URL(row.canonical_url).pathname}`).slice(0, 120),
      description: row.description,
      website_url: origin,
      category: row.tags[0] ?? null,
      discovered_service_id: row.id,
      candidate_metadata: {
        discovered_by: 'cori_scout',
        classification: row.classification,
        reasons: row.classification_reasons,
        network: row.last_probe?.network ?? row.network,
        asset: row.last_probe?.asset ?? row.asset,
        price_usdc: row.last_probe?.price_usdc ?? row.price_usdc,
        x402_version: row.last_probe?.x402_version ?? row.x402_version,
        http_method: row.http_method,
        route_template: row.route_template,
        has_input_example: hasExample(row),
        facilitator_published: row.last_probe?.facilitator_published ?? row.facilitator_url != null,
        first_seen_at: row.first_seen_at.toISOString(),
        sources,
        evidence_state: 'observed',
      },
    });
    if (!submissionId) { stats.skipped_existing++; continue; }
    await store.updateService(row.id, { linked_submission_id: submissionId });
    await store.addEvent(row.id, 'queued', { submission_id: submissionId, classification: row.classification });
    stats.queued++;
  }
  stats.cap_hit = stats.queued >= remaining;
  if (stats.queued + stats.skipped_linked + stats.skipped_existing > 0) log.info('queue_done', { ...stats });
  return stats;
}

// ─── Disappearance sweep (spec v2 G8) ─────────────────────────────────────────

export type SweepStats = { disappeared: number; gone: number; skipped: string | null };

/**
 * Marks services no source has listed for 7 days as disappeared (an event, never
 * a deletion). Only runs when every enabled source completed a full pass in the
 * last 24 h — so a source outage or a truncated pass never looks like
 * services vanishing. Listing-only classes become 'gone'; probed services keep
 * their class (the probe rule decides, and a delisted service may still work).
 */
export async function sweepDisappeared(d: Deps, sources: SourceRow[]): Promise<SweepStats> {
  const at = nowOf(d);
  const stats: SweepStats = { disappeared: 0, gone: 0, skipped: null };
  const enabled = sources.filter((s) => s.enabled);
  const fresh = enabled.every((s) => {
    const t = d.passLog?.get(s.id);
    return t != null && at.getTime() - t.getTime() <= SWEEP_NEEDS_PASS_WITHIN_MS;
  });
  if (enabled.length === 0 || !fresh) { stats.skipped = 'no_recent_complete_pass'; return stats; }

  const rows = await d.store.notSeenSince(new Date(at.getTime() - GONE_AFTER_MS), SWEEP_BATCH);
  for (const row of rows) {
    const patch: ServicePatch = { disappeared_at: at };
    await d.store.addEvent(row.id, 'disappeared', { last_seen_at: row.last_seen_at.toISOString() });
    stats.disappeared++;
    if (LISTING_ONLY.has(row.classification)) {
      Object.assign(patch, { classification: 'gone', classification_reasons: ['gone:not_listed_7d'], next_probe_at: null });
      await d.store.addEvent(row.id, 'classification_changed', { from: row.classification, to: 'gone', reasons: ['gone:not_listed_7d'] });
      stats.gone++;
    }
    await d.store.updateService(row.id, patch);
  }
  return stats;
}

// ─── One full cycle ───────────────────────────────────────────────────────────

export type CycleStats = {
  discovery: Record<string, DiscoveryStats>; probe: ProbeStats; queue: QueueStats;
  sweep: SweepStats | null; source_errors: Record<string, string>;
};

async function recorded<T>(d: Deps, kind: string, fn: () => Promise<T>): Promise<T> {
  const runId = await d.store.startRun(kind);
  const t0 = Date.now();
  try {
    const out = await fn();
    await d.store.finishRun(runId, true, { ...(out as unknown as Record<string, unknown>), duration_ms: Date.now() - t0 });
    return out;
  } catch (err) {
    await d.store.finishRun(runId, false, {}, err instanceof Error ? err.message : String(err)).catch(() => {});
    throw err;
  }
}

// Like recorded(), but only writes a run row when the step did something (or
// failed) — idle ticks every 30s would otherwise flood cori_runs. Liveness
// comes from the heartbeat row instead.
async function quietlyRecorded<T>(d: Deps, kind: string, fn: () => Promise<T>, didWork: (t: T) => boolean): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    if (didWork(out)) {
      const id = await d.store.startRun(kind);
      await d.store.finishRun(id, true, { ...(out as unknown as Record<string, unknown>), duration_ms: Date.now() - t0 });
    }
    return out;
  } catch (err) {
    const id = await d.store.startRun(kind).catch(() => null);
    if (id != null) await d.store.finishRun(id, false, {}, err instanceof Error ? err.message : String(err)).catch(() => {});
    throw err;
  }
}

export async function runCycle(d: Deps, opts: { forceSources?: boolean; maxProbeBatches?: number } = {}): Promise<CycleStats> {
  const at = nowOf(d);
  d.passLog ??= new Map();
  const out: CycleStats = {
    discovery: {}, source_errors: {}, sweep: null,
    probe: { probed: 0, rescheduled_rate_limit: 0, budget_left: 0, outcomes: {}, classes: {} },
    queue: { queued: 0, skipped_linked: 0, skipped_existing: 0, cap: d.config.dailyQueueCap, cap_hit: false },
  };

  const sources = await d.store.loadSources();
  for (const source of sources) {
    if (!source.enabled) continue;
    const due = opts.forceSources || !source.last_run_at || at.getTime() - source.last_run_at.getTime() >= source.interval_minutes * 60_000;
    if (!due) continue;
    try {
      out.discovery[source.id] = await recorded(d, `discover:${source.id}`, () => discoverSource(d, source));
      if (!out.discovery[source.id].truncated) d.passLog.set(source.id, at);
    } catch (err) {
      // One failing source never stops the others (spec §12)
      out.source_errors[source.id] = err instanceof Error ? err.message : String(err);
      d.log.error('discovery_failed', { source: source.id, error: out.source_errors[source.id], retry_in_minutes: SOURCE_RETRY_MS / 60_000 });
      // Back-date last_run_at so the source is due again in SOURCE_RETRY_MS
      const retryAt = new Date(at.getTime() - source.interval_minutes * 60_000 + SOURCE_RETRY_MS);
      await d.store.markSourceRun(source.id, retryAt).catch(() => {});
    }
  }

  // Disappearance only changes after a pass, so sweep right after one
  if (Object.keys(out.discovery).length > 0) {
    out.sweep = await quietlyRecorded(d, 'sweep', () => sweepDisappeared(d, sources), (x) => x.disappeared > 0);
  }

  for (let i = 0; i < (opts.maxProbeBatches ?? 1); i++) {
    if (d.signal?.aborted) break;
    const s = await quietlyRecorded(d, 'probe', () => probeDue(d), (x) => x.probed + x.rescheduled_rate_limit > 0);
    out.probe.probed += s.probed;
    out.probe.budget_left = s.budget_left;
    out.probe.rescheduled_rate_limit += s.rescheduled_rate_limit;
    for (const [k, v] of Object.entries(s.outcomes)) out.probe.outcomes[k] = (out.probe.outcomes[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.classes)) out.probe.classes[k] = (out.probe.classes[k] ?? 0) + v;
    if (s.probed === 0) break;
  }

  out.queue = await quietlyRecorded(d, 'queue', () => queueEligible(d), (x) => x.queued + x.skipped_linked + x.skipped_existing > 0);
  return out;
}
