export type StageName =
  | 'availability'
  | 'payment_terms'
  | 'price_check'
  | 'payment'
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
};

export type ServiceConfig = {
  id: string;
  user_id: string;
  endpoint_url: string;
  test_input: Record<string, unknown>;
  expected_schema: Record<string, unknown>;
  expected_price: string;
  max_price: string;
  latency_threshold_ms: number;
  environment: 'mainnet' | 'testnet';
};

export type X402PaymentTerms = {
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
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
