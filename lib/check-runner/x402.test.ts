import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildV2PaymentHeader,
  decodeHeaderJson,
  explorerTxUrl,
  parsePaymentRequired,
  priceToUsdc,
  readSettlement,
} from './x402.ts';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAY_TO = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const TX = '0x' + 'ab'.repeat(32);

const headers = (h: Record<string, string> = {}) => new Headers(h);
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64');

test('V1: terms in the 402 body', () => {
  const body = JSON.stringify({
    x402Version: 1,
    accepts: [{ scheme: 'exact', network: 'base', maxAmountRequired: '1000', asset: USDC, payTo: PAY_TO }],
  });
  const p = parsePaymentRequired(body, headers())!;
  assert.equal(p.version, 1);
  assert.equal(p.source, 'body');
  assert.equal(p.options[0].amount, '1000');
  assert.equal(p.options[0].amountField, 'maxAmountRequired');
  assert.equal(p.options[0].payTo, PAY_TO);
});

test('V2: base64 PAYMENT-REQUIRED header with `amount` and CAIP-2 network', () => {
  const required = {
    x402Version: 2,
    resource: { url: 'https://api.example.com/data', mimeType: 'application/json' },
    accepts: [{
      scheme: 'exact', network: 'eip155:8453', amount: '10000', asset: USDC, payTo: PAY_TO,
      maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' },
    }],
  };
  const p = parsePaymentRequired('', headers({ 'PAYMENT-REQUIRED': b64(required) }))!;
  assert.equal(p.version, 2);
  assert.equal(p.source, 'payment-required');
  assert.deepEqual(p.resource, required.resource);
  assert.equal(p.options[0].network, 'eip155:8453');
  assert.equal(p.options[0].amountField, 'amount');
  assert.equal(p.options[0].maxTimeoutSeconds, 60);
  assert.deepEqual(p.options[0].raw, required.accepts[0], 'raw option kept exactly for `accepted`');
});

test('V2 terms in the body (Exa-style `amount`) are read', () => {
  const body = JSON.stringify({
    x402Version: 2,
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '5000', asset: USDC, payTo: PAY_TO }],
  });
  const p = parsePaymentRequired(body, headers())!;
  assert.equal(p.version, 2);
  assert.equal(priceToUsdc(p.options[0])!.usdc, 0.005);
});

test('Bankr flat format in X-PAYMENT-REQUIRED, recipient → payTo', () => {
  const flat = { network: 'base', maxAmountRequired: '0.01', asset: 'USDC', recipient: PAY_TO };
  const p = parsePaymentRequired('not json', headers({ 'X-PAYMENT-REQUIRED': JSON.stringify(flat) }))!;
  assert.equal(p.version, 1);
  assert.equal(p.source, 'x-payment-required');
  assert.equal(p.options[0].payTo, PAY_TO);
  assert.deepEqual(priceToUsdc(p.options[0]), { usdc: 0.01, atomic: false });
});

test('no parseable terms → null', () => {
  assert.equal(parsePaymentRequired('<html>', headers({ 'PAYMENT-REQUIRED': '%%%' })), null);
  assert.equal(parsePaymentRequired('{"accepts":[]}', headers()), null);
});

test('prices: V2 amount always atomic; V1 integer atomic, decimal as USDC', () => {
  assert.deepEqual(priceToUsdc({ amount: '1', amountField: 'amount' }), { usdc: 0.000001, atomic: true });
  assert.deepEqual(priceToUsdc({ amount: '1000', amountField: 'maxAmountRequired' }), { usdc: 0.001, atomic: true });
  assert.deepEqual(priceToUsdc({ amount: '0.001', amountField: 'maxAmountRequired' }), { usdc: 0.001, atomic: false });
  assert.equal(priceToUsdc({ amount: 'abc', amountField: 'amount' }), null);
  assert.equal(priceToUsdc({ amount: '', amountField: 'amount' }), null);
});

test('header JSON decodes plain or base64', () => {
  assert.deepEqual(decodeHeaderJson('{"a":1}'), { a: 1 });
  assert.deepEqual(decodeHeaderJson(b64({ a: 1 })), { a: 1 });
  assert.equal(decodeHeaderJson(null), null);
  assert.equal(decodeHeaderJson('%%%'), null);
});

test('V2 PAYMENT-SIGNATURE payload matches the spec shape', () => {
  const accepted = { scheme: 'exact', network: 'eip155:8453', amount: '10000', asset: USDC, payTo: PAY_TO };
  const authorization = {
    from: '0x857b06519E91e3A54538791bDbb0E22373e36b66', to: PAY_TO, value: '10000',
    validAfter: '1740672089', validBefore: '1740672154', nonce: '0x' + '11'.repeat(32),
  };
  const header = buildV2PaymentHeader({ resource: { url: 'https://x.test' }, accepted, signature: '0xsig', authorization });
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64').toString('utf8')), {
    x402Version: 2,
    resource: { url: 'https://x.test' },
    accepted,
    payload: { signature: '0xsig', authorization },
  });
});

test('settlement: V2 PAYMENT-RESPONSE success → confirmed with Basescan link', () => {
  const s = readSettlement(headers({ 'PAYMENT-RESPONSE': b64({ success: true, transaction: TX, network: 'eip155:8453' }) }));
  assert.equal(s.status, 'confirmed');
  assert.equal(s.tx_hash, TX);
  assert.equal(s.explorer_url, `https://basescan.org/tx/${TX}`);
  assert.equal(s.receipt_header, 'PAYMENT-RESPONSE');
});

test('settlement: V1 X-PAYMENT-RESPONSE is read too', () => {
  const s = readSettlement(headers({ 'X-PAYMENT-RESPONSE': b64({ success: true, transaction: TX, network: 'base' }) }));
  assert.equal(s.status, 'confirmed');
  assert.equal(s.receipt_header, 'X-PAYMENT-RESPONSE');
});

test('settlement: failure and missing receipt', () => {
  const failed = readSettlement(headers({ 'PAYMENT-RESPONSE': b64({ success: false, errorReason: 'insufficient_funds', transaction: '' }) }));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error_reason, 'insufficient_funds');
  assert.equal(failed.explorer_url, null);

  const none = readSettlement(headers());
  assert.equal(none.status, 'unconfirmed');
  assert.equal(none.tx_hash, null);
});

test('explorer links only for real tx hashes on known networks', () => {
  assert.equal(explorerTxUrl('eip155:84532', TX), `https://sepolia.basescan.org/tx/${TX}`);
  assert.equal(explorerTxUrl('base', 'not-a-hash'), null);
  assert.equal(explorerTxUrl('solana', TX), null);
});
