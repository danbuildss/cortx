// Every request the check runners make to a service endpoint or a published
// facilitator goes through here: address checked at connect time and on each
// redirect (lib/net/checked-fetch.ts), body capped, errors as StageError codes.
import { checkedFetch, SafeFetchError, type CheckedFetchInit } from '../net/checked-fetch';
import { StageError } from './ssrf';

export type { CheckedFetchInit };

export const RESPONSE_BODY_MAX_BYTES = 1_048_576; // 1 MB cap on any remote response body

const CODES: Record<string, string> = { BODY_TOO_LARGE: 'RESPONSE_TOO_LARGE' };

export async function fetchEndpoint(
  url: string,
  init: CheckedFetchInit,
  timeoutMs: number,
  opts: { maxRedirects?: number } = {},
): Promise<Response> {
  try {
    return await checkedFetch(url, init, { timeoutMs, maxBytes: RESPONSE_BODY_MAX_BYTES, maxRedirects: opts.maxRedirects });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      throw new StageError(CODES[err.code] ?? err.code, err.code === 'TIMEOUT' ? `Request timed out after ${timeoutMs}ms` : err.message);
    }
    throw new StageError('UNREACHABLE', `Network error: ${err}`);
  }
}
