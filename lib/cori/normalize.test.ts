import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, groupKey } from './normalize.ts';

test('canonical URL: lowercase host, default port, fragment, trailing slash, tracking params, sorted query', () => {
  assert.equal(canonicalUrl('HTTPS://API.Example.COM:443/Weather/?utm_source=x&b=2&a=1#top'), 'https://api.example.com/Weather?a=1&b=2');
  assert.equal(canonicalUrl('https://api.example.com//v1//quote/'), 'https://api.example.com/v1/quote');
  assert.equal(canonicalUrl('https://api.example.com/'), 'https://api.example.com/', 'root keeps its slash');
  assert.equal(canonicalUrl('https://user:pw@api.example.com/x'), 'https://api.example.com/x', 'credentials dropped');
  assert.equal(canonicalUrl('https://api.example.com:8443/x'), 'https://api.example.com:8443/x', 'non-default port kept');
  assert.equal(canonicalUrl('  https://api.example.com/x?fbclid=1  '), 'https://api.example.com/x');
});

test('path case is preserved (paths are case-sensitive)', () => {
  assert.notEqual(canonicalUrl('https://a.example/Quote'), canonicalUrl('https://a.example/quote'));
});

test('same resource written differently → same canonical URL', () => {
  const forms = [
    'https://x402.bankr.bot/0xABC/research',
    'https://X402.BANKR.BOT/0xABC/research/',
    'https://x402.bankr.bot:443/0xABC/research#section',
    'https://x402.bankr.bot/0xABC//research?utm_campaign=launch',
  ];
  assert.equal(new Set(forms.map(canonicalUrl)).size, 1);
});

test('international hosts are punycoded', () => {
  assert.equal(canonicalUrl('https://bücher.example/api'), 'https://xn--bcher-kva.example/api');
});

test('rejects non-https and garbage', () => {
  for (const bad of ['http://api.example.com/x', 'ftp://a.example', 'not a url', '', null, undefined]) {
    assert.equal(canonicalUrl(bad as string), null, String(bad));
  }
});

test('group key ignores query (related, not merged)', () => {
  assert.equal(groupKey(canonicalUrl('https://a.example/q?s=BTC')!), groupKey(canonicalUrl('https://a.example/q?s=ETH')!));
});
