import { createClient } from '@supabase/supabase-js';
import { classifyStatus } from './classify';
import { sendTelegramAlert } from '../telegram';
import { sendDiscordAlert } from '../discord';
import { canResolveIncident, paidIntervalMinutes, READINESS_INTERVAL_MINUTES, worseStatus } from './schedule';
import type { CheckResult, CheckType } from './types';
import { runnerVersion } from './context';
import { SPEC_VERSION } from './spec-record';

function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ServiceRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  consecutive_failures: number;
  check_interval_minutes: number;
  latency_threshold_ms: number;
  paid_verification_interval_minutes?: number;
  lightweight_check_interval_minutes?: number;
  // Readiness (migration 021) — optional so callers that don't select them still work
  readiness_status?: string | null;
  readiness_consecutive_failures?: number | null;
  readiness_check_interval_minutes?: number | null;
};

// PostgREST: unknown column (PGRST204) or Postgres undefined_column (42703)
export function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === 'PGRST204' || err.code === '42703' || /column .* (does not exist|could not find)|Could not find the .* column/i.test(err.message ?? '');
}

export type TriggerSource = 'scheduled' | 'anomaly_recovery' | 'anomaly_latency';

const READINESS_STATUS_FOR: Record<CheckResult['status'], string> = {
  passed: 'ready',
  failed: 'not_ready',
  error: 'error',
};

export async function persistCheckResult(
  svc: ServiceRow,
  result: CheckResult,
  triggerSource: TriggerSource = 'scheduled',
  opts: { readinessReason?: string | null } = {}
): Promise<void> {
  const db = serviceRoleClient();
  const isReadiness = result.check_type === 'readiness';

  // 1. Insert check record
  const row = {
    service_id: svc.id,
    user_id: svc.user_id,
    started_at: result.started_at.toISOString(),
    completed_at: result.completed_at?.toISOString() ?? null,
    latency_ms: result.latency_ms,
    status: result.status,
    failure_stage: result.failure_stage,
    stages: result.stages,
    observed_price: result.observed_price ? parseFloat(result.observed_price) : null,
    error_message: result.error_message,
    check_type: result.check_type,
    trigger_source: triggerSource,
  };
  // DATA COMPOUNDS (S4): what the check ran against and which code judged it.
  // config_version is stamped by a database trigger (migration 026).
  const provenance = {
    context: result.context ?? null,
    runner_version: runnerVersion(),
    spec_version: SPEC_VERSION,
  };

  let { data: check, error: insertErr } = await db
    .from('checks')
    .insert({ ...row, ...provenance })
    .select('id')
    .single();

  // Before migration 026 the new columns don't exist: save the check without
  // them rather than lose it
  if (insertErr && isMissingColumn(insertErr)) {
    console.warn('checks provenance columns missing (run migration 026); saving without them');
    ({ data: check, error: insertErr } = await db.from('checks').insert(row).select('id').single());
  }

  if (insertErr || !check) {
    console.error('Failed to insert check:', insertErr);
    return;
  }

  // 2. Build service update — freshness tracking per tier
  const now = new Date().toISOString();
  const serviceUpdate: Record<string, string | number | null> = {
    last_checked_at: now,
  };

  if (result.check_type === 'lightweight') {
    serviceUpdate.last_lightweight_check_at = now;
    serviceUpdate.next_check_at = nextCheckAt(svc.lightweight_check_interval_minutes ?? svc.check_interval_minutes);
  } else if (isReadiness) {
    serviceUpdate.last_readiness_check_at = now;
    serviceUpdate.next_readiness_check_at = nextCheckAt(svc.readiness_check_interval_minutes ?? READINESS_INTERVAL_MINUTES);
    serviceUpdate.readiness_status = READINESS_STATUS_FOR[result.status];
    serviceUpdate.readiness_reason = opts.readinessReason ?? null;
  } else {
    serviceUpdate.last_paid_verification_at = now;
    serviceUpdate.next_paid_verification_at = nextCheckAt(paidIntervalMinutes(
      svc.paid_verification_interval_minutes ?? svc.check_interval_minutes,
      svc.readiness_status,
      result.status === 'passed'
    ));
    if (result.check_type === 'full') {
      serviceUpdate.last_full_verification_at = now;
    }
  }

  // 3. Errors (CORTX-side) and lightweight pings never change status or incidents
  if (result.status === 'error' || result.check_type === 'lightweight') {
    await db.from('services').update(serviceUpdate).eq('id', svc.id);
    return;
  }

  // 4. Failure streaks. Paid and readiness checks keep separate counters, so a
  //    passing readiness check never hides a failing paid check (or vice versa).
  const failed = result.status === 'failed';
  let failuresForIncident: number;
  if (isReadiness) {
    failuresForIncident = failed ? (svc.readiness_consecutive_failures ?? 0) + 1 : 0;
    serviceUpdate.readiness_consecutive_failures = failuresForIncident;
  } else {
    failuresForIncident = failed ? svc.consecutive_failures + 1 : 0;
    serviceUpdate.consecutive_failures = failuresForIncident;
  }

  const { service_status } = classifyStatus(
    result.stages,
    result.latency_ms ?? 0,
    isReadiness ? undefined : svc.latency_threshold_ms
  );

  // 5. Fetch user alert connections
  const { data: telegramConn } = await db
    .from('telegram_connections')
    .select('chat_id, on_open, on_severity_increase, on_resolve')
    .eq('user_id', svc.user_id)
    .eq('active', true)
    .maybeSingle();

  const { data: discordConn } = await db
    .from('discord_connections')
    .select('webhook_url, on_open, on_severity_increase, on_resolve')
    .eq('user_id', svc.user_id)
    .maybeSingle();

  const { data: existing } = await db
    .from('incidents')
    .select('id, severity, timeline, trigger_check_type')
    .eq('service_id', svc.id)
    .in('status', ['open', 'acknowledged'])
    .maybeSingle();

  // 6. Incident logic
  let incidentStillOpen = existing != null;

  if (failed && failuresForIncident >= 2) {
    const newSeverity = service_status === 'critical' ? 'critical' : 'degraded';

    if (!existing) {
      const { data: incident } = await db.from('incidents').insert({
        service_id: svc.id,
        user_id: svc.user_id,
        severity: newSeverity,
        failure_stage: result.failure_stage!,
        triggering_check_id: check.id,
        trigger_check_type: result.check_type,
        timeline: [{
          event: 'opened',
          at: now,
          actor: 'system',
          note: `${result.failure_stage} failed (${failuresForIncident} consecutive) via ${result.check_type} check`,
        }],
      }).select('id').single();
      incidentStillOpen = incident != null;

      if (incident && telegramConn?.on_open) {
        await sendTelegramAlert(
          telegramConn.chat_id,
          `🚨 <b>Incident opened</b> — ${svc.name}\nFailed stage: <code>${result.failure_stage}</code>\nSeverity: ${newSeverity}`
        );
      }
      if (incident && discordConn?.on_open) {
        await sendDiscordAlert(
          discordConn.webhook_url,
          `🚨 **Incident opened** — ${svc.name}\nFailed stage: \`${result.failure_stage}\`\nSeverity: ${newSeverity}`
        );
      }
    } else if (existing.severity === 'degraded' && newSeverity === 'critical') {
      const updatedTimeline = [
        ...existing.timeline,
        {
          event: 'escalated',
          at: now,
          actor: 'system',
          note: `Severity increased to critical`,
        },
      ];
      await db.from('incidents').update({
        severity: 'critical',
        timeline: updatedTimeline,
      }).eq('id', existing.id);

      if (telegramConn?.on_severity_increase) {
        await sendTelegramAlert(
          telegramConn.chat_id,
          `⚠️ <b>Incident escalated</b> — ${svc.name}\nSeverity increased to <b>critical</b>\nFailed stage: <code>${result.failure_stage}</code>`
        );
      }
      if (discordConn?.on_severity_increase) {
        await sendDiscordAlert(
          discordConn.webhook_url,
          `⚠️ **Incident escalated** — ${svc.name}\nSeverity increased to **critical**\nFailed stage: \`${result.failure_stage}\``
        );
      }
    }
  } else if (!failed && existing) {
    const triggerType = (existing.trigger_check_type ?? 'full') as CheckType;

    // Only resolve if this check tier is >= the tier that opened the incident
    if (canResolveIncident(result.check_type, triggerType)) {
      await db.from('incidents').update({
        status: 'resolved',
        resolved_at: now,
        resolution_type: 'auto',
        timeline: [
          ...existing.timeline,
          { event: 'resolved', at: now, actor: 'system', note: `Check passed (${result.check_type})` },
        ],
      }).eq('id', existing.id);
      incidentStillOpen = false;

      if (telegramConn?.on_resolve) {
        await sendTelegramAlert(
          telegramConn.chat_id,
          `✅ <b>Incident resolved</b> — ${svc.name}\nService is operational again`
        );
      }
      if (discordConn?.on_resolve) {
        await sendDiscordAlert(
          discordConn.webhook_url,
          `✅ **Incident resolved** — ${svc.name}\nService is operational again`
        );
      }
    }
  }

  // 7. Service status
  if (!isReadiness) {
    // Paid checks see the full pipeline — they set status directly (as before)
    serviceUpdate.status = service_status;
  } else if (failed) {
    // Readiness failure: never downgrade a worse status found by a paid check
    serviceUpdate.status = worseStatus(svc.status, service_status);
  } else if (!incidentStillOpen && svc.consecutive_failures === 0) {
    // Readiness pass only restores "operational" when paid checks agree
    serviceUpdate.status = 'operational';
  }

  await db.from('services').update(serviceUpdate).eq('id', svc.id);
}

function nextCheckAt(intervalMinutes: number): string {
  return new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
}
