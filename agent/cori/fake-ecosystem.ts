// Test-only fake x402 ecosystem: a Bazaar discovery endpoint plus x402
// services, on one local HTTPS server (self-signed cert via openssl). Records
// every request so tests can assert what Cori did — and never did.
import { createServer, type Server } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LookupAddress } from 'node:dns';
import type { SafeFetchOptions } from '../../lib/net/safe-fetch';

export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAY_TO = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64');

export type Hit = { host: string; path: string; method: string; headers: Record<string, string | string[] | undefined>; body: string };

export type FakeEcosystem = {
  port: number;
  items: unknown[];                 // mutable: tests can change listings between passes
  hits: Hit[];
  bazaarUrl: string;
  url: (host: string, path: string) => string;
  fetchOptions: SafeFetchOptions;
  close: () => void;
};

const DNS: Record<string, string> = {
  'bazaar.test': '127.0.0.1',
  'svc.test': '127.0.0.1',
  'rebind.test': '10.0.0.9',        // "public" name resolving to a private IP
  // More "companies" on the same fake server (B3 host-spread tests)
  'big.test': '127.0.0.1',
  'a.test': '127.0.0.1',
  'b.test': '127.0.0.1',
  'c.test': '127.0.0.1',
  'd.test': '127.0.0.1',
};

export async function startFakeEcosystem(): Promise<FakeEcosystem> {
  const dir = mkdtempSync(join(tmpdir(), 'cori-eco-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'),
    '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=svc.test'], { stdio: 'ignore' });

  const eco = { items: [] as unknown[], hits: [] as Hit[] } as FakeEcosystem;

  const v2Terms = (path: string, amount = '2000', extra: Record<string, unknown> = {}) => ({
    x402Version: 2,
    resource: { url: eco.url('svc.test', path) },
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount, asset: USDC, payTo: PAY_TO, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2', ...extra } }],
  });

  const server: Server = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const u = new URL(req.url ?? '/', 'https://x');
      const host = String(req.headers.host ?? '').split(':')[0];
      eco.hits.push({ host, path: u.pathname, method: req.method ?? '', headers: req.headers, body });

      if (u.pathname === '/discovery/resources') {
        const limit = Number(u.searchParams.get('limit'));
        const offset = Number(u.searchParams.get('offset'));
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ x402Version: 2, items: eco.items.slice(offset, offset + limit), pagination: { limit, offset, total: eco.items.length } }));
      }

      const name = u.pathname.replace('/svc/', '');
      const json = { 'content-type': 'application/json' };
      if (name.startsWith('users/')) {
        res.writeHead(402, { ...json, 'payment-required': b64(v2Terms(u.pathname)) });
        return res.end('{}');
      }
      switch (name) {
        case 'v2-get':
        case 'v2-get-2':
        case 'post-noex':
          res.writeHead(402, { ...json, 'payment-required': b64(v2Terms(u.pathname)) });
          return res.end('{}');
        case 'v1-post':
          if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
          res.writeHead(402, json);
          return res.end(JSON.stringify({ x402Version: 1, accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '1000', asset: USDC, payTo: PAY_TO, resource: eco.url('svc.test', u.pathname) }] }));
        case 'not402':
          res.writeHead(200, json);
          return res.end('{"free":true}');
        case 'flaky':
          res.writeHead(503);
          return res.end();
        default:
          // Anything else was never supposed to be probed
          res.writeHead(418);
          return res.end();
      }
    });
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  eco.port = (server.address() as { port: number }).port;
  eco.url = (host, path) => `https://${host}:${eco.port}${path}`;
  eco.bazaarUrl = eco.url('bazaar.test', '/discovery/resources');
  eco.fetchOptions = {
    resolver: ((host: string, _o: unknown, cb: (e: Error | null, a: LookupAddress[]) => void) => {
      const ip = DNS[host];
      if (!ip) return cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), []);
      cb(null, [{ address: ip, family: 4 }]);
    }) as never,
    isBlockedAddress: (a) => a.startsWith('10.'),
    rejectUnauthorized: false,
  };
  eco.close = () => { server.close(); rmSync(dir, { recursive: true, force: true }); };
  return eco;
}

// The standard listing set used by the pipeline tests
export function standardListings(eco: FakeEcosystem): unknown[] {
  const svc = (p: string) => eco.url('svc.test', p);
  const v2 = (path: string, amount = '2000', over: Record<string, unknown> = {}, accept: Record<string, unknown> = {}) => ({
    resource: svc(path), type: 'http', x402Version: 2,
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount, asset: USDC, payTo: PAY_TO, ...accept }],
    serviceName: path.replace('/svc/', ''), description: 'Market data for agents, paid per call.', tags: ['data'], ...over,
  });
  return [
    v2('/svc/v2-get'),
    { resource: svc('/svc/v1-post'), type: 'http', x402Version: 1, serviceName: 'v1-post', description: 'Weather forecasts for agents, paid per call.',
      accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '1000', asset: USDC, payTo: PAY_TO, outputSchema: { input: { type: 'http', method: 'POST', body: { q: 'weather' } } } }] },
    v2('/svc/post-noex', '2000', { extensions: { bazaar: { info: { input: { type: 'http', method: 'POST' } } } } }),
    v2('/svc/expensive', '5000000'),
    v2('/svc/othernet', '2000', {}, { network: 'eip155:1' }),
    v2('/svc/permit2', '2000', {}, { extra: { assetTransferMethod: 'permit2' } }),
    v2('/svc/not402'),
    v2('/svc/monitored'),
    v2('/svc/submitted'),
    { ...(v2('/x') as Record<string, unknown>), resource: eco.url('rebind.test', '/x'), serviceName: 'rebind' },
    { ...(v2('/x') as Record<string, unknown>), resource: eco.url('down.test', '/x'), serviceName: 'down' },
    { ...(v2('/svc/v2-get') as Record<string, unknown>), resource: `${svc('/svc/v2-get')}/?utm_source=bazaar` }, // duplicate
    { nope: true },                                                                              // invalid
    { resource: svc('/svc/mcp'), type: 'mcp', accepts: [] },                                     // not http
    v2('/svc/v2-get-2'),
  ];
}
