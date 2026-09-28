// Conformance with the x402 Reliability Spec (v0.3): every vendored test
// vector (test/spec-vectors/) is served by a local mock, run through the real
// runFullCheck, converted with toSpecRecord, validated against the spec's JSON
// Schema, and compared with the vector's expected.json using the spec's
// comparison rules. Same test hooks as runner.e2e.test.ts: the SSRF guard
// allows localhost, and the wallet balance comes from TEST_USDC_BALANCE_ATOMIC.
// The wallet is a random, never-funded key.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const key = generatePrivateKey();
process.env.CORTX_TEST_WALLET_KEY = key;
const WALLET = privateKeyToAccount(key).address;

const { runFullCheck } = await import('./runner.ts');
const { toSpecRecord } = await import('./spec-record.ts');

const DIR = new URL('../../test/spec-vectors/', import.meta.url);
const readJson = (rel: string) => JSON.parse(readFileSync(new URL(rel, DIR), 'utf8'));

type Answer = { status: number; headers: Record<string, unknown>; body: unknown };
type Vector = {
  description: string;
  checker: { max_price_usdc: number; schema: Record<string, unknown> | null; wallet_balance_usdc: number };
  unpaid: Answer;
  paid: Answer | null;
};

const NAMES = readdirSync(DIR).filter((n) => !n.startsWith('_') && statSync(new URL(n, DIR)).isDirectory());
const vectors = Object.fromEntries(NAMES.map((n) => [n, readJson(`${n}/vector.json`) as Vector]));
const paidRequests: Record<string, number> = {};

let server: Server;
let base: string;

// vector.json encoding: object header values → base64 JSON; object bodies → JSON text
function fill(v: unknown, endpoint: string): unknown {
  return JSON.parse(JSON.stringify(v).replaceAll('{{ENDPOINT}}', endpoint).replaceAll('{{CHECKER_WALLET}}', WALLET));
}
function send(res: import('node:http').ServerResponse, answer: Answer, endpoint: string) {
  const a = fill(answer, endpoint) as Answer;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.headers)) {
    headers[k] = typeof v === 'string' ? v : Buffer.from(JSON.stringify(v)).toString('base64');
  }
  res.writeHead(a.status, headers);
  res.end(typeof a.body === 'string' ? a.body : JSON.stringify(a.body));
}

before(async () => {
  server = createServer((req, res) => {
    const name = (req.url ?? '').slice(1);
    const vector = vectors[name];
    req.resume();
    if (!vector) { res.writeHead(404); return res.end(); }
    const endpoint = `${base}/${name}`;
    const paying = req.headers['payment-signature'] || req.headers['x-payment'];
    if (!paying) return send(res, vector.unpaid, endpoint);
    paidRequests[name] = (paidRequests[name] ?? 0) + 1;
    if (!vector.paid) { res.writeHead(500); return res.end('vector says the checker must not pay'); }
    return send(res, vector.paid, endpoint);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

after(() => server.close());

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(readJson('_schema/check-result.json'));
const validateRecord = ajv.compile(readJson('_schema/evidence-record.json'));

// Spec comparison rules (test-vectors/README.md): a missing field equals null
const n = (v: unknown) => (v === undefined ? null : v);
function compare(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  for (const f of ['outcome', 'overall_passed', 'highest_stage_passed', 'x402_version']) {
    assert.deepEqual(n(actual[f]), n(expected[f]), `record.${f}`);
  }
  const aStages = actual.stages as Record<string, unknown>[];
  const eStages = expected.stages as Record<string, unknown>[];
  assert.equal(aStages.length, eStages.length, 'stage count');
  eStages.forEach((e, i) => {
    const a = aStages[i];
    for (const f of ['stage', 'name', 'passed', 'error_code', 'fault']) {
      assert.deepEqual(n(a[f]), n(e[f]), `stage ${e.stage}.${f} (actual: ${JSON.stringify(a)})`);
    }
    if (e.stage === 5) {
      for (const f of ['settlement_status', 'tx_hash']) {
        if (f in e) assert.deepEqual(n(a[f]), n(e[f]), `stage 5.${f}`);
      }
    }
  });
}

test('the vendored spec ships vectors', () => {
  assert.ok(NAMES.length >= 8, `found ${NAMES.length}`);
});

for (const name of NAMES) {
  test(`spec vector ${name}: ${vectors[name].description}`, async () => {
    const vector = vectors[name];
    process.env.TEST_USDC_BALANCE_ATOMIC = String(Math.round(vector.checker.wallet_balance_usdc * 1e6));
    const endpoint = `${base}/${name}`;
    const result = await runFullCheck({
      id: name,
      user_id: 'spec',
      endpoint_url: endpoint,
      test_input: {},
      expected_schema: vector.checker.schema,
      expected_price: null,
      max_price: String(vector.checker.max_price_usdc),
      latency_threshold_ms: null,
      environment: 'mainnet',
    });
    const record = toSpecRecord(result, { endpoint, inputSource: 'none' });

    assert.ok(validateRecord(record), `schema: ${JSON.stringify(validateRecord.errors)}`);
    compare(record as unknown as Record<string, unknown>, readJson(`${name}/expected.json`));
    if (!vector.paid) assert.equal(paidRequests[name] ?? 0, 0, 'the checker must not pay');
  });
}
