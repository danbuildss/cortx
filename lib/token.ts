const CORTX_TOKEN = '0x23ec691cf7f9a3166fa663c73f6f5a0c26a5aba3';
const BASE_RPC     = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';

export type Tier = 'free' | 'tier1' | 'tier2' | 'tier3' | 'tier4';

export const TIER_LIMITS: Record<Tier, number> = {
  free:  2,
  tier1: 5,   // 500K $CORTX
  tier2: 15,  // 1M $CORTX
  tier3: 50,  // 5M $CORTX
  tier4: Infinity, // 10M $CORTX
};

export const TIER_LABELS: Record<Tier, string> = {
  free:  'Free',
  tier1: '500K Holder',
  tier2: '1M Holder',
  tier3: '5M Holder',
  tier4: '10M Holder',
};

const TIER_THRESHOLDS: [Tier, bigint][] = [
  ['tier4', BigInt('10000000') * BigInt(1e18)],
  ['tier3', BigInt('5000000')  * BigInt(1e18)],
  ['tier2', BigInt('1000000')  * BigInt(1e18)],
  ['tier1', BigInt('500000')   * BigInt(1e18)],
];

export function getTier(balanceWei: bigint): Tier {
  for (const [tier, threshold] of TIER_THRESHOLDS) {
    if (balanceWei >= threshold) return tier;
  }
  return 'free';
}

export function getServiceLimit(tier: Tier, isAdmin: boolean): number {
  if (isAdmin) return Infinity;
  return TIER_LIMITS[tier];
}

export function canAddService(
  tier: Tier,
  isAdmin: boolean,
  currentCount: number,
): boolean {
  return currentCount < getServiceLimit(tier, isAdmin);
}

export async function getTokenBalance(walletAddress: string): Promise<bigint> {
  const data =
    '0x70a08231' +
    walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');

  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: CORTX_TOKEN, data }, 'latest'],
    }),
  });

  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC: ${json.error.message}`);

  const hex: string = json.result ?? '0x0';
  return BigInt(hex === '0x' ? '0x0' : hex);
}
