// Test stub for lib/check-runner/fetch-endpoint.ts: same API, but a plain
// fetch() so tests can run the real check runners against a local http fake
// service. The real connect-time address checks are tested on their own in
// lib/net/checked-fetch.test.ts. StageError comes from the ssrf stub, which is
// the module the runners get in tests.
import { StageError } from './ssrf';

export const RESPONSE_BODY_MAX_BYTES = 1_048_576;

export type CheckedFetchInit = {
  method?: 'GET' | 'HEAD' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

export async function fetchEndpoint(url: string, init: CheckedFetchInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new StageError('TIMEOUT', `Request timed out after ${timeoutMs}ms`);
    throw new StageError('UNREACHABLE', `Network error: ${err}`);
  } finally {
    clearTimeout(timer);
  }
}
