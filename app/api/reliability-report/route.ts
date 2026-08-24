import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { Resend } from 'resend';
import { runFullCheck } from '@/lib/check-runner/runner';
import type { ServiceConfig } from '@/lib/check-runner/types';

export const maxDuration = 65;

const MAX_PRICE_USDC = '0.10';
const RATE_LIMIT_PER_EMAIL_24H = 5;
const RATE_LIMIT_SAME_URL_EMAIL_24H = 1;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')).digest('hex').slice(0, 16);
}

function stageIcon(passed: boolean | null): string {
  if (passed === true) return '✓';
  if (passed === false) return '✗';
  return '·';
}

function stageColor(passed: boolean | null): string {
  if (passed === true) return '#22c55e';
  if (passed === false) return '#ef4444';
  return '#6b7280';
}

function buildEmailHtml(endpoint_url: string, result: Awaited<ReturnType<typeof runFullCheck>>): string {
  const overall = result.status;
  const overallColor = overall === 'passed' ? '#22c55e' : overall === 'failed' ? '#ef4444' : '#f59e0b';
  const overallLabel = overall === 'passed' ? 'All stages passed' : overall === 'failed' ? `Failed at ${result.failure_stage ?? 'unknown stage'}` : 'Error';

  const stageRows = (result.stages ?? []).map(s => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;font-family:monospace;color:${stageColor(s.passed)};width:20px">${stageIcon(s.passed)}</td>
      <td style="padding:8px 12px;font-size:13px;font-family:monospace;color:#f0f1f3">${s.stage}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;text-align:right">${s.duration_ms != null ? `${s.duration_ms}ms` : '—'}</td>
      <td style="padding:8px 12px;font-size:11px;color:${s.passed === false ? '#ef4444' : '#9ca3af'};max-width:300px">${s.error ?? (s.passed === null ? 'not reached' : '')}</td>
    </tr>
  `).join('');

  const latency = result.latency_ms != null ? `${result.latency_ms}ms` : '—';
  const price = result.observed_price != null ? `$${parseFloat(result.observed_price).toFixed(4)} USDC` : '—';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08090a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px">

    <div style="margin-bottom:32px">
      <span style="font-size:14px;font-weight:700;letter-spacing:0.08em;color:#f0f1f3">CORTX</span>
      <span style="font-size:13px;color:#4b5563;margin-left:8px">· x402 reliability check</span>
    </div>

    <div style="background:#111214;border:1px solid #1e2028;border-radius:8px;padding:24px;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${overallColor}"></div>
        <span style="font-size:16px;font-weight:600;color:${overallColor}">${overallLabel}</span>
      </div>
      <div style="font-size:12px;color:#4b5563;font-family:monospace;word-break:break-all;margin-bottom:16px">${endpoint_url}</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div>
          <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Total latency</div>
          <div style="font-size:14px;font-weight:500;color:#9ca3af;font-family:monospace">${latency}</div>
        </div>
        ${result.observed_price != null ? `
        <div>
          <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Price observed</div>
          <div style="font-size:14px;font-weight:500;color:#9ca3af;font-family:monospace">${price}</div>
        </div>` : ''}
      </div>
    </div>

    <div style="background:#111214;border:1px solid #1e2028;border-radius:8px;overflow:hidden;margin-bottom:32px">
      <div style="padding:12px 16px;border-bottom:1px solid #1e2028">
        <span style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:0.06em">Stage breakdown</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${stageRows}</tbody>
      </table>
    </div>

    ${overall !== 'passed' ? `
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:16px;margin-bottom:32px">
      <div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:6px">What this means</div>
      <div style="font-size:13px;color:#9ca3af;line-height:1.6">
        Your x402 endpoint failed at the <strong style="color:#f0f1f3">${result.failure_stage}</strong> stage.
        Users attempting to pay may encounter errors or silent failures.
        Set up continuous monitoring to catch regressions before your users do.
      </div>
    </div>` : `
    <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.18);border-radius:8px;padding:16px;margin-bottom:32px">
      <div style="font-size:13px;font-weight:600;color:#22c55e;margin-bottom:6px">All clear</div>
      <div style="font-size:13px;color:#9ca3af;line-height:1.6">
        Your endpoint passed all 7 stages. Set up continuous monitoring to get alerted the moment something breaks — before your users encounter it.
      </div>
    </div>`}

    <div style="text-align:center;margin-bottom:40px">
      <a href="https://usecortx.dev/signup" style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none">
        Monitor this endpoint continuously →
      </a>
      <div style="margin-top:12px;font-size:12px;color:#4b5563">Free to start · Real USDC checks on Base mainnet</div>
    </div>

    <div style="border-top:1px solid #1e2028;padding-top:20px;text-align:center">
      <a href="https://usecortx.dev" style="font-size:12px;color:#4b5563;text-decoration:none">usecortx.dev</a>
      <span style="color:#2a2d35;margin:0 8px">·</span>
      <span style="font-size:12px;color:#2a2d35">This report was generated by a real synthetic payment check on Base mainnet.</span>
    </div>

  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const endpoint_url = typeof body.endpoint_url === 'string' ? body.endpoint_url.trim() : '';
  const email        = typeof body.email        === 'string' ? body.email.trim().toLowerCase() : '';

  if (!endpoint_url) return NextResponse.json({ error: 'endpoint_url is required' }, { status: 400 });
  if (!email)        return NextResponse.json({ error: 'email is required' }, { status: 400 });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(endpoint_url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'endpoint_url must be a valid URL' }, { status: 400 });
  }

  // Block private/reserved IP ranges
  const host = parsedUrl.hostname;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0|localhost|::1)/i.test(host)) {
    return NextResponse.json({ error: 'Private or reserved URLs are not allowed' }, { status: 400 });
  }

  const supabase = db();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Rate limit: max RATE_LIMIT_PER_EMAIL_24H reports per email in 24h
  const { count: emailCount } = await supabase
    .from('reliability_report_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('requested_at', since24h);

  if ((emailCount ?? 0) >= RATE_LIMIT_PER_EMAIL_24H) {
    return NextResponse.json({ error: 'Rate limit: maximum 5 reports per email per 24 hours.' }, { status: 429 });
  }

  // Rate limit: max RATE_LIMIT_SAME_URL_EMAIL_24H per exact url+email combo in 24h
  const { count: dupeCount } = await supabase
    .from('reliability_report_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('endpoint_url', endpoint_url)
    .gte('requested_at', since24h);

  if ((dupeCount ?? 0) >= RATE_LIMIT_SAME_URL_EMAIL_24H) {
    return NextResponse.json({ error: 'You already requested a report for this URL in the last 24 hours. Check your email.' }, { status: 429 });
  }

  // IP-based rate limit (soft: 10 per IP per 24h)
  const forwardedFor = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const ipHash = hashIp(forwardedFor.split(',')[0].trim());

  const { count: ipCount } = await supabase
    .from('reliability_report_requests')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('requested_at', since24h);

  if ((ipCount ?? 0) >= 10) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
  }

  // Store the request
  const { data: record, error: insertError } = await supabase
    .from('reliability_report_requests')
    .insert({ endpoint_url, email, status: 'running', ip_hash: ipHash })
    .select('id')
    .single();

  if (insertError || !record) {
    console.error('[reliability-report] insert error:', insertError?.message);
    return NextResponse.json({ error: 'Failed to queue report. Please try again.' }, { status: 500 });
  }

  const reportId = record.id as string;

  // Run the check
  const config: ServiceConfig = {
    id: reportId,
    user_id: 'free-report',
    endpoint_url,
    test_input: {},
    expected_schema: null,
    expected_price: null,
    max_price: MAX_PRICE_USDC,
    latency_threshold_ms: null,
    environment: 'mainnet',
  };

  let checkResult: Awaited<ReturnType<typeof runFullCheck>>;
  let checkError: string | null = null;

  try {
    checkResult = await runFullCheck(config);
  } catch (err) {
    const walletKey = process.env.CORTX_TEST_WALLET_KEY ?? '__NEVER__';
    const rawMsg = err instanceof Error ? err.message : String(err);
    checkError = rawMsg.replaceAll(walletKey, '[REDACTED]');
    console.error('[reliability-report] check error:', checkError);
  }

  // Update record with result
  if (checkError) {
    await supabase
      .from('reliability_report_requests')
      .update({ status: 'failed', error_message: checkError, completed_at: new Date().toISOString() })
      .eq('id', reportId);

    return NextResponse.json({ error: 'Check failed to run. Please try again.' }, { status: 500 });
  }

  await supabase
    .from('reliability_report_requests')
    .update({
      status: 'completed',
      check_result: checkResult! as unknown as Record<string, unknown>,
      completed_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  // Send email
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const subject = checkResult!.status === 'passed'
        ? `✓ Your x402 endpoint is healthy — CORTX report`
        : `✗ Issues found in your x402 endpoint — CORTX report`;

      await resend.emails.send({
        from: 'CORTX <reports@usecortx.dev>',
        to: email,
        subject,
        html: buildEmailHtml(endpoint_url, checkResult!),
      });
    } catch (emailErr) {
      console.error('[reliability-report] email send error:', emailErr instanceof Error ? emailErr.message : emailErr);
    }
  }

  return NextResponse.json({
    id: reportId,
    status: checkResult!.status,
    failure_stage: checkResult!.failure_stage ?? null,
    latency_ms: checkResult!.latency_ms ?? null,
    observed_price: checkResult!.observed_price ?? null,
    stages: checkResult!.stages,
    email_sent: !!resendKey,
  });
}
