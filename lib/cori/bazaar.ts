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
 * Field names are validated leniently — confirm against live data on the first
 * dry run and tighten here.
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

export type ListingInput = {
  method: 'GET' | 'POST' | 'OTHER';
  hasExample: boolean;
  /** GET: example query params; POST: example JSON body. Size-capped. */
  example: Record<string, unknown> | null;
};

export type Listing = {
  canonicalUrl: string;
  resource: string;
  type: string;
  x402Version: number | null;
  serviceName: string | null;
  description: string | null;
  tags: string[];
  lastUpdated: string | null;
  parsed: ParsedPaymentRequired | null;
  option: PaymentOption | null;       // the Base + USDC option CORTX would use
  priceUsdc: number | null;
  priceAtomic: string | null;
  facilitatorUrl: string | null;
  input: ListingInput;
  metadata: Record<string, unknown> | null; // input/output info, capped
  listingHash: string;                       // detects listing changes
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

  const methodRaw = String(src?.method ?? 'GET').toUpperCase();
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
    input: { method, hasExample: method === 'GET' || (method === 'POST' && example != null), example },
    metadata,
  };
}

export function parseBazaarItem(raw: unknown): Listing | ListingError {
  const res = BazaarItemSchema.safeParse(raw);
  if (!res.success) return { ok: false, reason: 'invalid_item' };
  const item = res.data;

  const type = (item.type ?? 'http').toLowerCase();
  if (type !== 'http') return { ok: false, reason: 'not_http', resource: item.resource };

  const canonical = canonicalUrl(item.resource);
  if (!canonical) return { ok: false, reason: 'invalid_url', resource: item.resource };

  // Reuse the runner's parser: the listing's accepts[] is a PaymentRequired body
  const parsed = parsePaymentRequired(
    JSON.stringify({ x402Version: item.x402Version ?? 1, accepts: item.accepts ?? [] }),
    new Headers()
  );
  const option = parsed ? selectPaymentOption(parsed.options, 'mainnet') ?? null : null;
  const price = option ? priceToUsdc(option) : null;
  const { input, metadata } = extractInput(item);

  return {
    canonicalUrl: canonical,
    resource: item.resource,
    type,
    x402Version: item.x402Version ?? null,
    serviceName: clean(item.serviceName, MAX_NAME),
    description: clean(item.description, MAX_DESCRIPTION),
    tags: (item.tags ?? []).slice(0, MAX_TAGS).map((t) => clean(t, MAX_TAG)).filter((t): t is string => t != null),
    lastUpdated: item.lastUpdated ?? null,
    parsed,
    option,
    priceUsdc: price?.usdc ?? null,
    priceAtomic: option?.amount ?? null,
    facilitatorUrl: parsed && option ? findFacilitatorUrl(parsed, option) : null,
    input,
    metadata,
    listingHash: createHash('sha256')
      .update(stableStringify({ accepts: item.accepts ?? [], serviceName: item.serviceName, description: item.description, tags: item.tags, extensions: item.extensions }))
      .digest('hex')
      .slice(0, 32),
  };
}

export function isListing(x: Listing | ListingError): x is Listing {
  return !('ok' in x);
}
