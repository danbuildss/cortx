/**
 * SSRF-safe HTTP client for fetching third-party URLs (Cori Scout probes and
 * discovery sources).
 *
 * Stronger than validateAndResolveUrl() + fetch(): the address check runs at
 * CONNECT time via the socket's DNS lookup, so a hostname that resolves to a
 * public IP during validation and a private one during the request (DNS
 * rebinding) is still refused. Redirects are never followed automatically;
 * each hop is re-validated. Bodies and time are capped.
 */
import { request as httpsRequest } from 'node:https';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { BLOCKED_PORTS, isPrivateIP } from './ip';

export class SafeFetchError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'SafeFetchError';
  }
}

export type SafeFetchOptions = {
  method?: 'GET' | 'HEAD' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;       // whole request incl. redirects (default 10s)
  maxBytes?: number;        // response body cap (default 64 KB)
  maxRedirects?: number;    // default 2
  // Test seams — production code never sets these
  resolver?: typeof dnsLookup;
  isBlockedAddress?: (address: string) => boolean;
  rejectUnauthorized?: boolean;
};

export type SafeFetchResponse = {
  status: number;
  headers: Headers;
  body: string;
  finalUrl: string;
  redirects: number;
  durationMs: number;
};

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

function assertSafeUrl(raw: string, isBlocked: (a: string) => boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('INVALID_URL', `Cannot parse URL: ${raw}`);
  }
  if (url.protocol !== 'https:') throw new SafeFetchError('NON_HTTPS', `Only https is allowed (${url.protocol})`);
  if (url.username || url.password) throw new SafeFetchError('CREDENTIALS_IN_URL', 'URLs with credentials are refused');
  const port = url.port ? Number(url.port) : 443;
  if (BLOCKED_PORTS.has(port)) throw new SafeFetchError('BLOCKED_PORT', `Port ${port} is blocked`);
  // IP literals skip DNS lookup entirely, so check them here
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isBlocked(host)) throw new SafeFetchError('SSRF_BLOCKED', `Address ${host} is not public`);
  return url;
}

function guardedLookup(resolver: typeof dnsLookup, isBlocked: (a: string) => boolean) {
  return (hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback): void => {
    resolver(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, [] as LookupAddress[]);
      const list = addresses as LookupAddress[];
      if (list.length === 0) return callback(new SafeFetchError('UNREACHABLE', `No DNS records for ${hostname}`) as NodeJS.ErrnoException, []);
      const bad = list.find((a) => isBlocked(a.address));
      if (bad) {
        return callback(new SafeFetchError('SSRF_BLOCKED', `${hostname} resolves to non-public ${bad.address}`) as NodeJS.ErrnoException, []);
      }
      if (options.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}

function once(
  url: URL,
  opts: Required<Pick<SafeFetchOptions, 'method' | 'maxBytes'>> & SafeFetchOptions,
  signal: AbortSignal,
  isBlocked: (a: string) => boolean
): Promise<{ status: number; headers: Headers; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: opts.method,
      headers: {
        ...(opts.body != null ? { 'content-length': String(Buffer.byteLength(opts.body)) } : {}),
        ...opts.headers,
      },
      lookup: guardedLookup(opts.resolver ?? dnsLookup, isBlocked) as never,
      signal,
      rejectUnauthorized: opts.rejectUnauthorized ?? true,
    }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > opts.maxBytes) {
          res.destroy();
          reject(new SafeFetchError('BODY_TOO_LARGE', `Response exceeded ${opts.maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v == null) continue;
          for (const value of Array.isArray(v) ? v : [v]) headers.append(k, value);
        }
        resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString('utf8') });
      });
      res.on('error', reject);
    });
    req.on('error', (err: Error & { code?: string; name: string }) => {
      if (err instanceof SafeFetchError) return reject(err);
      if (err.name === 'AbortError') return reject(new SafeFetchError('TIMEOUT', 'Request timed out'));
      reject(new SafeFetchError('UNREACHABLE', err.message));
    });
    if (opts.body != null) req.write(opts.body);
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const isBlocked = options.isBlockedAddress ?? isPrivateIP;
  const opts = {
    ...options,
    method: options.method ?? 'GET',
    maxBytes: options.maxBytes ?? 64 * 1024,
  };
  const maxRedirects = options.maxRedirects ?? 2;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  const started = Date.now();

  try {
    let url = assertSafeUrl(rawUrl, isBlocked);
    let hopOpts = opts;
    for (let redirects = 0; ; redirects++) {
      const res = await once(url, hopOpts, controller.signal, isBlocked);
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        if (redirects >= maxRedirects) throw new SafeFetchError('TOO_MANY_REDIRECTS', `More than ${maxRedirects} redirects`);
        // Each hop is re-validated (https only, public address, allowed port)
        url = assertSafeUrl(new URL(location, url).toString(), isBlocked);
        // Never replay a body to a redirect target
        hopOpts = { ...opts, method: 'GET', body: undefined };
        continue;
      }
      return { ...res, finalUrl: url.toString(), redirects, durationMs: Date.now() - started };
    }
  } finally {
    clearTimeout(timer);
  }
}
