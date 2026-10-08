/**
 * Coinbase Bazaar discovery listings → Cori listing facts (spec §2–3). Pure.
 *
 * Endpoint: GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
 *   public, no API key; params type, network, scheme, payTo, limit, offset
 *   (~16k resources indexed as of Sep 2026)
 * Item shape (x402 bazaar extension, Go reference `DiscoveryResource`):
 *   resource, type, x402Version, accepts[], lastUpdated, description,
 *   mimeType, serviceName, tags[], iconUrl, extensions
 * Input metadata lives in extensions.bazaar (v2) or accepts[].outputSchema (v1).
 * Dynamic routes carry extensions.bazaar.routeTemplate (e.g. /users/:userId),
 * which is the catalog key (specs/extensions/bazaar.md).
 * Field names are validated leniently — confirm against live data on the first
 * dry run and tighten here. Listing content is untrusted (the spec warns that
 * catalogs can be poisoned): it is data, never instructions.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  findFacilitatorUrl,
  parsePaymentRequired,
  priceToUsdc,
  selectPaymentOption,
  type ParsedPaymentRequired,
  type PaymentOption,
} from '../check-runner/x402';
import { canonicalUrl } from './normalize';

export const BAZAAR_DISCOVERY_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources';

export const BazaarItemSchema = z.looseObject({
  resource: z.string(),
  type: z.string().optional(),
  x402Version: z.number().optional(),
  accepts: z.array(z.unknown()).optional(),
  lastUpdated: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  serviceName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  iconUrl: z.string().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export const BazaarPageSchema = z.looseObject({
  x402Version: z.number().optional(),
  items: z.array(z.unknown()),
  pagination: z.looseObject({
    limit: z.number().optional(),
    offset: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
});

export type BazaarItem = z.infer<typeof BazaarItemSchema>;

// Length caps for untrusted third-party text (spec §10)
const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;
const MAX_TAGS = 20;
const MAX_TAG = 40;
const MAX_METADATA_BYTES = 16 * 1024;
const MAX_EXAMPLE_BYTES = 8 * 1024;
const MAX_SNAPSHOT_BYTES = 16 * 1024;
const MAX_TEMPLATE = 512;

export type ListingInput = {
  method: 'GET' | 'POST' | 'OTHER';
  /** The method as listed, upper-cased (GET, POST, HEAD, DELETE, PUT, PATCH, …) */
  rawMethod: string;
  hasExample: boolean;
  /** GET: example query params; POST: example JSON body. Size-capped. */
  example: Record<string, unknown> | null;
};

// What Cori keeps of each listing version (discovery_listings)
export type ListingSnapshot = {
  resource: string;
  x402Version: number | null;
  sourceLastUpdated: string | null;
  accepts: unknown[] | null;                       // null if over the cap
  resourceMeta: Record<string, unknown> | null;
  extensions: Record<string, unknown> | null;      // null if over the cap
  itemBytes: number;
};

export type Listing = {
  /** Identity: origin + routeTemplate for dynamic routes, else the canonical resource URL */
  canonicalUrl: string;
  /** The concrete URL a probe calls (path params filled from the listing's example) */
  probeUrl: string;
  routeTemplate: string | null;
  resource: string;
  type: string;
  x402Version: number | null;
  serviceName: string | null;
  description: string | null;
  tags: string[];
  lastUpdated: string | null;                // ISO string when parseable
  parsed: ParsedPaymentRequired | null;
  option: PaymentOption | null;       // the Base + USDC option CORTX would use
  priceUsdc: number | null;
  priceAtomic: string | null;
  facilitatorUrl: string | null;
  payTo: string | null;
  input: ListingInput;
  metadata: Record<string, unknown> | null; // input/output info, capped
  listingHash: string;                       // detects listing changes
  snapshot: ListingSnapshot;
};

export type ListingError = { ok: false; reason: 'invalid_item' | 'not_http' | 'invalid_url'; resource?: string };

function clean(text: string | undefined, max: number): string | null {
  if (!text) return null;
  // Strip control characters; keep it plain text
  const t = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function capJson(v: unknown, maxBytes: number): Record<string, unknown> | null {
  const r = asRecord(v);
  if (!r) return null;
  return Buffer.byteLength(JSON.stringify(r)) <= maxBytes ? r : null;
}

// Stable JSON (sorted keys) so the hash only changes when content changes
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

// Input info: v2 extensions.bazaar.info.input, else v1 accepts[].outputSchema.input
export function extractInput(item: BazaarItem): { input: ListingInput; metadata: Record<string, unknown> | null } {
  const bazaar = asRecord(item.extensions?.bazaar);
  const v2Input = asRecord(asRecord(bazaar?.info)?.input);
  const v1Input = (item.accepts ?? [])
    .map((a) => asRecord(asRecord(asRecord(a)?.outputSchema)?.input))
    .find((x) => x != null) ?? null;
  const src = v2Input ?? v1Input;

  const methodRaw = String(src?.method ?? 'GET').toUpperCase().slice(0, 16);
  const method: ListingInput['method'] = methodRaw === 'GET' || methodRaw === 'POST' ? methodRaw : 'OTHER';

  let example: Record<string, unknown> | null = null;
  if (method === 'POST') example = capJson(src?.body ?? src?.bodyExample ?? src?.example, MAX_EXAMPLE_BYTES);
  if (method === 'GET') example = capJson(src?.queryParams, MAX_EXAMPLE_BYTES);

  const metadata = capJson(
    bazaar ?? (v1Input ? { input: v1Input } : null),
    MAX_METADATA_BYTES
  );

  return {
    // GET needs no body: x402 middleware answers 402 before reading params
    input: { method, rawMethod: methodRaw, hasExample: method === 'GET' || (method === 'POST' && example != null), example },
    metadata,
  };
}

/**
 * routeTemplate validation, as the x402 bazaar spec requires: starts with "/",
 * only safe path characters and :params, and after percent-decoding no ".."
 * and no "://". Anything else is ignored (fall back to the concrete URL).
 */
export function validRouteTemplate(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_TEMPLATE) return null;
  if (!/^\/[a-zA-Z0-9_/:.\-~%]+$/.test(v)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(v); } catch { return null; }
  if (decoded.includes('..') || decoded.includes('://')) return null;
  return v;
}

// Fill ":name" path segments from the listing's example pathParams
function fillPathParams(url: string, params: Record<string, unknown> | null): string {
  if (!params) return url;
  const u = new URL(url);
  u.pathname = u.pathname.split('/').map((seg) => {
    if (!seg.startsWith(':')) return seg;
    const v = params[seg.slice(1)];
    return typeof v === 'string' || typeof v === 'number' ? encodeURIComponent(String(v)) : seg;
  }).join('/');
  return u.toString();
}

function capArray(v: unknown, maxBytes: number): unknown[] | null {
  return Array.isArray(v) && Buffer.byteLength(JSON.stringify(v)) <= maxBytes ? v : null;
}

function isoOrNull(v: string | undefined): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Removes NUL characters (U+0000) from every string and key, deeply. Postgres
 * can store them in neither text nor jsonb ("unsupported Unicode escape
 * sequence"), and one such listing stopped the whole first live Bazaar pass
 * (Oct 7). Listings are untrusted input, so they're cleaned before use.
 */
export function stripNul<T>(v: T): T {
  if (typeof v === 'string') return v.replace(/\u0000/g, '') as T;
  if (Array.isArray(v)) return v.map(stripNul) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [stripNul(k), stripNul(x)])) as T;
  }
  return v;
}

export function parseBazaarItem(item0: unknown): Listing | ListingError {
  const raw = stripNul(item0);
  const res = BazaarItemSchema.safeParse(raw);
  if (!res.success) return { ok: false, reason: 'invalid_item' };
  const item = res.data;

  const type = (item.type ?? 'http').toLowerCase();
  if (type !== 'http') return { ok: false, reason: 'not_http', resource: item.resource };

  const concrete = canonicalUrl(item.resource);
  if (!concrete) return { ok: false, reason: 'invalid_url', resource: item.resource };

  const bazaar = asRecord(item.extensions?.bazaar);
  const routeTemplate = validRouteTemplate(bazaar?.routeTemplate);
  const identity = routeTemplate ? canonicalUrl(new URL(concrete).origin + routeTemplate) ?? concrete : concrete;
  const pathParams = asRecord(asRecord(asRecord(bazaar?.info)?.input)?.pathParams);
  const probeUrl = canonicalUrl(fillPathParams(concrete, pathParams)) ?? concrete;

  // Reuse the runner's parser: the listing's accepts[] is a PaymentRequired body
  const parsed = parsePaymentRequired(
    JSON.stringify({ x402Version: item.x402Version ?? 1, accepts: item.accepts ?? [] }),
    new Headers()
  );
  const option = parsed ? selectPaymentOption(parsed.options, 'mainnet') ?? null : null;
  const price = option ? priceToUsdc(option) : null;
  const { input, metadata } = extractInput(item);

  const resourceMeta = capJson({
    serviceName: item.serviceName, description: item.description, tags: item.tags, mimeType: item.mimeType,
  }, MAX_SNAPSHOT_BYTES);

  return {
    canonicalUrl: identity,
    probeUrl,
    routeTemplate,
    resource: item.resource,
    type,
    x402Version: item.x402Version ?? null,
    serviceName: clean(item.serviceName, MAX_NAME),
    description: clean(item.description, MAX_DESCRIPTION),
    tags: (item.tags ?? []).slice(0, MAX_TAGS).map((t) => clean(t, MAX_TAG)).filter((t): t is string => t != null),
    lastUpdated: isoOrNull(item.lastUpdated),
    parsed,
    option,
    priceUsdc: price?.usdc ?? null,
    priceAtomic: option?.amount ?? null,
    facilitatorUrl: parsed && option ? findFacilitatorUrl(parsed, option) : null,
    payTo: (option ?? parsed?.options[0])?.payTo || null,
    input,
    metadata,
    listingHash: createHash('sha256')
      .update(stableStringify({ accepts: item.accepts ?? [], serviceName: item.serviceName, description: item.description, tags: item.tags, extensions: item.extensions }))
      .digest('hex')
      .slice(0, 32),
    snapshot: {
      resource: item.resource.slice(0, 2048),
      x402Version: item.x402Version ?? null,
      sourceLastUpdated: isoOrNull(item.lastUpdated),
      accepts: capArray(item.accepts ?? [], MAX_SNAPSHOT_BYTES),
      resourceMeta,
      extensions: capJson(item.extensions, MAX_SNAPSHOT_BYTES),
      itemBytes: Buffer.byteLength(JSON.stringify(raw)),
    },
  };
}

export function isListing(x: Listing | ListingError): x is Listing {
  return !('ok' in x);
}
