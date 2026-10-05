// Runs a real local HTTPS server (self-signed cert generated with openssl).
// Test seams: a fake DNS resolver and an address predicate that treats
// 127.0.0.1 as "public" (the test server) and 10.x as private.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LookupAddress } from 'node:dns';
import { safeFetch, SafeFetchError } from './safe-fetch.ts';

let server: Server;
let port = 0;
let dir = '';
const hits: Array<{ path: string; method: string; body: string }> = [];

const DNS: Record<string, string> = { 'good.test': '127.0.0.1', 'rebind.test': '10.0.0.7' };
const resolver = ((host: string, _opts: unknown, cb: (e: Error | null, a: LookupAddress[]) => void) => {
  const ip = DNS[host];
  if (!ip) return cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), []);
  cb(null, [{ address: ip, family: 4 }]);
}) as never;
const isBlockedAddress = (a: string) => a.startsWith('10.') || a === '169.254.169.254';
const opts = { resolver, isBlockedAddress, rejectUnauthorized: false };
const url = (host: string, path: string) => `https://${host}:${port}${path}`;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'safefetch-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'),
    '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=good.test'], { stdio: 'ignore' });
  server = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      hits.push({ path: req.url ?? '', method: req.method ?? '', body });
      const p = req.url ?? '';
      if (p === '/402') { res.writeHead(402, { 'payment-required': 'abc', 'content-type': 'application/json' }); return res.end('{"accepts":[]}'); }
      if (p === '/to-private') { res.writeHead(302, { location: url('rebind.test', '/402') }); return res.end(); }
      if (p === '/to-http') { res.writeHead(302, { location: 'http://good.test/402' }); return res.end(); }
      if (p === '/to-other-port') { res.writeHead(302, { location: 'https://good.test:8443/402' }); return res.end(); }
      if (p === '/loop') { res.writeHead(302, { location: '/loop' }); return res.end(); }
      if (p === '/post-redirect') { res.writeHead(307, { location: '/402' }); return res.end(); }
      if (p === '/big') { res.writeHead(200); return res.end('x'.repeat(200_000)); }
      if (p === '/slow') { setTimeout(() => { res.writeHead(200); res.end('late'); }, 1500); return; }
      res.writeHead(404); res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as { port: number }).port;
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const code = async (p: Promise<unknown>) => {
  try { await p; return 'OK'; } catch (e) { return e instanceof SafeFetchError ? e.code : `OTHER:${(e as Error).message}`; }
};

test('fetches a public https URL: status, headers, body', async () => {
  const r = await safeFetch(url('good.test', '/402'), opts);
  assert.equal(r.status, 402);
  assert.equal(r.headers.get('payment-required'), 'abc');
  assert.equal(r.body, '{"accepts":[]}');
  assert.equal(r.redirects, 0);
});

test('DNS rebinding: hostname resolving to a private IP is refused at connect time', async () => {
  const before = hits.length;
  assert.equal(await code(safeFetch(url('rebind.test', '/402'), opts)), 'SSRF_BLOCKED');
  assert.equal(hits.length, before, 'no request reached any server');
});

test('private IP literals are refused (default rules, no DNS involved)', async () => {
  for (const u of ['https://10.1.2.3/', 'https://127.0.0.1/', 'https://[::ffff:127.0.0.1]/', 'https://169.254.169.254/latest/meta-data']) {
    assert.equal(await code(safeFetch(u)), 'SSRF_BLOCKED', u);
  }
});

test('only https, no credentials, no blocked ports', async () => {
  assert.equal(await code(safeFetch('http://good.test/402', opts)), 'NON_HTTPS');
  assert.equal(await code(safeFetch('https://u:p@good.test/402', opts)), 'CREDENTIALS_IN_URL');
  assert.equal(await code(safeFetch('https://good.test:22/', opts)), 'BLOCKED_PORT');
  assert.equal(await code(safeFetch('not a url', opts)), 'INVALID_URL');
});

test('redirects are re-validated: to a private host or to http is refused', async () => {
  assert.equal(await code(safeFetch(url('good.test', '/to-private'), opts)), 'SSRF_BLOCKED');
  assert.equal(await code(safeFetch(url('good.test', '/to-http'), opts)), 'NON_HTTPS');
});

test('redirect limit', async () => {
  assert.equal(await code(safeFetch(url('good.test', '/loop'), opts)), 'TOO_MANY_REDIRECTS');
});

test('a POST body is never replayed to a redirect target', async () => {
  const r = await safeFetch(url('good.test', '/post-redirect'), { ...opts, method: 'POST', body: '{"secret":1}' });
  assert.equal(r.status, 402);
  const last = hits[hits.length - 1];
  assert.equal(last.method, 'GET');
  assert.equal(last.body, '');
});

test('body cap and timeout', async () => {
  assert.equal(await code(safeFetch(url('good.test', '/big'), { ...opts, maxBytes: 1024 })), 'BODY_TOO_LARGE');
  assert.equal(await code(safeFetch(url('good.test', '/slow'), { ...opts, timeoutMs: 200 })), 'TIMEOUT');
});

test('unknown host → UNREACHABLE', async () => {
  assert.equal(await code(safeFetch(url('nowhere.test', '/'), opts)), 'UNREACHABLE');
});

test('allowedPorts: only listed ports, on every redirect hop', async () => {
  const before = hits.length;
  assert.equal(await code(safeFetch('https://good.test:8443/402', { ...opts, allowedPorts: [443, port] })), 'BLOCKED_PORT');
  assert.equal(hits.length, before, 'refused before connecting');
  assert.equal(await code(safeFetch(url('good.test', '/402'), { ...opts, allowedPorts: [443] })), 'BLOCKED_PORT');
  assert.equal(await code(safeFetch(url('good.test', '/402'), { ...opts, allowedPorts: [443, port] })), 'OK');
  assert.equal(await code(safeFetch(url('good.test', '/to-other-port'), { ...opts, allowedPorts: [443, port] })), 'BLOCKED_PORT');
});
