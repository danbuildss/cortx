/**
 * Canonical metric computation helpers.
 *
 * Single source of truth for reliability metrics across:
 *   /status/[userId]              — public user status page
 *   /status/service/[serviceId]  — public service status page
 *   /api/v1/reliability/[id]     — public reliability API
 *   /api/badge/[id]              — CORTX Monitored badge
 *
 * Metric definitions:
 *   Uptime         — passed / (passed + failed) over the window.
 *                    Infrastructure errors (status === 'error') are excluded
 *                    from both numerator and denominator.
 *   Paid delivery  — checks where both 'payment' AND 'delivery' stages passed.
 *                    Only checks that reached both stages are counted.
 *   Schema valid   — checks that reached 'schema_validation', where it passed.
 *   Median latency — full round-trip including payment signing.
 *                    Even-length arrays use the average of the two middle values.
 */

export type CheckRow = {
  status: string;
  latency_ms: number | null;
  stages: unknown;
};

export type ServiceMetrics = {
  /** 0–100 to one decimal place, or null if no eligible checks */
  uptime_percent: number | null;
  /** 0–100 to one decimal place, or null if no checks reached payment+delivery */
  paid_delivery_percent: number | null;
  /** 0–100 to one decimal place, or null if no checks reached schema_validation */
  schema_validity_percent: number | null;
  /** Median full round-trip latency in ms, or null if no data */
  median_latency_ms: number | null;
};

type StageRow = { stage: string; passed: boolean | null };

function parseStages(raw: unknown): Map<string, boolean | null> {
  if (!Array.isArray(raw)) return new Map();
  return new Map((raw as StageRow[]).map(s => [s.stage, s.passed]));
}

function roundPct(n: number, d: number): number | null {
  if (d === 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

export function medianLatency(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function computeMetrics(checks: CheckRow[]): ServiceMetrics {
  let uptimePassed = 0, uptimeTotal = 0;
  let deliveryPassed = 0, deliveryTotal = 0;
  let schemaPassed = 0, schemaTotal = 0;
  const latencies: number[] = [];

  for (const c of checks) {
    if (c.status === 'error') continue;

    uptimeTotal++;
    if (c.status === 'passed') uptimePassed++;
    if (c.latency_ms != null) latencies.push(c.latency_ms);

    const sm = parseStages(c.stages);

    const paymentOk  = sm.get('payment');
    const deliveryOk = sm.get('delivery');
    if (paymentOk !== undefined && deliveryOk !== undefined) {
      deliveryTotal++;
      if (paymentOk === true && deliveryOk === true) deliveryPassed++;
    }

    const schemaOk = sm.get('schema_validation');
    if (schemaOk !== undefined) {
      schemaTotal++;
      if (schemaOk === true) schemaPassed++;
    }
  }

  return {
    uptime_percent:          roundPct(uptimePassed, uptimeTotal),
    paid_delivery_percent:   roundPct(deliveryPassed, deliveryTotal),
    schema_validity_percent: roundPct(schemaPassed, schemaTotal),
    median_latency_ms:       medianLatency(latencies),
  };
}
