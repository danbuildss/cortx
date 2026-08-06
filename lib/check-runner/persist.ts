import { createClient } from '@supabase/supabase-js';
import { classifyStatus } from './classify';
import { sendTelegramAlert } from '../telegram';
import type { CheckResult } from './types';

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
};

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
    })
    .select('id')
    .single();

  if (insertErr || !check) {
    console.error('Failed to insert check:', insertErr);
    return;
  }

  // 2. Errors don't update service status or incidents
  if (result.status === 'error') {
    await db.from('services').update({
      next_check_at: nextCheckAt(svc.check_interval_minutes),
      last_checked_at: new Date().toISOString(),
    }).eq('id', svc.id);
    return;
  }

  // 3. Derive service status
  const { service_status } = classifyStatus(
    result.stages,
    result.latency_ms ?? 0,
    svc.latency_threshold_ms
  );

  const newConsecutiveFailures =
    result.status === 'failed' ? svc.consecutive_failures + 1 : 0;

  await db.from('services').update({
    status: service_status,
    consecutive_failures: newConsecutiveFailures,
    last_checked_at: new Date().toISOString(),
    next_check_at: nextCheckAt(svc.check_interval_minutes),
  }).eq('id', svc.id);

  // 4. Fetch user's Telegram connection
  const { data: telegramConn } = await db
    .from('telegram_connections')
    .select('chat_id, on_open, on_severity_increase, on_resolve')
    .eq('user_id', svc.user_id)
    .eq('active', true)
    .maybeSingle();

  // 5. Incident logic
  if (result.status === 'failed' && newConsecutiveFailures >= 2) {
    // Check for existing open incident
    const { data: existing } = await db
      .from('incidents')
      .select('id, severity, timeline')
      .eq('service_id', svc.id)
      .in('status', ['open', 'acknowledged'])
      .maybeSingle();

    const newSeverity = service_status === 'critical' ? 'critical' : 'degraded';

    if (!existing) {
      // Open new incident
      const { data: incident } = await db.from('incidents').insert({
        service_id: svc.id,
        user_id: svc.user_id,
        severity: newSeverity,
        failure_stage: result.failure_stage!,
        triggering_check_id: check.id,
        timeline: [{
          event: 'opened',
          at: new Date().toISOString(),
          actor: 'system',
          note: `${result.failure_stage} failed (${newConsecutiveFailures} consecutive)`,
        }],
      }).select('id').single();

      if (incident && telegramConn?.on_open) {
        await sendTelegramAlert(
          telegramConn.chat_id,
          `🚨 <b>Incident opened</b> — ${svc.name}\nFailed stage: <code>${result.failure_stage}</code>\nSeverity: ${newSeverity}`
        );
      }
    } else if (existing.severity === 'degraded' && newSeverity === 'critical') {
      // Severity escalation
      const updatedTimeline = [
        ...existing.timeline,
        {
          event: 'escalated',
          at: new Date().toISOString(),
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
    // Resolve any open incident
    const { data: open } = await db
      .from('incidents')
      .select('id, timeline')
      .eq('service_id', svc.id)
      .in('status', ['open', 'acknowledged'])
      .maybeSingle();

    if (open) {
      await db.from('incidents').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_type: 'auto',
        timeline: [
          ...open.timeline,
          { event: 'resolved', at: new Date().toISOString(), actor: 'system', note: 'Check passed' },
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

function nextCheckAt(intervalMinutes: number): string {
  return new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
}
