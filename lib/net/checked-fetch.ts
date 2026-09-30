/**
 * fetch() for URLs that users or third parties supply (service endpoints,
 * published facilitators). Built on safeFetch, so every connection — the
 * first one and every redirect hop — is checked at connect time: https only,
 * public addresses only, allowed ports only, bodies capped. Returns a
 * standard Response so callers keep their existing reading code.
 *
 * Plain fetch() + validateAndResolveUrl() is not enough: fetch follows
 * redirects without re-checking them, and DNS can change between the check
 * and the connection.
 */
import { safeFetch, SafeFetchError, type SafeFetchOptions } from './safe-fetch';

export { SafeFetchError };

export type CheckedFetchInit = {
  method?: 'GET' | 'HEAD' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

export type CheckedFetchOptions = {
  timeoutMs: number;
  maxBytes: number;
  /** Redirect hops allowed, each re-validated. 0 = any redirect is an error. */
  maxRedirects?: number;
} & Pick<SafeFetchOptions, 'resolver' | 'isBlockedAddress' | 'rejectUnauthorized'>; // test seams

// Statuses a Response may not carry a body with
const NULL_BODY = new Set([101, 103, 204, 205, 304]);

export async function checkedFetch(url: string, init: CheckedFetchInit, opts: CheckedFetchOptions): Promise<Response> {
  const res = await safeFetch(url, {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body,
    timeoutMs: opts.timeoutMs,
    maxBytes: opts.maxBytes,
    maxRedirects: opts.maxRedirects ?? 2,
    resolver: opts.resolver,
    isBlockedAddress: opts.isBlockedAddress,
    rejectUnauthorized: opts.rejectUnauthorized,
  });
  if (res.status < 200 || res.status > 599) {
    throw new SafeFetchError('UNEXPECTED_STATUS', `Unusable HTTP status ${res.status}`);
  }
  return new Response(NULL_BODY.has(res.status) || init.method === 'HEAD' ? null : res.body, {
    status: res.status,
    headers: res.headers,
  });
}
