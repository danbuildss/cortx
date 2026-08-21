import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateAndResolveUrl } from '@/lib/check-runner/ssrf';

export const maxDuration = 20;

function inferSchema(obj: unknown, depth = 0): Record<string, unknown> {
  if (depth > 4) return {};
  if (obj === null) return { type: 'null' };
  if (Array.isArray(obj)) return { type: 'array', items: obj.length > 0 ? inferSchema(obj[0], depth + 1) : {} };
  if (typeof obj === 'object') {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      props[k] = inferSchema(v, depth + 1);
    }
    return { type: 'object', properties: props };
  }
  if (typeof obj === 'string') return { type: 'string' };
  if (typeof obj === 'number') return { type: 'number' };
  if (typeof obj === 'boolean') return { type: 'boolean' };
  return {};
}

function parsePriceToUsdc(raw: string): number {
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0) return 0;
  // x402v2 sends atomic units (6 decimals), e.g. "1000" = $0.001
  return n >= 1 && Number.isInteger(n) ? n / 1_000_000 : n;
}

function slugToName(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? url.hostname;
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  let validatedUrl: URL;
  try {
    validatedUrl = await validateAndResolveUrl(url);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid URL' }, { status: 400 });
  }

  const detected: Record<string, unknown> = {
    endpoint_url: validatedUrl.toString(),
    method: 'POST',
    name: slugToName(validatedUrl),
  };
  const missing: string[] = [];
  let _debugStatus = 0;
  let _debugBody = '';
  let _debugHeader = '';
  let _debugOpt: unknown = null;
  let _debugHeaderLen = 0;

  type PaymentOpt = {
    network?: string; chainId?: string | number;
    maxAmountRequired?: string | number; amount?: string | number;
    maxAmount?: string | number; price?: string | number;
    payTo?: string; recipient?: string; to?: string;
    address?: string; paymentAddress?: string;
    asset?: string; description?: string; resource?: string;
    outputSchema?: Record<string, unknown>;
    extra?: { name?: string; description?: string; [k: string]: unknown };
  };
  type BodyTerms = {
    accepts?: PaymentOpt[]; paymentOptions?: PaymentOpt[];
    requirements?: PaymentOpt[]; options?: PaymentOpt[];
    description?: string; error?: string;
    resource?: { description?: string; url?: string; mimeType?: string };
  };

  // Parse a raw string (body or header value) into a PaymentOpt + BodyTerms pair.
  // Handles x402v1 accepts[] envelope, flat Bankr header format, alternative key
  // names used by Python/custom x402 servers, and header scheme prefixes.
  function parsePaymentTerms(raw: string): { opt: PaymentOpt | null; terms: BodyTerms | null } {
    if (!raw?.trim()) return { opt: null, terms: null };

    // Build candidates: original, with scheme prefix stripped (e.g. "x402 {...}"),
    // and a base64-decoded attempt (handles standard base64 and base64url).
    const stripped = raw.replace(/^[A-Za-z0-9_-]+\s+/, '');
    const candidates = [raw, stripped];
    // Always try base64 decode — convert base64url (-/_) to standard (+//) first,
    // then add padding if needed. x402 V2 uses base64url in the PAYMENT-REQUIRED header.
    if (stripped.trim().length >= 20) {
      try {
        const b64 = stripped.trim().replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        candidates.push(Buffer.from(padded, 'base64').toString('utf8'));
      } catch { /* ignore */ }
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (!parsed || typeof parsed !== 'object') continue;

        if (Array.isArray(parsed)) {
          // Direct array of payment options
          if (parsed.length > 0) return { opt: parsed[0] as PaymentOpt, terms: null };
          continue;
        }

        // Envelope formats — check all known array key names
        for (const key of ['accepts', 'paymentOptions', 'requirements', 'options'] as const) {
          const arr = (parsed as Record<string, unknown>)[key];
          if (Array.isArray(arr) && arr.length > 0) {
            return { opt: arr[0] as PaymentOpt, terms: parsed as BodyTerms };
          }
        }

        // Flat format — the object itself is the payment option.
        // Only accept if it has at least one recognized payment field; an empty
        // body like {} would otherwise shadow a valid header opt.
        const paymentFields = ['network','chainId','maxAmountRequired','amount','maxAmount','price','payTo','recipient','to','address','paymentAddress','asset'];
        if (paymentFields.some(k => (parsed as Record<string,unknown>)[k] != null)) {
          return { opt: parsed as PaymentOpt, terms: null };
        }
      } catch { /* ignore */ }
    }

    return { opt: null, terms: null };
  }

  async function readBodyCapped(res: Response): Promise<string> {
    try {
      const text = await res.text();
      return text.length > 65_536 ? '' : text;
    } catch { return ''; }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      // Try POST first; if it doesn't return 402 fall back to GET — some x402
      // endpoints (e.g. Bankr price-quote style) only gate on GET requests.
      const baseHeaders = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      response = await fetch(validatedUrl.toString(), {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      if (response.status !== 402) {
        const getResp = await fetch(validatedUrl.toString(), {
          method: 'GET',
          headers: baseHeaders,
          signal: controller.signal,
        });
        if (getResp.status === 402) response = getResp;
      }
      // OpenAI-compatible inference endpoints (e.g. Surplus Intelligence) require a
      // valid request body to surface the 402 — empty POST and bare GET both return 400.
      if (response.status !== 402) {
        const llmResp = await fetch(validatedUrl.toString(), {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({
            model: 'x402-detect',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
          signal: controller.signal,
        });
        if (llmResp.status === 402) response = llmResp;
      }
    } finally {
      clearTimeout(timer);
    }

    _debugStatus = response.status;

    if (response.status === 402) {
      const rawBody = await readBodyCapped(response);
      _debugBody = rawBody.slice(0, 500);

      // Parse body and payment headers; body accepts[] takes precedence.
      // Check multiple header names used across x402 implementations.
      const { opt: bodyOpt, terms: bodyTerms } = parsePaymentTerms(rawBody);
      const xPayHeader =
        response.headers.get('payment-required') ??    // x402 V2 spec (base64 JSON)
        response.headers.get('x-payment-required') ??
        response.headers.get('x-payment') ??
        response.headers.get('www-authenticate') ??
        '';
      _debugHeader = xPayHeader.slice(0, 2000);
      _debugHeaderLen = xPayHeader.length;
      const { opt: headerOpt, terms: headerTerms } = parsePaymentTerms(xPayHeader);

      const opt  = bodyOpt  ?? headerOpt;
      const terms = bodyTerms ?? headerTerms;
      _debugOpt = opt;

      if (opt) {
        // Network — check opt.network and opt.chainId; normalise to lowercase
        const rawNet = String(opt.network ?? opt.chainId ?? '').toLowerCase().trim();
        if (rawNet === 'eip155:8453' || rawNet === 'base' || rawNet === 'base-mainnet' || rawNet === '8453') {
          detected.environment = 'mainnet';
          detected.network_display = 'Base Mainnet';
        } else if (rawNet === 'eip155:84532' || rawNet === 'base-sepolia' || rawNet === 'basesepolia' || rawNet === '84532') {
          detected.environment = 'testnet';
          detected.network_display = 'Base Sepolia (Testnet)';
        } else if (rawNet) {
          detected.environment = 'mainnet';
          detected.network_display = String(opt.network ?? opt.chainId ?? rawNet);
        } else {
          missing.push('network');
        }

        detected.asset = 'USDC';

        // Price — accept maxAmountRequired (x402 standard), amount, maxAmount, price
        const rawPrice = opt.maxAmountRequired ?? opt.amount ?? opt.maxAmount ?? opt.price;
        if (rawPrice != null) {
          const price = parsePriceToUsdc(String(rawPrice));
          if (price > 0) {
            detected.expected_price = price.toFixed(6);
            detected.max_price = (price * 1.1).toFixed(6);
          } else {
            missing.push('price');
          }
        } else {
          missing.push('price');
        }

        // Recipient — accept payTo (x402v1), recipient (Bankr), to, address, paymentAddress
        const recipientAddr = opt.payTo ?? opt.recipient ?? opt.to ?? opt.address ?? opt.paymentAddress;
        if (recipientAddr) {
          detected.recipient_display = `${recipientAddr.slice(0, 6)}…${recipientAddr.slice(-4)}`;
          detected.recipient_full = recipientAddr;
        } else {
          missing.push('recipient');
        }

        // Description — check all known locations across x402 versions
        // x402 V2 puts description in terms.resource.description (not terms.description)
        const desc = terms?.description
          ?? terms?.resource?.description
          ?? opt.description
          ?? opt.extra?.description
          ?? opt.extra?.name
          ?? opt.resource;
        if (desc) detected.description = desc;
        else missing.push('description');

        // Output schema — use outputSchema from payment terms if available
        if (opt.outputSchema && typeof opt.outputSchema === 'object') {
          detected.output_schema = opt.outputSchema;
        }

      } else {
        missing.push('payment_terms', 'network', 'price', 'recipient', 'description');
      }

      // Schemas: defaults (may have been overridden above by outputSchema)
      detected.input_schema = { type: 'object' };
      if (!detected.output_schema) detected.output_schema = { type: 'object' };

    } else if (response.status === 200) {
      // Non-x402 endpoint — infer schema from response
      missing.push('payment_terms', 'price', 'recipient', 'network', 'description');
      try {
        const text = await response.text();
        const parsed = JSON.parse(text);
        detected.output_schema = inferSchema(parsed);
        detected.input_schema = { type: 'object' };
      } catch {
        detected.input_schema = { type: 'object' };
        detected.output_schema = { type: 'object' };
        missing.push('output_schema');
      }
    } else {
      missing.push('payment_terms', 'price', 'recipient', 'network', 'description');
      detected.input_schema = { type: 'object' };
      detected.output_schema = { type: 'object' };
    }

  } catch {
    missing.push('payment_terms', 'price', 'recipient', 'network', 'description');
    detected.input_schema = { type: 'object' };
    detected.output_schema = { type: 'object' };
  }

  return NextResponse.json({ detected, missing, _debug: { status: _debugStatus, body: _debugBody, header: _debugHeader, headerLen: _debugHeaderLen, opt: _debugOpt } });
}
