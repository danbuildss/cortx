// End-to-end tests for the paid check runner: the real runFullCheck against a
// local fake x402 service (V1 and V2). Guards the stage names (a stray extra
// stage step shifted them all by one from Aug 15 to Sep 28, 2026) and the
// settlement proof. Test-only hooks in test/ stub the SSRF guard (to allow
// localhost) and the wallet balance read (no RPC). The wallet is a random,
// never-funded key.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { verifyTypedData } from 'viem';
import type { CheckResult, PaymentGate, StageName } from './types.ts';

const key = generatePrivateKey();
process.env.CORTX_TEST_WALLET_KEY = key;
const WALLET = privateKeyToAccount(key).address;

const { runFullCheck } = await import('./runner.ts');

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAY_TO = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const TX = '0x' + 'cd'.repeat(32);
const CANONICAL: StageName[] = ['availability', 'payment_terms', 'price_check', 'payment', 'delivery', 'json_parse', 'schema_validation'];
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64');
const unb64 = (v: string) => JSON.parse(Buffer.from(v, 'base64').toString('utf8'));

type Scenario = {
  version: 1 | 2;
  price?: string;
  deliveryStatus?: number;
  body?: string;
  receipt?: boolean;
};

const SCENARIOS: Record<string, Scenario> = {
  'v1-ok':        { version: 1 },
  'v2-ok':        { version: 2 },
  'no-receipt':   { version: 1, receipt: false },
  'not-delivered': { version: 2, deliveryStatus: 500, body: '{"error":"upstream down"}' },
  'schema-fail':  { version: 1, body: '{"wrong":true}' },
  'bad-json':     { version: 2, body: 'not json' },
  'too-expensive': { version: 2, price: '5000000' },
  // Payment gate (free /report): same service, different gate decisions
  'gate-no':      { version: 2 },
  'gate-yes':     { version: 2 },
  'gate-throws':  { version: 2 },
  'gate-pricey':  { version: 2, price: '5000000' },
};

const received: Record<string, { header: string; payload: Record<string, unknown> }> = {};
let server: Server;
let base: string;

function termsFor(name: string, s: Scenario) {
  const resource = `${base}/${name}`;
  const amount = s.price ?? '1000';
  return s.version === 2
    ? { x402Version: 2, resource: { url: resource }, accepts: [{ scheme: 'exact', network: 'eip155:8453', amount, asset: USDC, payTo: PAY_TO, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } }] }
    : { x402Version: 1, accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: amount, asset: USDC, payTo: PAY_TO, resource, maxTimeoutSeconds: 60 }] };
}

before(async () => {
  server = createServer((req, res) => {
    const name = (req.url ?? '').slice(1);
    const s = SCENARIOS[name];
    const v2Payment = req.headers['payment-signature'];
    const v1Payment = req.headers['x-payment'];
    req.resume();

    if (!v2Payment && !v1Payment) {
      const terms = termsFor(name, s);
      if (s.version === 2) {
        res.writeHead(402, { 'payment-required': b64(terms), 'content-type': 'application/json' });
        return res.end('{}');
      }
      res.writeHead(402, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(terms));
    }

    const header = (v2Payment ?? v1Payment) as string;
    received[name] = { header: v2Payment ? 'PAYMENT-SIGNATURE' : 'X-PAYMENT', payload: unb64(header) };
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (s.receipt !== false) {
      headers[s.version === 2 ? 'payment-response' : 'x-payment-response'] =
        b64({ success: true, transaction: TX, network: s.version === 2 ? 'eip155:8453' : 'base', payer: WALLET });
    }
    res.writeHead(s.deliveryStatus ?? 200, headers);
    res.end(s.body ?? '{"price":123.45}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

after(() => server.close());

function run(name: string, payment_gate?: PaymentGate): Promise<CheckResult> {
  return runFullCheck({
    payment_gate,
    id: name,
    user_id: 'test',
    endpoint_url: `${base}/${name}`,
    test_input: {},
    expected_schema: { type: 'object', required: ['price'], properties: { price: { type: 'number' } } },
    expected_price: null,
    max_price: '0.10',
    latency_threshold_ms: null,
    environment: 'mainnet',
  });
}

const stage = (r: CheckResult, n: StageName) => r.stages.find((s) => s.stage === n)!;

function assertCanonicalStages(r: CheckResult) {
  assert.deepEqual(r.stages.map((s) => s.stage), CANONICAL, 'exactly the 7 stages, in order, correctly named');
}

test('V1 service: passes, every stage named correctly, settlement confirmed', async () => {
  const r = await run('v1-ok');
  assert.equal(r.status, 'passed', JSON.stringify(r.stages));
  assertCanonicalStages(r);
  assert.equal(r.failure_stage, null);
  assert.equal(stage(r, 'price_check').evidence?.parsed_price, '0.001000');
  assert.equal(stage(r, 'price_check').evidence?.result, 'accepted', 'parse + compare evidence in one stage');
  assert.equal(stage(r, 'payment').evidence?.signed, true);
  assert.equal(stage(r, 'payment').evidence?.payment_header, 'X-PAYMENT');
  const settlement = stage(r, 'delivery').evidence?.settlement as Record<string, unknown>;
  assert.equal(settlement.status, 'confirmed');
  assert.equal(settlement.explorer_url, `https://basescan.org/tx/${TX}`);
  assert.equal(stage(r, 'schema_validation').passed, true);
  assert.equal(received['v1-ok'].header, 'X-PAYMENT');
  assert.equal(received['v1-ok'].payload.x402Version, 1);
});

test('every check records what it ran against (DATA COMPOUNDS)', async () => {
  const r = await run('v1-ok');
  assert.equal(stage(r, 'availability').evidence?.probe_method, 'POST');
  assert.equal(r.context?.endpoint_url, `${base}/v1-ok`);
  assert.equal(r.context?.method, 'POST');
  assert.equal(r.context?.input_source, 'none');
  assert.equal(r.context?.max_price, '0.10');
  assert.match(r.context?.schema_hash ?? '', /^[0-9a-f]{64}$/);
});

test('V2 service: pays with PAYMENT-SIGNATURE, valid EIP-3009 signature, settlement confirmed', async () => {
  const r = await run('v2-ok');
  assert.equal(r.status, 'passed', JSON.stringify(r.stages));
  assertCanonicalStages(r);
  assert.equal(stage(r, 'payment').evidence?.payment_header, 'PAYMENT-SIGNATURE');
  assert.equal((stage(r, 'delivery').evidence?.settlement as Record<string, unknown>).status, 'confirmed');

  const { header, payload } = received['v2-ok'];
  assert.equal(header, 'PAYMENT-SIGNATURE');
  assert.equal(payload.x402Version, 2);
  const inner = payload.payload as { signature: `0x${string}`; authorization: Record<string, string> };
  const a = inner.authorization;
  assert.equal(a.value, '1000');
  const valid = await verifyTypedData({
    address: WALLET,
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC },
    types: { TransferWithAuthorization: [
      { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }] },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: a.from as `0x${string}`, to: a.to as `0x${string}`, value: BigInt(a.value),
      validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce as `0x${string}`,
    },
    signature: inner.signature,
  });
  assert.equal(valid, true);
});

test('no receipt from the service: still passes, settlement unconfirmed', async () => {
  const r = await run('no-receipt');
  assert.equal(r.status, 'passed');
  assertCanonicalStages(r);
  assert.equal((stage(r, 'delivery').evidence?.settlement as Record<string, unknown>).status, 'unconfirmed');
});

test('paid but not delivered: fails at delivery with settlement proof', async () => {
  const r = await run('not-delivered');
  assert.equal(r.status, 'failed');
  assertCanonicalStages(r);
  assert.equal(r.failure_stage, 'delivery');
  assert.equal(stage(r, 'payment').passed, true);
  assert.equal(stage(r, 'delivery').passed, false);
  assert.equal((stage(r, 'delivery').evidence?.settlement as Record<string, unknown>).status, 'confirmed');
  assert.equal(stage(r, 'json_parse').passed, null);
  assert.equal(stage(r, 'schema_validation').passed, null);
});

test('wrong data shape: fails at schema_validation', async () => {
  const r = await run('schema-fail');
  assert.equal(r.status, 'failed');
  assertCanonicalStages(r);
  assert.equal(r.failure_stage, 'schema_validation');
  assert.equal(stage(r, 'json_parse').passed, true);
});

test('non-JSON response: fails at json_parse', async () => {
  const r = await run('bad-json');
  assert.equal(r.status, 'failed');
  assertCanonicalStages(r);
  assert.equal(r.failure_stage, 'json_parse');
  assert.equal(stage(r, 'delivery').passed, true);
});

test('price above max: fails at price_check and never pays', async () => {
  const r = await run('too-expensive');
  assert.equal(r.status, 'failed');
  assertCanonicalStages(r);
  assert.equal(r.failure_stage, 'price_check');
  assert.equal(stage(r, 'price_check').error, 'PRICE_EXCEEDS_MAXIMUM');
  assert.equal(stage(r, 'payment').passed, null);
  assert.equal(received['too-expensive'], undefined, 'no payment was sent');
});

// ── Payment gate (used by the free /report) ─────────────────────────────────

test('gate says no: free stages pass, nothing is paid, the reason is reported', async () => {
  const seen: number[] = [];
  const r = await run('gate-no', async (price) => { seen.push(price); return { pay: false, reason: 'report_budget_used', message: 'Budget used up.' }; });
  assert.deepEqual(seen, [0.001], 'the gate sees the parsed price');
  assert.equal(r.status, 'passed', 'the service did nothing wrong');
  assertCanonicalStages(r);
  assert.equal(r.failure_stage, null);
  assert.deepEqual(r.paid_skipped, { reason: 'report_budget_used', message: 'Budget used up.' });
  assert.equal(stage(r, 'price_check').passed, true);
  assert.equal(stage(r, 'payment').passed, null);
  assert.equal(stage(r, 'payment').evidence?.skipped, true);
  assert.equal(stage(r, 'delivery').passed, null);
  assert.equal(received['gate-no'], undefined, 'no payment was sent');
});

test('gate says yes: the check pays and completes as usual', async () => {
  const r = await run('gate-yes', async () => ({ pay: true }));
  assert.equal(r.status, 'passed', JSON.stringify(r.stages));
  assertCanonicalStages(r);
  assert.equal(r.paid_skipped, undefined);
  assert.equal(received['gate-yes'].header, 'PAYMENT-SIGNATURE');
});

test('gate crashes: fails closed, nothing is paid', async () => {
  const r = await run('gate-throws', async () => { throw new Error('db down'); });
  assert.equal(r.status, 'passed');
  assert.equal(r.paid_skipped?.reason, 'budget_unavailable');
  assert.equal(received['gate-throws'], undefined, 'no payment was sent');
});

test('with a gate, a price above the max is the gate\'s call, not a service failure', async () => {
  const r = await run('gate-pricey', async (price) => (price > 0.01
    ? { pay: false, reason: 'price_above_report_limit', message: 'Too expensive for the free report.' }
    : { pay: true }));
  assert.equal(r.status, 'passed');
  assert.equal(stage(r, 'price_check').passed, true);
  assert.equal(r.paid_skipped?.reason, 'price_above_report_limit');
  assert.equal(received['gate-pricey'], undefined, 'no payment was sent');
});
