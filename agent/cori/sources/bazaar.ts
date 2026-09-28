// CDP Bazaar discovery client: paginates /discovery/resources, validates each
// page, retries transient failures (spec §12). Yields raw items; parsing and
// classification happen in the pipeline.
import { safeFetch, SafeFetchError, type SafeFetchOptions } from '../../../lib/net/safe-fetch';
import { BazaarPageSchema } from '../../../lib/cori/bazaar';
import type { Logger } from '../log';

export type BazaarFetchOptions = {
  url: string;
  pageLimit: number;
  maxPages: number;
  userAgent: string;
  log: Logger;
  fetchOptions?: SafeFetchOptions;       // test seams only
  sleep?: (ms: number) => Promise<void>;
};

export type BazaarPassStats = { pages: number; items: number; truncated: boolean; total: number | null };

const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchPage(url: string, o: BazaarFetchOptions): Promise<unknown> {
  const sleep = o.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await safeFetch(url, {
        timeoutMs: 30_000,
        maxBytes: MAX_PAGE_BYTES,
        headers: { 'user-agent': o.userAgent, accept: 'application/json' },
        ...o.fetchOptions,
      });
      if (res.status === 429 || res.status >= 500) throw new SafeFetchError('SOURCE_HTTP', `HTTP ${res.status}`);
      if (res.status !== 200) throw new SafeFetchError('SOURCE_HTTP_FATAL', `HTTP ${res.status}`);
      return JSON.parse(res.body);
    } catch (err) {
      lastError = err;
      const fatal = err instanceof SafeFetchError && (err.code === 'SOURCE_HTTP_FATAL' || err.code === 'SSRF_BLOCKED' || err.code === 'NON_HTTPS');
      if (fatal || attempt === RETRY_DELAYS_MS.length) break;
      o.log.warn('source_page_retry', { url, attempt: attempt + 1, error: err instanceof Error ? err.message : String(err) });
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

export async function* fetchBazaarItems(o: BazaarFetchOptions, stats: BazaarPassStats): AsyncGenerator<unknown> {
  let offset = 0;
  for (let page = 0; page < o.maxPages; page++) {
    const u = new URL(o.url);
    u.searchParams.set('type', 'http');
    u.searchParams.set('limit', String(o.pageLimit));
    u.searchParams.set('offset', String(offset));

    const parsed = BazaarPageSchema.safeParse(await fetchPage(u.toString(), o));
    if (!parsed.success) throw new Error(`Unexpected Bazaar page shape at offset ${offset}`);

    const { items, pagination } = parsed.data;
    stats.pages++;
    stats.items += items.length;
    stats.total = pagination?.total ?? stats.total;
    for (const item of items) yield item;

    offset += items.length;
    const done = items.length === 0 || items.length < o.pageLimit || (pagination?.total != null && offset >= pagination.total);
    if (done) return;
  }
  stats.truncated = true; // hit maxPages; the rest comes next cycle
}
