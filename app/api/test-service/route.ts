import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { base } from 'viem/chains';

// USDC on Base mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
const USDC_DECIMALS = 6;

// Test service payee address (read from env — the test wallet itself, for circular testing)
function getPayeeAddress(): string {
  return process.env.CORTX_TEST_PAYEE_ADDRESS ?? process.env.CORTX_TEST_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000001';
}

const SERVICE_PRICE = '0.001'; // 0.001 USDC per call — cheap for testing
const SERVICE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/test-service`
  : 'http://localhost:3000/api/test-service';

function paymentRequiredResponse(): NextResponse {
  const payeeAddress = getPayeeAddress();

  const body = {
    accepts: [
      {
        scheme: 'exact',
        network: 'base',
        maxAmountRequired: SERVICE_PRICE,
        resource: SERVICE_URL,
        description: 'CORTX test x402 service — healthy variant',
        mimeType: 'application/json',
        payTo: payeeAddress,
        maxTimeoutSeconds: 300,
        asset: USDC_ADDRESS,
        extra: { name: 'USDC', version: '2' },
      },
    ],
  };

  return NextResponse.json(body, { status: 402 });
}

async function verifyPayment(txHash: string, expectedAmount: string): Promise<boolean> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (receipt.status !== 'success') return false;

    // Check that the tx sent USDC to our payee address
    // We look at Transfer events in the receipt
    const payeeAddress = getPayeeAddress().toLowerCase();
    const expectedAmountWei = parseUnits(expectedAmount, USDC_DECIMALS);

    // ERC-20 Transfer event topic
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        log.topics[0] === transferTopic &&
        log.topics.length >= 3
      ) {
        const toAddress = `0x${log.topics[2]!.slice(26)}`.toLowerCase();
        const amount = BigInt(log.data);

        if (toAddress === payeeAddress && amount >= expectedAmountWei) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Healthy variant: returns actual JSON result after valid payment
export async function POST(req: NextRequest): Promise<NextResponse> {
  const paymentHeader = req.headers.get('x-payment');
  const variant = req.nextUrl.searchParams.get('variant') ?? 'healthy';

  // No payment header — return 402
  if (!paymentHeader) {
    return paymentRequiredResponse();
  }

  // Broken variant: always return empty body after payment (delivery failure)
  if (variant === 'broken') {
    return new NextResponse('', { status: 200 });
  }

  // Schema failure variant: return wrong shape
  if (variant === 'schema-fail') {
    return NextResponse.json({ wrong_field: 123, unexpected: true }, { status: 200 });
  }

  // Healthy variant: verify payment and return result
  // In development/testing, we accept any tx hash (skip on-chain verification)
  const skipVerify = process.env.CORTX_SKIP_PAYMENT_VERIFY === 'true';

  if (!skipVerify) {
    const valid = await verifyPayment(paymentHeader, SERVICE_PRICE);
    if (!valid) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 402 });
    }
  }

  const body = await req.json().catch(() => ({}));

  // Return a predictable JSON response for schema validation testing
  return NextResponse.json({
    result: 'success',
    query: body?.query ?? 'test',
    timestamp: new Date().toISOString(),
    service: 'cortx-test-healthy',
  });
}
