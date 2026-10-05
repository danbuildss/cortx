import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckContext, runnerVersion } from './context.ts';
import { isMissingColumn } from './persist.ts';

test('context records what was checked, with the input only as a hash', () => {
  const c = buildCheckContext({
    endpoint_url: 'https://x.example/a', method: 'POST', environment: 'mainnet',
    test_input: { query: 'my-secret-ish-value', n: 1 }, expected_schema: { type: 'object' },
    max_price: '0.10', expected_price: null,
  });
  assert.equal(c.endpoint_url, 'https://x.example/a');
  assert.equal(c.method, 'POST');
  assert.equal(c.input_source, 'owner_provided');
  assert.match(c.input_hash!, /^[0-9a-f]{64}$/);
  assert.ok(c.input_bytes > 0);
  assert.doesNotMatch(JSON.stringify(c), /my-secret-ish-value/, 'raw input never stored');
  assert.match(c.schema_hash!, /^[0-9a-f]{64}$/);
  assert.equal(c.max_price, '0.10');
  assert.equal(c.expected_price, null);
});

test('same input in a different key order hashes the same; a change hashes differently', () => {
  const a = buildCheckContext({ endpoint_url: 'u', test_input: { a: 1, b: 2 } });
  const b = buildCheckContext({ endpoint_url: 'u', test_input: { b: 2, a: 1 } });
  const c = buildCheckContext({ endpoint_url: 'u', test_input: { a: 1, b: 3 } });
  assert.equal(a.input_hash, b.input_hash);
  assert.notEqual(a.input_hash, c.input_hash);
});

test('no input: source none, no hash', () => {
  const c = buildCheckContext({ endpoint_url: 'u', test_input: {} });
  assert.equal(c.input_source, 'none');
  assert.equal(c.input_hash, null);
  assert.equal(c.input_bytes, 0);
  assert.equal(c.method, null);
});

test('runner version is the deployed commit, or "local"', () => {
  const saved = process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890abcdef';
  assert.equal(runnerVersion(), 'abcdef123456');
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  assert.equal(runnerVersion(), 'local');
  if (saved) process.env.VERCEL_GIT_COMMIT_SHA = saved;
});

test('a missing provenance column (before migration 026) is recognised, other errors are not', () => {
  assert.equal(isMissingColumn({ code: 'PGRST204', message: "Could not find the 'context' column of 'checks' in the schema cache" }), true);
  assert.equal(isMissingColumn({ code: '42703', message: 'column "runner_version" of relation "checks" does not exist' }), true);
  assert.equal(isMissingColumn({ code: '23505', message: 'duplicate key value' }), false);
  assert.equal(isMissingColumn(null), false);
});
