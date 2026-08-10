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

  type PaymentOpt = {
    network?: string; maxAmountRequired?: string;
    payTo?: string; recipient?: string;
    asset?: string; description?: string; resource?: string;
    outputSchema?: Record<string, unknown>;
    extra?: { name?: string; description?: string; [k: string]: unknown };
  };
  type BodyTerms = { accepts?: PaymentOpt[]; description?: string; error?: string };

  // Parse a raw string (body or header value) into a PaymentOpt + BodyTerms pair.
  // Handles both the x402v1 accepts[] envelope and the flat Bankr header format.
  function parsePaymentTerms(raw: string): { opt: PaymentOpt | null; terms: BodyTerms | null } {
    if (!raw?.trim()) return { opt: null, terms: null };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.accepts) && parsed.accepts.length > 0) {
          return { opt: parsed.accepts[0] as PaymentOpt, terms: parsed as BodyTerms };
        }
        // Flat format — the object itself is the payment option
        return { opt: parsed as PaymentOpt, terms: null };
      }
    } catch { /* ignore */ }
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
      response = await fetch(validatedUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      if (response.status !== 402) {
        const getResp = await fetch(validatedUrl.toString(), {
          method: 'GET',
          signal: controller.signal,
        });
        if (getResp.status === 402) response = getResp;
      }
    } finally {
      clearTimeout(timer);
    }

    _debugStatus = response.status;

    if (response.status === 402) {
      const rawBody = await readBodyCapped(response);
      _debugBody = rawBody.slice(0, 500);

      // Parse body and X-Payment-Required header; body accepts[] takes precedence.
      const { opt: bodyOpt, terms: bodyTerms } = parsePaymentTerms(rawBody);
      const xPayHeader = response.headers.get('x-payment-required') ?? '';
      _debugHeader = xPayHeader.slice(0, 500);
      const { opt: headerOpt, terms: headerTerms } = parsePaymentTerms(xPayHeader);

      const opt  = bodyOpt  ?? headerOpt;
      const terms = bodyTerms ?? headerTerms;

      if (opt) {
        // Network
        const net = opt.network ?? '';
        if (net === 'eip155:8453' || net === 'base') {
          detected.environment = 'mainnet';
          detected.network_display = 'Base Mainnet';
        } else if (net === 'eip155:84532' || net === 'base-sepolia') {
          detected.environment = 'testnet';
          detected.network_display = 'Base Sepolia (Testnet)';
        } else if (net) {
          detected.environment = 'mainnet';
          detected.network_display = net;
        } else {
          missing.push('network');
        }

        detected.asset = 'USDC';

        // Price
        if (opt.maxAmountRequired) {
          const price = parsePriceToUsdc(opt.maxAmountRequired);
          if (price > 0) {
            detected.expected_price = price.toFixed(6);
            detected.max_price = (price * 1.1).toFixed(6);
          } else {
            missing.push('price');
          }
        } else {
          missing.push('price');
        }

        // Recipient — accept both payTo (x402v1) and recipient (Bankr flat format)
        const recipientAddr = opt.payTo ?? opt.recipient;
        if (recipientAddr) {
          detected.recipient_display = `${recipientAddr.slice(0, 6)}…${recipientAddr.slice(-4)}`;
          detected.recipient_full = recipientAddr;
        } else {
          missing.push('recipient');
        }

        // Description — check all known locations across x402 versions
        const desc = terms?.description
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

  return NextResponse.json({ detected, missing, _debug: { status: _debugStatus, body: _debugBody, header: _debugHeader } });
}
