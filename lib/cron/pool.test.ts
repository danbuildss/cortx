import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPool } from './pool.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('never more than `concurrency` in flight, all items run, starts in input order', async () => {
  let inFlight = 0;
  let peak = 0;
  const started: number[] = [];
  const out = await runPool([1, 2, 3, 4, 5, 6, 7], { concurrency: 3, startBefore: Date.now() + 60_000 }, async (n) => {
    started.push(n);
    inFlight++; peak = Math.max(peak, inFlight);
    await wait(15);
    inFlight--;
    return n * 10;
  });
  assert.equal(peak, 3);
  assert.deepEqual(started, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(out.results.map((r) => r.value).sort((a, b) => a! - b!), [10, 20, 30, 40, 50, 60, 70]);
  assert.deepEqual(out.deferred, []);
});

test('stops starting new items at the cut-off; the rest are deferred, not lost', async () => {
  // Each item takes 50 ms, two at a time, cut-off at 75 ms: a+b start at 0,
  // c+d at ~50, and e would start at ~100 — past the cut-off.
  const startBefore = Date.now() + 75;
  const out = await runPool(['a', 'b', 'c', 'd', 'e'], { concurrency: 2, startBefore }, async (x) => {
    await wait(50);
    return x;
  });
  assert.deepEqual(out.results.map((r) => r.item).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(out.deferred, ['e']);
});

test('nothing starts if the cut-off has already passed', async () => {
  const out = await runPool([1, 2], { concurrency: 2, startBefore: 0, now: () => 1 }, async (n) => n);
  assert.deepEqual(out.results, []);
  assert.deepEqual(out.deferred, [1, 2]);
});

test('an error in one item does not stop the others', async () => {
  const out = await runPool([1, 2, 3], { concurrency: 2, startBefore: Date.now() + 60_000 }, async (n) => {
    if (n === 2) throw new Error('boom');
    return n;
  });
  assert.equal(out.results.length, 3);
  assert.equal((out.results.find((r) => r.item === 2)!.error as Error).message, 'boom');
  assert.deepEqual(out.results.filter((r) => !r.error).map((r) => r.value).sort(), [1, 3]);
});

test('empty input is fine', async () => {
  const out = await runPool([], { concurrency: 3, startBefore: Date.now() + 1000 }, async () => 1);
  assert.deepEqual(out, { results: [], deferred: [] });
});
