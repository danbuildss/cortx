// Cori — CORTX's autonomous reliability agent. Scout v0 (discovery only).
//
//   node agent/cori/dist/cori.mjs            run continuously (systemd)
//   node agent/cori/dist/cori.mjs --once     one full cycle, then exit
//   CORI_DRY_RUN=1 …                         read-only: nothing written except cori_runs
//
// Holds no wallet key and never pays. See docs/CORI_SCOUT_V0_SPEC.md.
import postgres from 'postgres';
import { loadConfig, type CoriConfig } from './config';
import { createLogger, type Logger } from './log';
import { HostLimiter } from './limiter';
import { MemoryStore } from './memory-store';
import { PgStore } from './pg-store';
import { runCycle, type Deps } from './pipeline';
import type { Store } from './store';

const LOCK_KEY = 4_020_402; // pg advisory lock: one Cori instance at a time

// Dry run: reads from the database, keeps all writes in memory, except the
// run log so the watchdog can see it's alive.
async function dryRunStore(pg: PgStore): Promise<Store> {
  const mem = new MemoryStore({
    lean: true,
    sources: await pg.loadSources(),
    denylist: [...(await pg.loadDenylist())],
    watchlist: [...(await pg.loadWatchlist())],
    known: await pg.loadKnown(),
  });
  mem.startRun = (kind) => pg.startRun(`dry:${kind}`);
  mem.finishRun = (id, ok, stats, error) => pg.finishRun(id, ok, stats, error);
  return mem;
}

async function summary(store: Store, log: Logger) {
  const classes = await store.countByClassification();
  const companies = await store.countCompanies();
  const sample = (await store.queueCompanies(10)).map((c) => ({
    company: c.domain, name: c.name, services: c.services_total, site_ok: c.site_ok,
    price_usdc: c.services[0]?.last_probe?.price_usdc ?? c.services[0]?.price_usdc ?? null,
  }));
  log.info('summary', { classes, companies, sample_companies: sample });
}

async function main() {
  const config: CoriConfig = loadConfig();
  const once = process.argv.includes('--once');
  const log = createLogger({ app: 'cori', dry_run: config.dryRun });

  const sql = postgres(config.databaseUrl, {
    ssl: config.dbSsl === 'require' ? 'require' : false,
    max: 4,
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  });

  // Single instance: the lock lives on a reserved connection for the whole run
  const lockConn = await sql.reserve();
  const [{ locked }] = await lockConn`select pg_try_advisory_lock(${LOCK_KEY}) as locked`;
  if (!locked) {
    log.warn('another_instance_running');
    lockConn.release();
    await sql.end();
    return;
  }

  const pg = new PgStore(sql, { version: config.version });
  const store = config.dryRun ? await dryRunStore(pg) : pg;
  const shutdown = new AbortController();
  const deps: Deps = {
    store,
    config,
    log,
    limiter: new HostLimiter(config.perHostMinIntervalMs, config.perHostMaxPerHour, {
      globalMaxPerHour: config.maxProbesPerHour, maxPerDay: config.perHostMaxPerDay,
    }),
    signal: shutdown.signal,
  };

  let stopping = false;
  const stop = (signal: string) => { log.info('stopping', { signal }); stopping = true; shutdown.abort(); };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));

  log.info('started', {
    mode: once ? 'once' : 'daemon', cori_version: config.version, max_price_usdc: config.maxEligiblePriceUsdc,
    daily_queue_cap: config.dailyQueueCap, allowed_ports: config.allowedPorts, max_probes_per_hour: config.maxProbesPerHour,
    per_host_max_per_day: config.perHostMaxPerDay, queue_per_host_per_day: config.queuePerHostPerDay,
    probe_recheck_hours: config.probeRecheckHours,
  });

  try {
    if (once || config.dryRun) {
      const stats = await runCycle(deps, { forceSources: true, maxProbeBatches: 50 });
      log.info('cycle_done', stats as unknown as Record<string, unknown>);
      await summary(store, log);
      return;
    }

    // Heartbeat on its own timer: a long first Bazaar pass (35k listings) must
    // not look like Cori went silent to the watchdog
    const beat = async () => {
      const id = await store.startRun('heartbeat').catch(() => null);
      if (id != null) await store.finishRun(id, true, {}).catch(() => {});
    };
    await beat();
    const heartbeat = setInterval(() => { void beat(); }, config.heartbeatSeconds * 1000);
    shutdown.signal.addEventListener('abort', () => clearInterval(heartbeat));

    while (!stopping) {
      const t0 = Date.now();
      try {
        await runCycle(deps);
      } catch (err) {
        // Stay alive through DB/network hiccups; systemd restarts on crash
        log.error('cycle_failed', { error: err instanceof Error ? err.message : String(err) });
      }
      const wait = Math.max(0, config.tickSeconds * 1000 - (Date.now() - t0));
      for (let waited = 0; waited < wait && !stopping; waited += 1000) {
        await new Promise((r) => setTimeout(r, Math.min(1000, wait - waited)));
      }
    }
  } finally {
    await lockConn`select pg_advisory_unlock(${LOCK_KEY})`.catch(() => {});
    lockConn.release();
    await sql.end({ timeout: 5 });
    log.info('stopped');
  }
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'fatal', error: err instanceof Error ? err.message : String(err) }) + '\n');
  process.exit(1);
});
