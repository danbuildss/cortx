import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIP } from './ip.ts';

test('public unicast addresses are allowed', () => {
  for (const a of ['8.8.8.8', '1.1.1.1', '104.16.0.1', '2001:4860:4860::8888', '2606:4700::1111']) {
    assert.equal(isPrivateIP(a), false, a);
  }
});

test('everything else is refused (allow-list)', () => {
  for (const a of [
    '10.0.0.1', '172.16.5.4', '192.168.1.1', '127.0.0.1', '0.0.0.0', '169.254.169.254', // cloud metadata
    '100.64.0.1', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:169.254.169.254',                     // IPv4-mapped IPv6
    '2002:0a00:0001::1',                                                                  // 6to4 wrapping 10.0.0.1
    'not-an-ip',
  ]) {
    assert.equal(isPrivateIP(a), true, a);
  }
});

test('IPv4-mapped public address is allowed', () => {
  assert.equal(isPrivateIP('::ffff:8.8.8.8'), false);
});
