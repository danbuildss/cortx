// checkedFetch against a real local HTTPS server (self-signed cert). Same test
// seams as safe-fetch.test.ts: a fake resolver, and an address predicate that
// treats 127.0.0.1 (the test server) as public and 10.x / 169.254.x as private.
// The scenario that matters: a "public" x402 service that redirects the
// checker to an internal address must be refused, not followed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LookupAddress } from 'node:dns';
import { checkedFetch, SafeFetchError } from './checked-fetch.ts';

let server: Server;
let port = 0;
let dir = '';
const hits: string[] = [];

const DNS: Record<string, string> = { 'service.test': '127.0.0.1', 'metadata.test': '169.254.169.254', 'internal.test': '10.0.0.7' };
const resolver = ((host: string, _opts: unknown, cb: (e: Error | null, a: LookupAddress[]) => void) => {
  const ip = DNS[host];
  if (!ip) return cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), []);
  cb(null, [{ address: ip, family: 4 }]);
}) as never;
const isBlockedAddress = (a: string) => a.startsWith('10.') || a.startsWith('169.254.');
const seams = { resolver, isBlockedAddress, rejectUnauthorized: false };
const opts = { timeoutMs: 3000, maxBytes: 1024, ...seams };
const url = (host: string, path: string) => `https://${host}:${port}${path}`;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'checkedfetch-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'),
    '-out', join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=service.test'], { stdio: 'ignore' });
  server = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
    req.resume();
    const p = req.url ?? '';
    hits.push(p);
    if (p === '/402') { res.writeHead(402, { 'payment-required': 'eyJ4NDAyVmVyc2lvbiI6Mn0=', 'content-type': 'application/json' }); return res.end('{}'); }
    if (p === '/paid') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
    if (p === '/to-metadata') { res.writeHead(302, { location: url('metadata.test', '/latest/meta-data/') }); return res.end(); }
    if (p === '/to-metadata-ip') { res.writeHead(307, { location: 'https://169.254.169.254/latest/meta-data/' }); return res.end(); }
    if (p === '/to-internal') { res.writeHead(301, { location: url('internal.test', '/admin') }); return res.end(); }
    if (p === '/to-402') { res.writeHead(302, { location: '/402' }); return res.end(); }
    if (p === '/big') { res.writeHead(200); return res.end('x'.repeat(5000)); }
    if (p === '/empty') { res.writeHead(204); return res.end(); }
    res.writeHead(404); res.end();
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

test('returns a standard Response: status, x402 headers, body', async () => {
  const r = await checkedFetch(url('service.test', '/402'), { method: 'POST', body: '{}' }, opts);
  assert.ok(r instanceof Response);
  assert.equal(r.status, 402);
  assert.equal(r.headers.get('payment-required'), 'eyJ4NDAyVmVyc2lvbiI6Mn0=');
  assert.equal(await r.text(), '{}');
});

test('a service redirecting the checker to cloud metadata is refused', async () => {
  assert.equal(await code(checkedFetch(url('service.test', '/to-metadata'), {}, opts)), 'SSRF_BLOCKED');
  assert.equal(await code(checkedFetch(url('service.test', '/to-metadata-ip'), {}, opts)), 'SSRF_BLOCKED');
  assert.equal(await code(checkedFetch(url('service.test', '/to-internal'), {}, opts)), 'SSRF_BLOCKED');
  assert.ok(!hits.some((h) => h.startsWith('/latest') || h === '/admin'), 'never reached the internal target');
});

test('a redirect to a public address is followed', async () => {
  const r = await checkedFetch(url('service.test', '/to-402'), {}, opts);
  assert.equal(r.status, 402);
});

test('maxRedirects 0 turns any redirect into an error (facilitator calls)', async () => {
  assert.equal(await code(checkedFetch(url('service.test', '/to-402'), {}, { ...opts, maxRedirects: 0 })), 'TOO_MANY_REDIRECTS');
});

test('private targets, plain http and oversized bodies are refused', async () => {
  assert.equal(await code(checkedFetch(url('internal.test', '/'), {}, opts)), 'SSRF_BLOCKED');
  assert.equal(await code(checkedFetch(`http://service.test:${port}/402`, {}, opts)), 'NON_HTTPS');
  assert.equal(await code(checkedFetch(url('service.test', '/big'), {}, opts)), 'BODY_TOO_LARGE');
});

test('no-body statuses and HEAD requests produce an empty Response', async () => {
  const empty = await checkedFetch(url('service.test', '/empty'), {}, opts);
  assert.equal(empty.status, 204);
  const head = await checkedFetch(url('service.test', '/paid'), { method: 'HEAD' }, opts);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
