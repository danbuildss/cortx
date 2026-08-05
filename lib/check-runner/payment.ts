import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { X402PaymentTerms } from './types';

// USDC on Base mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

function getTestWalletKey(): `0x${string}` {
  const key = process.env.CORTX_TEST_WALLET_KEY;
  if (!key) throw new Error('CORTX_TEST_WALLET_KEY not set');
  if (!key.startsWith('0x') || key.length !== 66) {
    throw new Error('CORTX_TEST_WALLET_KEY must be a 0x-prefixed 32-byte hex string');
  }
  return key as `0x${string}`;
}

export async function getWalletBalance(address: `0x${string}`): Promise<string> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  return formatUnits(balance as bigint, USDC_DECIMALS);
}

export async function executePayment(
  paymentTerms: X402PaymentTerms,
  observedPrice: string
): Promise<{ txHash: string; walletAddress: string; amountPaid: string }> {
  const privateKey = getTestWalletKey();
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  // Find the USDC payment option
  const usdcOption = paymentTerms.accepts.find(
    (opt) =>
      opt.asset.toLowerCase() === USDC_ADDRESS.toLowerCase() ||
      opt.asset.toLowerCase() === 'usdc'
  );

  if (!usdcOption) {
    throw new Error('No USDC payment option found in payment terms');
  }

  const payTo = usdcOption.payTo as `0x${string}`;
  const amountInUnits = parseUnits(observedPrice, USDC_DECIMALS);

  // Check balance
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if ((balance as bigint) < amountInUnits) {
    throw new Error(
      `INSUFFICIENT_BALANCE: wallet has ${formatUnits(balance as bigint, USDC_DECIMALS)} USDC, need ${observedPrice}`
    );
  }

  const txHash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [payTo, amountInUnits],
  });

  // Wait for confirmation (up to 30s)
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 30_000,
  });

  if (receipt.status !== 'success') {
    throw new Error('PAYMENT_REJECTED: transaction reverted');
  }

  return {
    txHash,
    walletAddress: account.address,
    amountPaid: observedPrice,
  };
}

export function getWalletAddress(): `0x${string}` {
  const account = privateKeyToAccount(getTestWalletKey());
  return account.address;
}
