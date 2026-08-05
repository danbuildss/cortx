import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  toHex,
  pad,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { X402PaymentTerms } from './types';

// USDC on Base mainnet
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
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
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
 * Builds an x402-compliant X-Payment header using EIP-3009 transferWithAuthorization.
 * The server validates the signature and submits the on-chain transfer itself —
 * no transaction is sent from this side.
 */
export async function executePayment(
  paymentTerms: X402PaymentTerms,
  observedPrice: string
): Promise<{ txHash: string; walletAddress: string; amountPaid: string }> {
  const privateKey = getTestWalletKey();
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: base, transport: http() });

  // Find USDC payment option
  const usdcOption = paymentTerms.accepts.find(
    (opt) =>
      opt.asset?.toLowerCase() === USDC_ADDRESS.toLowerCase() ||
      opt.asset?.toLowerCase() === 'usdc'
  );

  if (!usdcOption) throw new Error('No USDC payment option found in payment terms');

  const payTo = usdcOption.payTo as `0x${string}`;
  const amountUnits = parseUnits(observedPrice, USDC_DECIMALS);

  // Check balance
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

  // EIP-3009: sign transferWithAuthorization
  // validBefore = 5 minutes from now
  const validAfter = BigInt(0);
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300);
  // Random 32-byte nonce
  const nonce = pad(toHex(BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))), { size: 32 });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const signature = await walletClient.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: base.id,
      verifyingContract: USDC_ADDRESS,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from',        type: 'address' },
        { name: 'to',          type: 'address' },
        { name: 'value',       type: 'uint256' },
        { name: 'validAfter',  type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce',       type: 'bytes32'  },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from:        account.address,
      to:          payTo,
      value:       amountUnits,
      validAfter,
      validBefore,
      nonce:       nonce as `0x${string}`,
    },
  });

  // Normalize CAIP-2 network identifiers to short names expected by facilitators
  const NETWORK_SHORT: Record<string, string> = {
    'eip155:8453': 'base',
    'eip155:84532': 'base-sepolia',
  };
  const networkShort = NETWORK_SHORT[usdcOption.network] ?? usdcOption.network ?? 'base';

  // Build x402 payment payload (Coinbase standard format)
  const paymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: networkShort,
    payload: {
      signature,
      authorization: {
        from:        account.address,
        to:          payTo,
        value:       amountUnits.toString(),
        validAfter:  validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

  return {
    txHash: paymentHeader, // used as X-PAYMENT header value
    walletAddress: account.address,
    amountPaid: observedPrice,
  };
}
