export type CheckType = 'lightweight' | 'readiness' | 'canary' | 'full';

export type StageName =
  | 'availability'
  | 'payment_terms'
  | 'price_check'
  | 'payment'
  | 'facilitator_verify' // readiness checks only
  | 'delivery'
  | 'json_parse'
  | 'schema_validation';

export type StageResult = {
  stage: StageName;
  passed: boolean | null;
  duration_ms: number | null;
  evidence: Record<string, unknown> | null;
  error?: string;
};

export type CheckStatus = 'passed' | 'failed' | 'error';

export type CheckResult = {
  service_id: string;
  started_at: Date;
  completed_at: Date | null;
  latency_ms: number | null;
  status: CheckStatus;
  failure_stage: StageName | null;
  stages: StageResult[];
  observed_price: string | null;
  error_message: string | null;
  check_type: CheckType;
  /** Set when a payment gate decided not to pay: the free stages ran, the paid ones did not */
  paid_skipped?: { reason: string; message: string };
};

/**
 * Decides, just before paying, whether this check may spend money. Used by
 * the free /report (its own small budget); monitoring checks don't set one and
 * reserve from the platform budget as before. When a gate says yes it has
 * already reserved the budget, so the runner doesn't reserve again.
 */
export type PaymentGateDecision = { pay: true } | { pay: false; reason: string; message: string };
export type PaymentGate = (priceUsdc: number) => Promise<PaymentGateDecision>;

export type ServiceConfig = {
  id: string;
  user_id: string;
  endpoint_url: string;
  test_input: Record<string, unknown> | null;
  expected_schema: Record<string, unknown> | null;
  expected_price: string | null;
  max_price: string;
  latency_threshold_ms: number | null;
  environment: 'mainnet' | 'testnet';
  /** Optional: replaces the max-price checks and the platform budget reservation (see PaymentGate) */
  payment_gate?: PaymentGate;
};

export type CanaryConfig = {
  payload: Record<string, unknown>;
  expected_schema: Record<string, unknown>;
  max_price_usdc: string;
};

export type X402PaymentTerms = {
  accepts: Array<{
    scheme?: string;
    network: string;
    maxAmountRequired: string;
    resource?: string;
    description?: string;
    mimeType?: string;
    payTo: string;
    maxTimeoutSeconds?: number;
    asset: string;
    extra?: Record<string, unknown>;
  }>;
  error?: string;
};

export type ServiceStatus = 'operational' | 'degraded' | 'critical' | 'unknown';

export type ClassifyResult = {
  check_status: CheckStatus;
  service_status: ServiceStatus;
  failure_stage: StageName | null;
};
