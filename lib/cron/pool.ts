/**
 * Runs `fn` over `items` with at most `concurrency` in flight, in input order,
 * and stops STARTING new items once `startBefore` (epoch ms) has passed.
 * Items never started are returned as `deferred` — for the cron they simply
 * stay due and are picked up by the next tick. Errors in `fn` are caught so
 * one bad item never stops the others.
 */
export type PoolOutcome<T, R> = {
  results: Array<{ item: T; value?: R; error?: unknown }>;
  deferred: T[];
};

export async function runPool<T, R>(
  items: T[],
  opts: { concurrency: number; startBefore: number; now?: () => number },
  fn: (item: T) => Promise<R>,
): Promise<PoolOutcome<T, R>> {
  const now = opts.now ?? Date.now;
  const results: PoolOutcome<T, R>['results'] = [];
  let next = 0;
  let stopped = false;

  async function worker(): Promise<void> {
    while (!stopped && next < items.length) {
      if (now() >= opts.startBefore) { stopped = true; return; }
      const item = items[next++];
      try {
        results.push({ item, value: await fn(item) });
      } catch (error) {
        results.push({ item, error });
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(opts.concurrency, items.length)) }, worker);
  await Promise.all(workers);
  return { results, deferred: items.slice(next) };
}
