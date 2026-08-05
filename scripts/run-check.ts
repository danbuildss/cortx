#!/usr/bin/env npx ts-node
/**
 * Phase 0 console runner — test the check pipeline without any UI or DB.
 *
 * Usage:
 *   CORTX_TEST_WALLET_KEY=0x... \
 *   CORTX_SKIP_PAYMENT_VERIFY=true \
 *   npx ts-node scripts/run-check.ts --url https://your-app.vercel.app/api/test-service
 *
 * Options:
 *   --url <url>              Endpoint URL to test (default: local test service)
 *   --variant <name>         Test service variant: healthy | broken | schema-fail (appended as ?variant=)
 *   --expected-price <n>     Expected price in USDC (default: 0.001)
 *   --max-price <n>          Max price in USDC (default: 0.01)
 *   --latency-threshold <n>  Latency threshold in ms (default: 5000)
 */

import { runCheck } from '../lib/check-runner/runner';
import type { ServiceConfig } from '../lib/check-runner/types';

const args = process.argv.slice(2);

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const variant = getArg('--variant', 'healthy');
const baseUrl = getArg('--url', 'http://localhost:3000/api/test-service') ?? 'http://localhost:3000/api/test-service';
const endpointUrl = variant !== 'healthy' ? `${baseUrl}?variant=${variant}` : baseUrl;

const config: ServiceConfig = {
  id: 'test-run-001',
  user_id: 'local-dev',
  endpoint_url: endpointUrl,
  test_input: { query: 'test', mode: 'check' },
  expected_schema: {
    type: 'object',
    required: ['result', 'query', 'timestamp', 'service'],
    properties: {
      result: { type: 'string' },
      query: { type: 'string' },
      timestamp: { type: 'string' },
      service: { type: 'string' },
    },
    additionalProperties: false,
  },
  expected_price: getArg('--expected-price', '0.001') ?? '0.001',
  max_price: getArg('--max-price', '0.01') ?? '0.01',
  latency_threshold_ms: parseInt(getArg('--latency-threshold', '5000') ?? '5000', 10),
  environment: 'mainnet',
};

console.log('\n─────────────────────────────────────────');
console.log('CORTX Check Runner — Phase 0 Console Test');
console.log('─────────────────────────────────────────');
console.log(`Endpoint: ${config.endpoint_url}`);
console.log(`Expected price: $${config.expected_price} USDC`);
console.log(`Max price: $${config.max_price} USDC`);
console.log('─────────────────────────────────────────\n');

async function main() {
  const result = await runCheck(config);

  console.log(`Status: ${result.status.toUpperCase()}`);
  if (result.failure_stage) console.log(`Failure stage: ${result.failure_stage}`);
  if (result.observed_price) console.log(`Observed price: $${result.observed_price} USDC`);
  if (result.latency_ms) console.log(`Latency: ${result.latency_ms}ms`);
  console.log('');

  for (const stage of result.stages) {
    const icon = stage.passed === true ? '✓' : stage.passed === false ? '✗' : '—';
    const dur = stage.duration_ms !== null ? ` (${stage.duration_ms}ms)` : '';
    const err = stage.error ? ` [${stage.error}]` : '';
    console.log(`  ${icon} ${stage.stage}${dur}${err}`);
    if (stage.passed === false && stage.evidence) {
      console.log(`    ${JSON.stringify(stage.evidence, null, 2).split('\n').join('\n    ')}`);
    }
  }

  if (result.error_message) {
    console.log(`\nRunner error: ${result.error_message}`);
  }

  console.log('\n─────────────────────────────────────────');
  console.log('Full result JSON:');
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.status === 'passed' ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
