import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runFullCheck, runCanaryCheck, getSpendCaps } from '@/lib/check-runner/runner';
import { runLightweightCheck } from '@/lib/check-runner/lightweight';
import { runReadinessCheck, readinessToCheckResult, readinessReason } from '@/lib/check-runner/readiness';
import { READINESS_UNAVAILABLE_RECHECK_MINUTES } from '@/lib/check-runner/schedule';
import { minutesSince, parseWatchdogState, watchdogDecision } from '@/lib/cori/status';
import { persistCheckResult } from '@/lib/check-runner/persist';
import type { TriggerSource } from '@/lib/check-runner/persist';
import { getWalletAddress, getWalletBalance } from '@/lib/check-runner/payment';
import { sendTelegramAlert } from '@/lib/telegram';
import type { CanaryConfig, CheckResult } from '@/lib/check-runner/types';
import { runPool } from '@/lib/cron/pool';

const SPEND_CAP_CODES = new Set(['DAILY_SPEND_CAP_EXCEEDED', 'MONTHLY_SPEND_CAP_EXCEEDED']);

// Don't fire another anomaly-triggered paid check within this window
const ANOMALY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export const maxDuration = 60;

// Each loop runs several services at once and stops STARTING new checks at its
// cut-off (ms after the request began), leaving room for checks already
// running to finish inside maxDuration. Services not started stay due and are
// picked up by the next tick, most overdue first.
const CONCURRENCY = { lightweight: 5, readiness: 3, paid: 3 };
const START_CUTOFF_MS = { lightweight: 15_000, readiness: 25_000, paid: 30_000 };

// GET /api/cron — called by cron-job.org on schedule
// Requires: Authorization: Bearer {CRON_SECRET}
// Dual-loop: lightweight pings on next_check_at, paid verifications on next_paid_verification_at
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  const secret = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!isValidCronSecret(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const startedAt = Date.now();
  const now = new Date(startedAt).toISOString();

  // ── Wallet balance check (admin alert) ────────────────────────────────────
  await checkWalletBalance();

  // ── Cori watchdog (admin alert if the Cori agent goes silent) ─────────────
  await checkCoriHeartbeat().catch((err) => console.error('Cori watchdog failed:', err));

  // ── Loop 1: Lightweight pings ─────────────────────────────────────────────
  const { data: lightweightDue, error: lwErr } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, check_interval_minutes, status, consecutive_failures, latency_threshold_ms, lightweight_check_interval_minutes, last_anomaly_triggered_at, paid_verification_mode, monitoring_paused_reason')
    .is('deleted_at', null)
    .lte('next_check_at', now)
    .order('next_check_at', { ascending: true });

  if (lwErr) {
    return NextResponse.json({ error: lwErr.message }, { status: 500 });
  }

  const lightweightResults: Array<{ id: string; status: string; triggered?: string }> = [];
  const triggeredServiceIds: string[] = [];

  const lightweightRun = await runPool(lightweightDue ?? [], {
    concurrency: CONCURRENCY.lightweight,
    startBefore: startedAt + START_CUTOFF_MS.lightweight,
  }, async (svc) => {
    try {
      const result = await runLightweightCheck(svc.id, svc.endpoint_url);
      await persistCheckResult(svc, result);

      // Evaluate anomaly triggers after persisting lightweight result
      const triggerReason = evaluateTrigger(svc, result);
      if (triggerReason) {
        await db.from('services')
          .update({
            next_paid_verification_at: now,
            last_anomaly_triggered_at: now,
          })
          .eq('id', svc.id);

        triggeredServiceIds.push(svc.id);
        lightweightResults.push({ id: svc.id, status: result.status, triggered: triggerReason });
      } else {
        lightweightResults.push({ id: svc.id, status: result.status });
      }
    } catch (err) {
      console.error(`Lightweight check failed for service ${svc.id}:`, err);
      lightweightResults.push({ id: svc.id, status: 'error' });
    }
  });

  // ── Loop 1b: Payment readiness (facilitator /verify, no USDC moves) ───────
  const readinessResults = await runReadinessLoop(db, now, startedAt + START_CUTOFF_MS.readiness);

  // ── Loop 2: Paid verifications ────────────────────────────────────────────
  // Auto-unpause services paused by a spend cap, but only once that cap has reset
  await unpauseServicesWithResetCaps(db);

  const { data: paidDue, error: paidErr } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, environment, test_input, expected_schema, expected_price, max_price, latency_threshold_ms, check_interval_minutes, paid_verification_interval_minutes, paid_verification_mode, canary_payload, canary_expected_schema, canary_max_price_usdc, status, consecutive_failures, readiness_status')
    .is('deleted_at', null)
    .is('monitoring_paused_reason', null)
    .lte('next_paid_verification_at', now)
    .neq('paid_verification_mode', 'disabled')
    .order('next_paid_verification_at', { ascending: true });

  if (paidErr) {
    return NextResponse.json({ error: paidErr.message }, { status: 500 });
  }

  const paidResults: Array<{ id: string; status: string; type: string; trigger: string }> = [];

  // Concurrent paid checks are safe: each reserves budget atomically
  // (reserve_spend holds an advisory lock), so the caps hold.
  const paidRun = await runPool(paidDue ?? [], {
    concurrency: CONCURRENCY.paid,
    startBefore: startedAt + START_CUTOFF_MS.paid,
  }, async (svc) => {
    // Determine whether this paid check was anomaly-triggered or scheduled
    const triggerSource: TriggerSource = triggeredServiceIds.includes(svc.id)
      ? (lightweightResults.find(r => r.id === svc.id)?.triggered as TriggerSource ?? 'scheduled')
      : 'scheduled';

    try {
      const serviceConfig = {
        id: svc.id,
        user_id: svc.user_id,
        endpoint_url: svc.endpoint_url,
        test_input: svc.test_input as Record<string, unknown>,
        expected_schema: svc.expected_schema as Record<string, unknown>,
        expected_price: String(svc.expected_price),
        max_price: String(svc.max_price),
        latency_threshold_ms: svc.latency_threshold_ms,
        environment: svc.environment as 'mainnet' | 'testnet',
      };

      let result: CheckResult;
      if (svc.paid_verification_mode === 'canary' && svc.canary_payload) {
        const canaryConfig: CanaryConfig = {
          payload: svc.canary_payload as Record<string, unknown>,
          expected_schema: (svc.canary_expected_schema ?? svc.expected_schema) as Record<string, unknown>,
          max_price_usdc: String(svc.canary_max_price_usdc ?? svc.max_price),
        };
        result = await runCanaryCheck(serviceConfig, canaryConfig);
      } else {
        result = await runFullCheck(serviceConfig);
      }

      await persistCheckResult(svc, result, triggerSource);
      paidResults.push({ id: svc.id, status: result.status, type: result.check_type, trigger: triggerSource });

      // Detect spend cap hit — pause the service and alert the builder
      const paymentStage = result.stages?.find(s => s.stage === 'payment');
      const capCode = paymentStage?.error;
      if (capCode && SPEND_CAP_CODES.has(capCode)) {
        const pauseReason = capCode === 'DAILY_SPEND_CAP_EXCEEDED'
          ? 'SPEND_CAP_DAILY'
          : 'SPEND_CAP_MONTHLY';

        await db
          .from('services')
          .update({ monitoring_paused_reason: pauseReason })
          .eq('id', svc.id);

        const { data: telegramConns } = await db
          .from('telegram_connections')
          .select('chat_id')
          .eq('user_id', svc.user_id)
          .eq('active', true);

        const resumes = capCode === 'DAILY_SPEND_CAP_EXCEEDED'
          ? 'tomorrow (00:00 UTC)'
          : 'at the start of next month (UTC)';
        // The cap is CORTX's platform-wide verification budget, not the builder's.
        const alertText =
          `ℹ️ <b>CORTX paid verification paused</b>\n\n` +
          `<b>${svc.name}</b> — CORTX has used its verification budget for this period. ` +
          `This is on our side, not a problem with your service, and your status is unchanged.\n\n` +
          `Free availability checks continue. Paid verification resumes automatically ${resumes}.`;

        for (const conn of telegramConns ?? []) {
          await sendTelegramAlert(conn.chat_id, alertText).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`Paid check failed for service ${svc.id}:`, err);
      paidResults.push({ id: svc.id, status: 'error', type: svc.paid_verification_mode, trigger: triggerSource });
    }
  });

  return NextResponse.json({
    lightweight: { processed: lightweightRun.results.length, deferred: lightweightRun.deferred.length, results: lightweightResults },
    readiness: readinessResults,
    paid: {
      processed: paidRun.results.length,
      deferred: paidRun.deferred.length,
      results: paidResults,
      anomaly_triggered: triggeredServiceIds.length,
    },
    duration_ms: Date.now() - startedAt,
  });
}

// Runs readiness checks for services that are due. Free (nothing settles), so
// it runs even while paid checks are paused by the spend cap. Failures here
// never break the rest of the cron — e.g. before migration 021 is applied.
async function runReadinessLoop(
  db: SupabaseClient,
  now: string,
  startBefore: number
): Promise<{ processed: number; deferred?: number; results: Array<{ id: string; status: string }>; skipped_reason?: string }> {
  const { data: due, error } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, environment, test_input, max_price, status, consecutive_failures, latency_threshold_ms, check_interval_minutes, paid_verification_interval_minutes, readiness_status, readiness_consecutive_failures, readiness_check_interval_minutes')
    .is('deleted_at', null)
    .lte('next_readiness_check_at', now)
    .order('next_readiness_check_at', { ascending: true });

  if (error) {
    console.warn('Readiness loop skipped:', error.message);
    return { processed: 0, results: [], skipped_reason: error.message };
  }

  const results: Array<{ id: string; status: string }> = [];
  const run = await runPool(due ?? [], { concurrency: CONCURRENCY.readiness, startBefore }, async (svc) => {
    try {
      const readiness = await runReadinessCheck({
        service_id: svc.id,
        endpoint_url: svc.endpoint_url,
        max_price: String(svc.max_price ?? '1.00'),
        environment: (svc.environment as 'mainnet' | 'testnet') ?? 'mainnet',
        test_input: svc.test_input as Record<string, unknown> | null,
      });

      const checkResult = readinessToCheckResult(readiness);
      if (checkResult) {
        await persistCheckResult(svc, checkResult, 'scheduled', { readinessReason: readinessReason(readiness) });
      } else {
        // Service doesn't publish its facilitator: no check row, re-probe daily
        await db.from('services').update({
          readiness_status: 'unavailable',
          readiness_reason: readinessReason(readiness),
          last_readiness_check_at: now,
          next_readiness_check_at: new Date(Date.now() + READINESS_UNAVAILABLE_RECHECK_MINUTES * 60_000).toISOString(),
        }).eq('id', svc.id);
      }
      results.push({ id: svc.id, status: readiness.status });
    } catch (err) {
      console.error(`Readiness check failed for service ${svc.id}:`, err);
      results.push({ id: svc.id, status: 'error' });
    }
  });
  return { processed: run.results.length, deferred: run.deferred.length, results };
}

function isValidCronSecret(provided: string, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Clears spend-cap pauses only when the cap that caused them has actually reset.
// Uses the get_spend_totals RPC (migration 020). If the RPC is unavailable,
// falls back to unpausing everything (the pre-020 behaviour) so services never
// get stuck paused — the next capped check simply re-pauses them.
async function unpauseServicesWithResetCaps(db: SupabaseClient): Promise<void> {
  const { data, error } = await db.rpc('get_spend_totals');
  const row = Array.isArray(data) ? data[0] : data;

  const reasonsToClear: string[] = [];
  if (error || !row) {
    console.warn('get_spend_totals unavailable, unpausing all capped services:', error?.message);
    reasonsToClear.push('SPEND_CAP_DAILY', 'SPEND_CAP_MONTHLY');
  } else {
    const { dailyCap, monthlyCap } = getSpendCaps();
    const dailySpent = Number(row.daily_spent ?? 0);
    const monthlySpent = Number(row.monthly_spent ?? 0);
    const monthlyHasRoom = monthlySpent < monthlyCap;
    if (monthlyHasRoom) reasonsToClear.push('SPEND_CAP_MONTHLY');
    if (monthlyHasRoom && dailySpent < dailyCap) reasonsToClear.push('SPEND_CAP_DAILY');
  }

  if (reasonsToClear.length === 0) return;

  await db
    .from('services')
    .update({ monitoring_paused_reason: null })
    .in('monitoring_paused_reason', reasonsToClear)
    .is('deleted_at', null);
}

// Alerts the admin on Telegram when the Cori agent (VPS) stops reporting in:
// once when it goes silent for 30+ min, again at most every 6 h while it
// stays down, and once when it's back. Silent until Cori has ever run.
async function checkCoriHeartbeat(): Promise<void> {
  const adminChatId = process.env.CORTX_ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  // cori_runs / system_settings aren't in the generated Supabase types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: lastRun, error } = await db
    .from('cori_runs')
    .select('started_at')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return; // table missing or unreachable — nothing to report

  const { data: setting } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'cori_watchdog')
    .maybeSingle();

  const now = new Date();
  const lastRunAt = lastRun?.started_at ? new Date(lastRun.started_at as string) : null;
  const decision = watchdogDecision(lastRunAt, parseWatchdogState(setting?.value as string | null), now);
  if (!decision.send) return;

  const text = decision.send === 'down'
    ? `⚠️ <b>Cori is silent</b>\n\nNo report from the Cori agent for ${minutesSince(lastRunAt!, now)} minutes. ` +
      `Check the Cori server (<code>systemctl status cori</code>, <code>journalctl -u cori</code>).`
    : `✅ <b>Cori is running again</b>\n\nThe Cori agent is reporting in.`;
  await sendTelegramAlert(adminChatId, text).catch(() => {});

  await db
    .from('system_settings')
    .upsert({ key: 'cori_watchdog', value: JSON.stringify(decision.next), updated_at: now.toISOString() });
}

// Checks the CORTX test wallet balance and sends a Telegram alert to the admin
// if it falls below the configured threshold. Alerts at most once every 6 hours
// to avoid spamming on every cron tick while the wallet is empty.
async function checkWalletBalance(): Promise<void> {
  const adminChatId = process.env.CORTX_ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return; // Admin alert not configured — skip silently

  const threshold = parseFloat(process.env.CORTX_WALLET_LOW_BALANCE_THRESHOLD_USDC ?? '0.05');

  let balance: string;
  let walletAddr: `0x${string}`;
  try {
    walletAddr = getWalletAddress();
    balance = await getWalletBalance(walletAddr);
  } catch {
    return; // Wallet key not set or RPC error — don't block the cron
  }

  if (parseFloat(balance) >= threshold) return;

  // system_settings is not yet in the generated Supabase types — use any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check when we last sent a wallet alert (6-hour cooldown)
  const { data: setting } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'last_wallet_alert_sent_at')
    .maybeSingle();

  const lastAlertAt = setting?.value ? new Date(setting.value as string) : null;
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  if (lastAlertAt && lastAlertAt > sixHoursAgo) return;

  const addrDisplay = `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`;
  await sendTelegramAlert(
    adminChatId,
    `⚠️ <b>CORTX wallet balance low</b>\n\n` +
    `Wallet: <code>${addrDisplay}</code>\n` +
    `Balance: <b>${parseFloat(balance).toFixed(6)} USDC</b>\n` +
    `Threshold: ${threshold} USDC\n\n` +
    `Paid monitoring checks will start failing when balance reaches 0. ` +
    `Top up the wallet with USDC on Base.`
  ).catch(() => {}); // Don't let alert failure block the cron

  await db
    .from('system_settings')
    .upsert({ key: 'last_wallet_alert_sent_at', value: new Date().toISOString(), updated_at: new Date().toISOString() });
}

// Returns the trigger reason if a paid check should be fired now, null otherwise.
// Lightweight checks only observe endpoint reachability and latency — price drift
// and payment terms changes are not detectable here and are excluded.
function evaluateTrigger(
  svc: {
    status: string;
    latency_threshold_ms: number;
    last_anomaly_triggered_at: string | null;
    paid_verification_mode: string;
    monitoring_paused_reason: string | null;
  },
  result: CheckResult
): 'anomaly_recovery' | 'anomaly_latency' | null {
  // Don't trigger if monitoring is paused (spend cap hit)
  if (svc.monitoring_paused_reason) return null;

  // Don't trigger if paid checks are disabled for this service
  if (svc.paid_verification_mode === 'disabled') return null;

  // Cooldown: don't retrigger within 1 hour of the last anomaly trigger
  if (svc.last_anomaly_triggered_at) {
    const elapsed = Date.now() - new Date(svc.last_anomaly_triggered_at).getTime();
    if (elapsed < ANOMALY_COOLDOWN_MS) return null;
  }

  // Recovery: endpoint is reachable again after being in a degraded/critical state
  if (result.status === 'passed' && (svc.status === 'degraded' || svc.status === 'critical')) {
    return 'anomaly_recovery';
  }

  // Latency spike: lightweight ping exceeded the user-configured threshold
  if (
    result.latency_ms != null &&
    svc.latency_threshold_ms > 0 &&
    result.latency_ms > svc.latency_threshold_ms
  ) {
    return 'anomaly_latency';
  }

  return null;
}
