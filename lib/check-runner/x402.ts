/**
 * Shared x402 protocol helpers: reading payment terms (V1 + V2), building the
 * V2 payment payload, and reading the settlement receipt.
 *
 * Spec: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
 * HTTP transport (V2): https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
 *   PAYMENT-REQUIRED  (server → client)  base64 JSON PaymentRequired
 *   PAYMENT-SIGNATURE (client → server)  base64 JSON PaymentPayload
 *   PAYMENT-RESPONSE  (server → client)  base64 JSON SettlementResponse
 * V1 equivalents: payment terms in the 402 body, X-PAYMENT, X-PAYMENT-RESPONSE.
 *
 * Pure functions only (no network, no wallet) so they can be unit tested.
 */

export type X402Version = 1 | 2;

export type PaymentOption = {
  scheme: string;
  network: string;
  /** Price exactly as the server sent it (V2 `amount`, V1 `maxAmountRequired`) */
  amount: string;
  /** Which field the price came from — V2 `amount` is always atomic units */
  amountField: 'amount' | 'maxAmountRequired';
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number | null;
  extra: Record<string, unknown> | null;
  resource?: string;
  description?: string;
  mimeType?: string;
  /** The option exactly as received — echoed back as `accepted` in a V2 payload */
  raw: Record<string, unknown>;
};

export type ParsedPaymentRequired = {
  version: X402Version;
  options: PaymentOption[];
  /** V2 ResourceInfo ({ url, description, mimeType }) when the server sent one */
  resource: Record<string, unknown> | null;
  source: 'body' | 'payment-required' | 'x-payment-required';
  /** The PaymentRequired object exactly as received */
  raw: Record<string, unknown>;
};

type HeaderGetter = { get(name: string): string | null };

// Header values may be plain JSON or base64 JSON (V2 mandates base64).
export function decodeHeaderJson(value: string | null | undefined): unknown {
  if (!value?.trim()) return null;
  const text = value.trim();
  try {
    return JSON.parse(text);
  } catch { /* not plain JSON — try base64 */ }
  try {
    return JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | undefined {
  return v == null || v === '' ? undefined : String(v);
}

function normalizeOption(opt: Record<string, unknown>): PaymentOption | null {
  const amountRaw = opt.amount ?? opt.maxAmountRequired;
  const network = str(opt.network);
  if (amountRaw == null && !network) return null;
  return {
    scheme: str(opt.scheme) ?? 'exact',
    network: network ?? '',
    amount: amountRaw == null ? '' : String(amountRaw),
    amountField: opt.amount != null ? 'amount' : 'maxAmountRequired',
    asset: str(opt.asset) ?? 'USDC',
    payTo: str(opt.payTo ?? opt.recipient) ?? '',
    maxTimeoutSeconds: typeof opt.maxTimeoutSeconds === 'number' ? opt.maxTimeoutSeconds : null,
    extra: asRecord(opt.extra),
    resource: str(opt.resource),
    description: str(opt.description),
    mimeType: str(opt.mimeType),
    raw: opt,
  };
}

function fromObject(
  obj: Record<string, unknown>,
  source: ParsedPaymentRequired['source']
): ParsedPaymentRequired | null {
  let options: PaymentOption[] = [];
  if (Array.isArray(obj.accepts)) {
    options = (obj.accepts as unknown[])
      .map((o) => asRecord(o))
      .filter((o): o is Record<string, unknown> => o != null)
      .map(normalizeOption)
      .filter((o): o is PaymentOption => o != null);
  } else {
    // Flat format (Bankr): { network, maxAmountRequired|amount, payTo|recipient, asset }
    const flat = normalizeOption(obj);
    if (flat) options = [flat];
  }
  if (options.length === 0) return null;

  const declared = Number(obj.x402Version);
  const version: X402Version =
    declared === 2 || (declared !== 1 && source === 'payment-required') ? 2 : 1;

  return { version, options, resource: asRecord(obj.resource), source, raw: obj };
}

// Reads payment terms from a 402 response. The body takes precedence (it's
// where V1 puts them), then the V2 PAYMENT-REQUIRED header, then the legacy
// X-PAYMENT-REQUIRED header some gateways (Bankr) use.
export function parsePaymentRequired(body: string, headers: HeaderGetter): ParsedPaymentRequired | null {
  const candidates: Array<[unknown, ParsedPaymentRequired['source']]> = [
    [safeJson(body), 'body'],
    [decodeHeaderJson(headers.get('payment-required')), 'payment-required'],
    [decodeHeaderJson(headers.get('x-payment-required')), 'x-payment-required'],
  ];
  for (const [value, source] of candidates) {
    const obj = asRecord(value);
    if (!obj) continue;
    const parsed = fromObject(obj, source);
    if (parsed) return parsed;
  }
  return null;
}

function safeJson(text: string): unknown {
  if (!text?.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const USDC_DECIMALS = 6;

// Converts the advertised price to USDC.
// V2 `amount` is always atomic units. V1 `maxAmountRequired` is atomic per the
// spec, but some V1 gateways send decimal USDC ("0.001"), so an integer >= 1
// is treated as atomic and anything else as decimal.
export function priceToUsdc(option: Pick<PaymentOption, 'amount' | 'amountField'>): {
  usdc: number;
  atomic: boolean;
} | null {
  const n = Number(option.amount);
  if (!option.amount || !Number.isFinite(n)) return null;
  const atomic = option.amountField === 'amount' || (n >= 1 && Number.isInteger(n));
  return { usdc: atomic ? n / 10 ** USDC_DECIMALS : n, atomic };
}

// Exact amount to authorize, in atomic USDC units (what EIP-3009 `value` must be).
export function atomicAmount(option: Pick<PaymentOption, 'amount' | 'amountField'>): bigint | null {
  const price = priceToUsdc(option);
  if (!price) return null;
  if (price.atomic) {
    try { return BigInt(option.amount); } catch { return null; }
  }
  return BigInt(Math.round(price.usdc * 10 ** USDC_DECIMALS));
}

// ─── Facilitator (readiness checks) ─────────────────────────────────────────

// The x402 spec keeps the facilitator opaque to clients, so only services that
// publish it can get a readiness check. Looks where gateways put it in practice:
// option.extra, the option itself, then the PaymentRequired root (Bankr).
export function findFacilitatorUrl(parsed: ParsedPaymentRequired, option: PaymentOption): string | null {
  const candidates = [
    option.extra?.facilitator, option.extra?.facilitatorUrl,
    option.raw.facilitator, option.raw.facilitatorUrl,
    parsed.raw.facilitator, parsed.raw.facilitatorUrl,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    try {
      const url = new URL(c);
      if (url.protocol === 'https:') return url.toString().replace(/\/+$/, '');
    } catch { /* not a URL */ }
  }
  return null;
}

// Facilitator /verify rejections (x402 v2 spec §9) that mean the service is
// misconfigured. Everything else — including signature, amount, timing and
// balance problems — could be CORTX building the payment wrong, so it is
// recorded as a CORTX-side error and never counted against the service.
const SERVICE_SIDE_VERIFY_REASONS = new Set([
  'invalid_exact_evm_payload_recipient_mismatch',
  'invalid_network',
  'invalid_payment_requirements',
  'invalid_scheme',
  'unsupported_scheme',
]);

export function isServiceSideVerifyRejection(reason: string | null | undefined): boolean {
  return reason != null && SERVICE_SIDE_VERIFY_REASONS.has(reason);
}

// ─── Option selection (shared by the runner, readiness and Cori Scout) ──────

export const USDC_BASE_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // lowercase

// Accept both short names ("base") and CAIP-2 ("eip155:8453")
export const NETWORK_ALIASES: Record<'mainnet' | 'testnet', string[]> = {
  mainnet: ['base', 'eip155:8453'],
  testnet: ['base-sepolia', 'eip155:84532'],
};

export function isUsdcAsset(asset: string): boolean {
  const a = asset.toLowerCase();
  return a === 'usdc' || a === USDC_BASE_ADDRESS;
}

// The option CORTX would pay: on the environment's Base network, preferring USDC
// when a service offers several assets there.
export function selectPaymentOption(
  options: PaymentOption[],
  environment: 'mainnet' | 'testnet' = 'mainnet'
): PaymentOption | undefined {
  const accepted = NETWORK_ALIASES[environment] ?? NETWORK_ALIASES.mainnet;
  const onNetwork = options.filter((o) => accepted.includes(o.network));
  return onNetwork.find((o) => isUsdcAsset(o.asset)) ?? onNetwork[0];
}

// ─── Networks ───────────────────────────────────────────────────────────────

const CHAIN_IDS: Record<string, number> = {
  'base': 8453,
  'eip155:8453': 8453,
  'base-sepolia': 84532,
  'eip155:84532': 84532,
};

export function chainIdFor(network: string): number | null {
  return CHAIN_IDS[network] ?? null;
}

export function explorerTxUrl(network: string | null | undefined, txHash: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  const chainId = network ? chainIdFor(network) : 8453;
  if (chainId === 8453) return `https://basescan.org/tx/${txHash}`;
  if (chainId === 84532) return `https://sepolia.basescan.org/tx/${txHash}`;
  return null;
}

// ─── V2 payment payload ─────────────────────────────────────────────────────

export type Eip3009Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

// Builds the base64 PAYMENT-SIGNATURE header value for the V2 `exact` EVM
// scheme (EIP-3009). `accepted` echoes the chosen requirement exactly as the
// server sent it.
export function buildV2PaymentHeader(args: {
  resource: Record<string, unknown>;
  accepted: Record<string, unknown>;
  signature: string;
  authorization: Eip3009Authorization;
}): string {
  const payload = {
    x402Version: 2,
    resource: args.resource,
    accepted: args.accepted,
    payload: {
      signature: args.signature,
      authorization: args.authorization,
    },
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

// ─── Settlement receipt ─────────────────────────────────────────────────────

export type SettlementEvidence = {
  status: 'confirmed' | 'failed' | 'unconfirmed';
  tx_hash: string | null;
  network: string | null;
  explorer_url: string | null;
  error_reason: string | null;
  receipt_header: 'PAYMENT-RESPONSE' | 'X-PAYMENT-RESPONSE' | null;
};

// Reads the server's settlement receipt. "unconfirmed" means the server sent
// no readable receipt — the data may have arrived, but there is no proof the
// money moved on-chain.
export function readSettlement(headers: HeaderGetter): SettlementEvidence {
  const v2 = headers.get('payment-response');
  const v1 = headers.get('x-payment-response');
  const receipt = asRecord(decodeHeaderJson(v2 ?? v1));
  const receipt_header = v2 ? 'PAYMENT-RESPONSE' : v1 ? 'X-PAYMENT-RESPONSE' : null;

  if (!receipt) {
    return { status: 'unconfirmed', tx_hash: null, network: null, explorer_url: null, error_reason: null, receipt_header };
  }

  const tx = str(receipt.transaction ?? receipt.txHash ?? receipt.transactionHash) ?? null;
  const network = str(receipt.network) ?? null;
  const success = receipt.success === true || (receipt.success == null && tx != null);

  return {
    status: success && tx ? 'confirmed' : success ? 'unconfirmed' : 'failed',
    tx_hash: tx,
    network,
    explorer_url: tx ? explorerTxUrl(network, tx) : null,
    error_reason: str(receipt.errorReason) ?? null,
    receipt_header,
  };
}
