import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNoSecrets, loadConfig } from './config.ts';

const env = (extra: Record<string, string> = {}) => ({ CORI_DATABASE_URL: 'postgres://cori_agent@db/postgres', ...extra }) as unknown as NodeJS.ProcessEnv;

test('defaults: port 443 only, 600 probes/hour, up to 50k Bazaar items', () => {
  const c = loadConfig(env());
  assert.deepEqual(c.allowedPorts, [443]);
  assert.equal(c.maxProbesPerHour, 600);
  assert.equal(c.bazaarMaxPages * c.bazaarPageLimit, 50_000);
  assert.equal(c.version, 'local', 'unbundled runs are marked local');
  assert.equal(loadConfig(env({ CORI_VERSION: 'abc123' })).version, 'abc123');
  assert.deepEqual(loadConfig(env({ CORI_ALLOWED_PORTS: '443, 8443' })).allowedPorts, [443, 8443]);
  assert.throws(() => loadConfig(env({ CORI_ALLOWED_PORTS: '443,nope' })));
});

test('refuses to start next to key material', () => {
  for (const k of ['CORTX_TEST_WALLET_KEY', 'X402_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MNEMONIC']) {
    assert.throws(() => loadConfig(env({ [k]: 'x' })), /Refusing to start/, k);
  }
  assert.doesNotThrow(() => assertNoSecrets(env({ CORTX_TEST_WALLET_KEY: '' })), 'empty is fine');
  assert.doesNotThrow(() => assertNoSecrets(env({ CORI_DATABASE_URL: 'x', PATH: '/usr/bin' })));
});
