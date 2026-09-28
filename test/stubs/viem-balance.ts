// Test stub for `viem` as seen by lib/check-runner/payment.ts: everything is
// real viem except the public client, whose balance read returns a fixed
// balance (default 1,000 USDC; override with TEST_USDC_BALANCE_ATOMIC).
export * from 'viem';

export function createPublicClient() {
  return { readContract: async () => BigInt(process.env.TEST_USDC_BALANCE_ATOMIC ?? '1000000000') };
}
