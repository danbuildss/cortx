// What a check ran against, stored with every check (checks.context) so it can
// be reconstructed later even after the service is edited — DATA COMPOUNDS,
// docs/DATA_COMPOUNDS.md (S4). Inputs are stored as a hash and size, never
// raw: test input is what the user typed and may contain secrets.
import { createHash } from 'crypto';
import { stableStringify } from '../cori/bazaar';

export type CheckContext = {
  endpoint_url: string;
  /** HTTP method that produced the 402 (null if the check never got that far) */
  method: string | null;
  environment: string | null;
  input_source: 'owner_provided' | 'none';
  /** sha256 of the canonical JSON of the test input; null when there is none */
  input_hash: string | null;
  input_bytes: number;
  schema_hash: string | null;
  max_price: string | null;
  expected_price: string | null;
};

const hash = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const isEmpty = (v: unknown) =>
  v == null || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

export function buildCheckContext(args: {
  endpoint_url: string;
  method?: string | null;
  environment?: string | null;
  test_input?: unknown;
  expected_schema?: unknown;
  max_price?: string | number | null;
  expected_price?: string | number | null;
}): CheckContext {
  const hasInput = !isEmpty(args.test_input);
  return {
    endpoint_url: args.endpoint_url,
    method: args.method ?? null,
    environment: args.environment ?? null,
    input_source: hasInput ? 'owner_provided' : 'none',
    input_hash: hasInput ? hash(args.test_input) : null,
    input_bytes: hasInput ? Buffer.byteLength(stableStringify(args.test_input)) : 0,
    schema_hash: isEmpty(args.expected_schema) ? null : hash(args.expected_schema),
    max_price: args.max_price == null || args.max_price === 'null' ? null : String(args.max_price),
    expected_price: args.expected_price == null || args.expected_price === 'null' ? null : String(args.expected_price),
  };
}

/** Which code judged a check: the deployed git commit on Vercel. */
export function runnerVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 12) : 'local';
}
