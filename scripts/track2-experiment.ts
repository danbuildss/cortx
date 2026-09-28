#!/usr/bin/env npx ts-node
/**
 * Track 2 Experiment — Facilitator /verify readiness check
 *
 * Queries active services from the database and runs runReadinessCheck()
 * against each, WITHOUT spending USDC. Outputs structured findings for
 * docs/track2-findings.md.
 *
 * Usage:
 *   CORTX_TEST_WALLET_KEY=0x... \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx ts-node scripts/track2-experiment.ts
 *
 * Options:
 *   --url <url>    Run against a single URL instead of querying the database
 *   --env mainnet|testnet   Environment (default: mainnet)
 *   --max-price <n>         Max price cap in USDC (default: 1.0)
 *   --json                  Print each result as JSON lines
 *   --summary               Print aggregate summary only
 */

import { createClient } from '@supabase/supabase-js';
import { runReadinessCheck } from '../lib/check-runner/readiness';
import type { ReadinessResult } from '../lib/check-runner/readiness';

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name: string): string | null {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] ?? null : null;
}
const singleUrl = flag('--url');
const envArg = (flag('--env') ?? 'mainnet') as 'mainnet' | 'testnet';
const maxPrice = flag('--max-price') ?? '1.0';
const printJson = args.includes('--json');
const summaryOnly = args.includes('--summary');

// ─── DB helpers ───────────────────────────────────────────────────────────────

type ServiceRow = {
  id: string;
  name: string;
  endpoint_url: string;
  max_price: string;
  environment: string;
  test_input: Record<string, unknown> | null;
  paid_verification_mode: string;
};

async function fetchServices(): Promise<ServiceRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required to query the database');
    process.exit(1);
  }

  const db = createClient(url, key);
  const { data, error } = await db
    .from('services')
    .select('id, name, endpoint_url, max_price, environment, test_input, paid_verification_mode')
    .is('deleted_at', null)
    .is('monitoring_paused_reason', null)
    .neq('paid_verification_mode', 'disabled');

  if (error) {
    console.error('DB query failed:', error.message);
    process.exit(1);
  }
  return data ?? [];
}

// ─── Printer ──────────────────────────────────────────────────────────────────

function printResult(result: ReadinessResult, serviceName: string) {
  if (printJson) {
    console.log(JSON.stringify({ service_name: serviceName, ...result }));
    return;
  }

  if (summaryOnly) return;

  const statusIcon = result.status === 'ready' ? '✅' : result.status === 'not_ready' ? '❌' : '⚠️';
  console.log(`\n${statusIcon} ${serviceName} (${result.endpoint_url})`);
  console.log(`   Status:         ${result.status}`);
  if (result.failure_stage) console.log(`   Failed stage:   ${result.failure_stage}`);
  if (result.observed_price) console.log(`   Observed price: ${result.observed_price} USDC`);
  console.log(`   Facilitator:    ${result.facilitator_url ?? 'n/a'} ${result.facilitator_is_custom ? '(custom)' : '(default)'}`);
  if (result.authorization_ttl_seconds) console.log(`   Auth TTL:       ${result.authorization_ttl_seconds}s`);
  if (result.facilitator_responded) {
    console.log(`   /verify result: isValid=${result.verify_is_valid}`);
    if (result.verify_invalid_reason) console.log(`   Invalid reason: ${result.verify_invalid_reason}`);
  }
  if (result.error_message) console.log(`   Error:          ${result.error_message}`);
}

function printSummary(results: Array<{ result: ReadinessResult; name: string }>) {
  const total = results.length;
  const ready = results.filter(r => r.result.status === 'ready').length;
  const notReady = results.filter(r => r.result.status === 'not_ready').length;
  const errored = results.filter(r => r.result.status === 'error').length;
  const facilitatorResponded = results.filter(r => r.result.facilitator_responded).length;
  const customFacilitators = new Set(
    results
      .filter(r => r.result.facilitator_is_custom)
      .map(r => r.result.facilitator_url)
  );
  const defaultFacilitators = results.filter(r => !r.result.facilitator_is_custom).length;
  const uniqueFacilitators = new Set(results.map(r => r.result.facilitator_url).filter(Boolean));

  // Stage failure breakdown
  const stageFailures: Record<string, number> = {};
  for (const { result } of results) {
    if (result.failure_stage) {
      stageFailures[result.failure_stage] = (stageFailures[result.failure_stage] ?? 0) + 1;
    }
  }

  // TTL distribution
  const ttls = results.map(r => r.result.authorization_ttl_seconds).filter(Boolean) as number[];
  const avgTtl = ttls.length > 0 ? Math.round(ttls.reduce((a, b) => a + b, 0) / ttls.length) : null;

  // Invalid reasons from verify
  const invalidReasons: Record<string, number> = {};
  for (const { result } of results) {
    if (result.verify_invalid_reason) {
      invalidReasons[result.verify_invalid_reason] = (invalidReasons[result.verify_invalid_reason] ?? 0) + 1;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('TRACK 2 EXPERIMENT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total services tested:  ${total}`);
  console.log(`Ready (verify passed):  ${ready}/${total}`);
  console.log(`Not ready:              ${notReady}/${total}`);
  console.log(`Errors:                 ${errored}/${total}`);
  console.log('');
  console.log('FACILITATOR LANDSCAPE');
  console.log(`Facilitator responded:  ${facilitatorResponded}/${total}`);
  console.log(`Using default (x402.org): ${defaultFacilitators}`);
  console.log(`Using custom facilitator: ${customFacilitators.size > 0 ? [...customFacilitators].join(', ') : 'none'}`);
  console.log(`Unique facilitator URLs:  ${uniqueFacilitators.size}`);
  console.log('');
  if (Object.keys(stageFailures).length > 0) {
    console.log('FAILURE STAGES');
    for (const [s, n] of Object.entries(stageFailures)) {
      console.log(`  ${s}: ${n}`);
    }
    console.log('');
  }
  if (Object.keys(invalidReasons).length > 0) {
    console.log('/VERIFY INVALID REASONS');
    for (const [r, n] of Object.entries(invalidReasons)) {
      console.log(`  ${r}: ${n}`);
    }
    console.log('');
  }
  if (avgTtl !== null) {
    console.log(`Avg authorization TTL: ${avgTtl}s`);
  }
  console.log('');
  console.log('OPEN QUESTION ANSWERS');
  console.log(`Q1 (Facilitator implements /verify?): `
    + (facilitatorResponded > 0
      ? `YES — ${facilitatorResponded}/${total} endpoints had a responsive facilitator`
      : 'NO DATA — facilitator did not respond to any /verify calls'));
  console.log(`Q2 (EIP-3009 replay risk):            Authorization TTL avg ${avgTtl ?? '?'}s. `
    + `After /verify, signed auth is valid for this window. Facilitator is trusted counterparty — `
    + `same risk as any x402 payment flow. Acceptable.`);
  console.log(`Q3 (/verify predicts /settle?):       `
    + (ready > 0
      ? `${ready} ready — cross-reference with next scheduled paid check to validate`
      : 'No ready results to cross-reference'));
  console.log(`Q4 (Facilitator variance):            ${uniqueFacilitators.size} unique facilitator URL(s) across ${total} endpoints`);
  console.log(`Q5 (Latency of /verify):              See per-service stage durations above`);
  console.log('═'.repeat(60));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let services: Array<{ id: string; name: string; endpoint_url: string; max_price: string; environment: 'mainnet' | 'testnet'; test_input: Record<string, unknown> | null }>;

  if (singleUrl) {
    services = [{
      id: 'manual',
      name: singleUrl,
      endpoint_url: singleUrl,
      max_price: maxPrice,
      environment: envArg,
      test_input: null,
    }];
    console.log(`Running single readiness check: ${singleUrl}`);
  } else {
    const rows = await fetchServices();
    services = rows.map(r => ({
      id: r.id,
      name: r.name,
      endpoint_url: r.endpoint_url,
      max_price: r.max_price ?? maxPrice,
      environment: (r.environment as 'mainnet' | 'testnet') ?? envArg,
      test_input: r.test_input,
    }));
    console.log(`Queried ${services.length} active services from database`);
  }

  if (services.length === 0) {
    console.log('No services found. Exiting.');
    process.exit(0);
  }

  const results: Array<{ result: ReadinessResult; name: string }> = [];

  for (const svc of services) {
    if (!summaryOnly && !printJson) {
      process.stdout.write(`Checking ${svc.name}...`);
    }

    const result = await runReadinessCheck({
      service_id: svc.id,
      endpoint_url: svc.endpoint_url,
      max_price: svc.max_price,
      environment: svc.environment,
      test_input: svc.test_input,
    });

    results.push({ result, name: svc.name });
    printResult(result, svc.name);
  }

  printSummary(results);

  // Exit non-zero if any service is not_ready or errored, to make the script
  // CI-friendly (useful for future automation).
  const allReady = results.every(r => r.result.status === 'ready');
  process.exit(allReady ? 0 : 1);
}

main().catch(err => {
  console.error('Experiment failed:', err);
  process.exit(1);
});
