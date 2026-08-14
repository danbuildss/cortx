import { createClient } from '@supabase/supabase-js';
import { classifyStatus } from './classify';
import { sendTelegramAlert } from '../telegram';
import type { CheckResult, CheckType } from './types';

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
};

// Incident resolution hierarchy: a passing check only resolves incidents triggered
// by the same tier or lower. Lightweight never resolves; canary resolves canary;
// full resolves everything.
const CHECK_TIER: Record<CheckType, number> = {
  lightweight: 0,
  canary: 1,
  full: 2,
};

function canResolveIncident(passingType: CheckType, triggerType: CheckType): boolean {
  return CHECK_TIER[passingType] >= CHECK_TIER[triggerType];
}

export async function persistCheckResult(
  svc: ServiceRow,
  result: CheckResult
): Promise<void> {
  const db = serviceRoleClient();

  // 1. Insert check record
  const { data: check, error: insertErr } = await db
    .from('checks')
    .insert({
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
    })
    .select('id')
    .single();

  if (insertErr || !check) {
    console.error('Failed to insert check:', insertErr);
    return;
  }

  // 2. Build service update — freshness tracking per tier
  const now = new Date().toISOString();
  const freshnessUpdate: Record<string, string> = {
    last_checked_at: now,
  };

  if (result.check_type === 'lightweight') {
    freshnessUpdate.last_lightweight_check_at = now;
    freshnessUpdate.next_check_at = nextCheckAt(svc.lightweight_check_interval_minutes ?? svc.check_interval_minutes);
  } else {
    freshnessUpdate.last_paid_verification_at = now;
    freshnessUpdate.next_paid_verification_at = nextCheckAt(svc.paid_verification_interval_minutes ?? svc.check_interval_minutes);
    if (result.check_type === 'full') {
      freshnessUpdate.last_full_verification_at = now;
    }
  }

  // 3. Errors don't update service status or incidents
  if (result.status === 'error') {
    await db.from('services').update(freshnessUpdate).eq('id', svc.id);
    return;
  }

  // 4. Derive service status (only paid checks affect the displayed status)
  if (result.check_type === 'lightweight') {
    // Lightweight only updates the scheduler timestamp and freshness
    await db.from('services').update(freshnessUpdate).eq('id', svc.id);
    return;
  }

  const { service_status } = classifyStatus(
    result.stages,
    result.latency_ms ?? 0,
    svc.latency_threshold_ms
  );

  const newConsecutiveFailures =
    result.status === 'failed' ? svc.consecutive_failures + 1 : 0;

  await db.from('services').update({
    ...freshnessUpdate,
    status: service_status,
    consecutive_failures: newConsecutiveFailures,
  }).eq('id', svc.id);

  // 5. Fetch user's Telegram connection
  const { data: telegramConn } = await db
    .from('telegram_connections')
    .select('chat_id, on_open, on_severity_increase, on_resolve')
    .eq('user_id', svc.user_id)
    .eq('active', true)
    .maybeSingle();

  // 6. Incident logic
  if (result.status === 'failed' && newConsecutiveFailures >= 2) {
    const { data: existing } = await db
      .from('incidents')
      .select('id, severity, timeline, trigger_check_type')
      .eq('service_id', svc.id)
      .in('status', ['open', 'acknowledged'])
      .maybeSingle();

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
          note: `${result.failure_stage} failed (${newConsecutiveFailures} consecutive) via ${result.check_type} check`,
        }],
      }).select('id').single();

      if (incident && telegramConn?.on_open) {
        await sendTelegramAlert(
          telegramConn.chat_id,
          `🚨 <b>Incident opened</b> — ${svc.name}\nFailed stage: <code>${result.failure_stage}</code>\nSeverity: ${newSeverity}`
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
    }
  } else if (result.status === 'passed') {
    const { data: open } = await db
      .from('incidents')
      .select('id, timeline, trigger_check_type')
      .eq('service_id', svc.id)
      .in('status', ['open', 'acknowledged'])
      .maybeSingle();

    if (open) {
      const triggerType = (open.trigger_check_type ?? 'full') as CheckType;

      // Only resolve if this check tier is >= the tier that opened the incident
      if (canResolveIncident(result.check_type, triggerType)) {
        await db.from('incidents').update({
          status: 'resolved',
          resolved_at: now,
          resolution_type: 'auto',
          timeline: [
            ...open.timeline,
            { event: 'resolved', at: now, actor: 'system', note: `Check passed (${result.check_type})` },
          ],
        }).eq('id', open.id);

        if (telegramConn?.on_resolve) {
          await sendTelegramAlert(
            telegramConn.chat_id,
            `✅ <b>Incident resolved</b> — ${svc.name}\nService is operational again`
          );
        }
      }
    }
  }
}

function nextCheckAt(intervalMinutes: number): string {
  return new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
}
