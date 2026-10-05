// Cori configuration from environment variables (validated). Secrets never logged.
import { z } from 'zod';

// Set at build time by agent/cori/build.mjs (git SHA); 'local' when run unbundled
declare const __CORI_VERSION__: string | undefined;
const BUILD_VERSION = typeof __CORI_VERSION__ === 'string' && __CORI_VERSION__ ? __CORI_VERSION__ : 'local';

// Cori holds no keys (brief §10). If one shows up in its environment, refuse
// to start rather than run next to it.
const FORBIDDEN_ENV = /(PRIVATE_KEY|SERVICE_ROLE|WALLET|MNEMONIC|SEED_PHRASE)/i;

export function assertNoSecrets(env: NodeJS.ProcessEnv): void {
  const found = Object.keys(env).filter((k) => FORBIDDEN_ENV.test(k) && (env[k] ?? '') !== '');
  if (found.length > 0) {
    throw new Error(`Refusing to start: Cori must not run with key material in its environment (${found.join(', ')})`);
  }
}

const ports = z.string().transform((v, ctx) => {
  const list = v.split(',').map((p) => Number(p.trim()));
  if (list.length === 0 || list.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) {
    ctx.addIssue({ code: 'custom', message: 'CORI_ALLOWED_PORTS must be a comma-separated list of ports' });
    return z.NEVER;
  }
  return list;
});

const bool = z.enum(['0', '1', 'true', 'false']).transform((v) => v === '1' || v === 'true');

const EnvSchema = z.object({
  CORI_DATABASE_URL: z.string().min(1),
  CORI_DB_SSL: z.enum(['require', 'disable']).default('require'),
  CORI_DRY_RUN: bool.default(false),
  CORI_MAX_ELIGIBLE_PRICE_USDC: z.coerce.number().positive().default(0.05),
  CORI_DAILY_QUEUE_CAP: z.coerce.number().int().min(0).default(25),
  CORI_PROBE_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
  CORI_PROBE_BATCH: z.coerce.number().int().min(1).default(200),
  CORI_PER_HOST_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(2000),
  CORI_PER_HOST_MAX_PER_HOUR: z.coerce.number().int().min(1).default(30),
  CORI_PROBE_RECHECK_HOURS: z.coerce.number().positive().default(24),
  CORI_BAZAAR_PAGE_LIMIT: z.coerce.number().int().min(1).max(1000).default(100),
  CORI_BAZAAR_MAX_PAGES: z.coerce.number().int().min(1).default(500),
  CORI_ALLOWED_PORTS: ports.default([443]),
  CORI_MAX_PROBES_PER_HOUR: z.coerce.number().int().min(1).default(600),
  CORI_VERSION: z.string().min(1).optional(),
  CORI_TICK_SECONDS: z.coerce.number().int().min(5).default(30),
  CORI_HEARTBEAT_SECONDS: z.coerce.number().int().min(30).default(300),
  CORI_USER_AGENT: z.string().default('CORTX-Cori/0.1 (+https://github.com/danbuildss/cortx)'),
});

export type CoriConfig = {
  databaseUrl: string;
  dbSsl: 'require' | 'disable';
  dryRun: boolean;
  maxEligiblePriceUsdc: number;
  dailyQueueCap: number;
  probeConcurrency: number;
  probeBatch: number;
  perHostMinIntervalMs: number;
  perHostMaxPerHour: number;
  probeRecheckHours: number;
  bazaarPageLimit: number;
  bazaarMaxPages: number;
  tickSeconds: number;
  heartbeatSeconds: number;
  userAgent: string;
  allowedPorts: number[];
  maxProbesPerHour: number;
  version: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CoriConfig {
  assertNoSecrets(env);
  const e = EnvSchema.parse(env);
  return {
    databaseUrl: e.CORI_DATABASE_URL,
    dbSsl: e.CORI_DB_SSL,
    dryRun: e.CORI_DRY_RUN,
    maxEligiblePriceUsdc: e.CORI_MAX_ELIGIBLE_PRICE_USDC,
    dailyQueueCap: e.CORI_DAILY_QUEUE_CAP,
    probeConcurrency: e.CORI_PROBE_CONCURRENCY,
    probeBatch: e.CORI_PROBE_BATCH,
    perHostMinIntervalMs: e.CORI_PER_HOST_MIN_INTERVAL_MS,
    perHostMaxPerHour: e.CORI_PER_HOST_MAX_PER_HOUR,
    probeRecheckHours: e.CORI_PROBE_RECHECK_HOURS,
    bazaarPageLimit: e.CORI_BAZAAR_PAGE_LIMIT,
    bazaarMaxPages: e.CORI_BAZAAR_MAX_PAGES,
    tickSeconds: e.CORI_TICK_SECONDS,
    heartbeatSeconds: e.CORI_HEARTBEAT_SECONDS,
    userAgent: e.CORI_USER_AGENT,
    allowedPorts: e.CORI_ALLOWED_PORTS,
    maxProbesPerHour: e.CORI_MAX_PROBES_PER_HOUR,
    version: e.CORI_VERSION ?? BUILD_VERSION,
  };
}

// Defaults without a database — used by tests and the dry-run memory store.
export function defaultConfig(overrides: Partial<CoriConfig> = {}): CoriConfig {
  return { ...loadConfig({ CORI_DATABASE_URL: 'unused' } as unknown as NodeJS.ProcessEnv), ...overrides };
}
