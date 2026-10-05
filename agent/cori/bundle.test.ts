// The Cori bundle must contain no payment code: no signing libraries, no x402
// client, no CORTX payment module. Scout can't pay because the code isn't there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { buildOptions } from './build.mjs';

test('the Cori bundle contains no payment or signing code', { timeout: 120_000 }, async () => {
  const r = await build({ ...buildOptions('test'), write: false, metafile: true, logLevel: 'silent' });
  const inputs = Object.keys(r.metafile!.inputs);
  assert.ok(inputs.some((p) => p.endsWith('agent/cori/index.ts')), 'sanity: the entry is in the bundle');
  const forbidden = /node_modules\/(viem|ox|abitype|x402|@x402|@coinbase|ethers|@noble\/curves|@scure)\/|lib\/check-runner\/(payment|runner|readiness)\.ts$|lib\/token\.ts$/;
  const found = inputs.filter((p) => forbidden.test(p));
  assert.deepEqual(found, [], `payment/signing code in the Cori bundle: ${found.join(', ')}`);
  const out = r.outputFiles![0].text;
  assert.ok(out.includes('"test"'), 'version stamped into the bundle');
  for (const h of ['x-payment', 'payment-signature']) assert.ok(!out.toLowerCase().includes(`'${h}'`) && !out.toLowerCase().includes(`"${h}"`), `no ${h} header literal`);
});
