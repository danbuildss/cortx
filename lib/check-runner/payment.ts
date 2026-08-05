import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { createPaymentHeader } from 'x402/client';
import type { X402PaymentTerms } from './types';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// CAIP-2 chain IDs → x402 short network names expected by the reference client
const CAIP2_TO_X402: Record<string, string> = {
  'eip155:8453':  'base',
  'eip155:84532': 'base-sepolia',
};

function getTestWalletKey(): `0x${string}` {
  const key = process.env.CORTX_TEST_WALLET_KEY;
  if (!key) throw new Error('CORTX_TEST_WALLET_KEY not set');
  if (!key.startsWith('0x') || key.length !== 66) {
    throw new Error('CORTX_TEST_WALLET_KEY must be a 0x-prefixed 32-byte hex string');
  }
  return key as `0x${string}`;
}

export function getWalletAddress(): `0x${string}` {
  return privateKeyToAccount(getTestWalletKey()).address;
}

export async function getWalletBalance(address: `0x${string}`): Promise<string> {
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  return formatUnits(balance as bigint, USDC_DECIMALS);
}

/**
 * Builds an x402-compliant X-Payment header using the official x402 client.
 * Uses EIP-3009 transferWithAuthorization; the server's facilitator validates
 * the signature and submits the on-chain transfer — no transaction sent here.
 */
export async function executePayment(
  paymentTerms: X402PaymentTerms,
  observedPrice: string
): Promise<{ txHash: string; walletAddress: string; amountPaid: string }> {
  const privateKey = getTestWalletKey();
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: base, transport: http() });

  // Find USDC accept option
  const rawOption = paymentTerms.accepts.find(
    (opt) =>
      opt.asset?.toLowerCase() === USDC_ADDRESS.toLowerCase() ||
      opt.asset?.toLowerCase() === 'usdc'
  );

  if (!rawOption) throw new Error('No USDC payment option found in payment terms');

  // Check balance before signing
  const amountUnits = parseUnits(observedPrice, USDC_DECIMALS);
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if ((balance as bigint) < amountUnits) {
    throw new Error(
      `INSUFFICIENT_BALANCE: wallet has ${formatUnits(balance as bigint, USDC_DECIMALS)} USDC, need ${observedPrice}`
    );
  }

  // Normalize CAIP-2 → x402 short name ("eip155:8453" → "base")
  const network = CAIP2_TO_X402[rawOption.network] ?? rawOption.network;

  // Build PaymentRequirements in the shape x402/client expects.
  // extra.name / extra.version tell x402 what EIP-712 domain to sign against —
  // must match USDC's on-chain domain. Seed with USDC defaults then let the
  // server's own extra field override if present.
  const paymentRequirements = {
    scheme:            rawOption.scheme           ?? 'exact',
    network,
    maxAmountRequired: rawOption.maxAmountRequired,
    resource:          rawOption.resource          ?? '',
    description:       rawOption.description       ?? '',
    mimeType:          rawOption.mimeType          ?? 'application/json',
    payTo:             rawOption.payTo as string,
    maxTimeoutSeconds: rawOption.maxTimeoutSeconds ?? 300,
    asset:             rawOption.asset as string,
    extra: {
      name:    'USD Coin',   // USDC EIP-712 domain name on Base
      version: '2',          // USDC EIP-712 domain version on Base
      ...rawOption.extra,    // override with values from server if provided
    },
  };

  // LocalAccount satisfies x402's EvmSigner — pass directly (no wallet client needed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentHeader = await createPaymentHeader(account as any, 1, paymentRequirements as any);

  return {
    txHash: paymentHeader,  // base64-encoded signed x402 payment payload
    walletAddress: account.address,
    amountPaid: observedPrice,
  };
}
