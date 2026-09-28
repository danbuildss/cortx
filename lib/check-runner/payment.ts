import { randomBytes } from 'crypto';
import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { createPaymentHeader } from 'x402/client';
import { StageError } from './ssrf';
import { buildV2PaymentHeader, chainIdFor, type Eip3009Authorization, type PaymentOption, type X402Version } from './x402';

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
  if (!key) throw new StageError('WALLET_NOT_CONFIGURED', 'CORTX_TEST_WALLET_KEY not set');
  if (!key.startsWith('0x') || key.length !== 66) {
    throw new StageError('WALLET_NOT_CONFIGURED', 'CORTX_TEST_WALLET_KEY must be a 0x-prefixed 32-byte hex string');
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

export type SignedPayment = {
  /** Request header that carries the payment: V1 `X-PAYMENT`, V2 `PAYMENT-SIGNATURE` */
  headerName: 'X-PAYMENT' | 'PAYMENT-SIGNATURE';
  /** base64-encoded signed payment payload */
  headerValue: string;
  walletAddress: string;
  amountPaid: string;
};

function isUsdcAsset(asset: string): boolean {
  const a = asset.toLowerCase();
  return a === USDC_ADDRESS.toLowerCase() || a === 'usdc';
}

/**
 * Signs an x402 `exact` payment (EIP-3009 transferWithAuthorization) for the
 * chosen payment option. Nothing is sent on-chain here: the service's
 * facilitator verifies the signature and settles when the request is retried
 * with the payment header.
 *
 * V1 services: official x402 v1 client, sent as X-PAYMENT.
 * V2 services: same EIP-3009 authorization wrapped in the V2 PaymentPayload
 * envelope, sent as PAYMENT-SIGNATURE.
 * Spec: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md
 */
export async function executePayment(args: {
  option: PaymentOption;
  version: X402Version;
  resource: Record<string, unknown> | null;
  endpointUrl: string;
  observedPrice: string;
}): Promise<SignedPayment> {
  const { option, version, observedPrice } = args;
  const privateKey = getTestWalletKey();
  const account = privateKeyToAccount(privateKey);

  if (!isUsdcAsset(option.asset)) {
    throw new StageError('NO_USDC_OPTION', 'No USDC payment option found in payment terms');
  }
  // Bankr's flat format names the asset "USDC" instead of the contract address
  const asset = option.asset.toLowerCase() === 'usdc' ? USDC_ADDRESS : option.asset;

  const transferMethod = option.extra?.assetTransferMethod;
  if (option.scheme !== 'exact' || (transferMethod != null && transferMethod !== 'eip3009')) {
    // CORTX only implements exact/EIP-3009 — not the service's fault
    throw new StageError(
      'UNSUPPORTED_PAYMENT_METHOD',
      `CORTX does not support scheme "${option.scheme}"${transferMethod ? ` with ${String(transferMethod)}` : ''} yet`
    );
  }

  // Check balance before signing
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const amountUnits = parseUnits(observedPrice, USDC_DECIMALS);
  let balance: bigint;
  try {
    balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }) as bigint;
  } catch {
    throw new StageError('BALANCE_READ_FAILED', 'Could not read CORTX wallet balance from Base RPC');
  }

  if (balance < amountUnits) {
    throw new StageError(
      'INSUFFICIENT_BALANCE',
      `CORTX wallet has ${formatUnits(balance, USDC_DECIMALS)} USDC, need ${observedPrice}`
    );
  }

  const headerValue = version === 2
    ? await signV2(account, option, asset, args.resource ?? { url: args.endpointUrl })
    : await signV1(account, option, asset);

  return {
    headerName: version === 2 ? 'PAYMENT-SIGNATURE' : 'X-PAYMENT',
    headerValue,
    walletAddress: account.address,
    amountPaid: observedPrice,
  };
}

type LocalAccount = ReturnType<typeof privateKeyToAccount>;

async function signV1(account: LocalAccount, option: PaymentOption, asset: string): Promise<string> {
  // Normalize CAIP-2 → x402 short name ("eip155:8453" → "base")
  const network = CAIP2_TO_X402[option.network] ?? option.network;

  // extra.name / extra.version tell x402 what EIP-712 domain to sign against —
  // must match USDC's on-chain domain. Seed with USDC defaults then let the
  // server's own extra field override if present.
  const paymentRequirements = {
    scheme:            option.scheme,
    network,
    maxAmountRequired: option.amount,
    resource:          option.resource    ?? '',
    description:       option.description ?? '',
    mimeType:          option.mimeType    ?? 'application/json',
    payTo:             option.payTo,
    maxTimeoutSeconds: option.maxTimeoutSeconds ?? 300,
    asset,
    extra: {
      name:    'USD Coin',   // USDC EIP-712 domain name on Base
      version: '2',          // USDC EIP-712 domain version on Base
      ...option.extra,       // override with values from server if provided
    },
  };

  try {
    // LocalAccount satisfies x402's EvmSigner — pass directly (no wallet client needed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await createPaymentHeader(account as any, 1, paymentRequirements as any);
  } catch (err) {
    // Signing fails on malformed payment requirements from the service (bad payTo, amount, asset)
    throw new StageError('PAYMENT_SIGNING_FAILED', err instanceof Error ? err.message : String(err));
  }
}

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

// Exported for verification scripts; production callers use executePayment.
export async function signV2(
  account: LocalAccount,
  option: PaymentOption,
  asset: string,
  resource: Record<string, unknown>
): Promise<string> {
  try {
    const chainId = chainIdFor(option.network);
    if (chainId == null) throw new Error(`Unknown network ${option.network}`);

    const now = Math.floor(Date.now() / 1000);
    const authorization: Eip3009Authorization = {
      from: account.address,
      to: getAddress(option.payTo),
      value: BigInt(option.amount).toString(),
      validAfter: String(now - 600), // clock-skew buffer, same as the v1 client
      validBefore: String(now + (option.maxTimeoutSeconds ?? 60)),
      nonce: `0x${randomBytes(32).toString('hex')}`,
    };

    const signature = await account.signTypedData({
      types: EIP3009_TYPES,
      domain: {
        name: String(option.extra?.name ?? 'USD Coin'),
        version: String(option.extra?.version ?? '2'),
        chainId,
        verifyingContract: getAddress(asset),
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: getAddress(authorization.from),
        to: getAddress(authorization.to),
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce as `0x${string}`,
      },
    });

    return buildV2PaymentHeader({ resource, accepted: option.raw, signature, authorization });
  } catch (err) {
    throw new StageError('PAYMENT_SIGNING_FAILED', err instanceof Error ? err.message : String(err));
  }
}
