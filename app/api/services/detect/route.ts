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

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(validatedUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 402) {
      let rawBody = '';
      try { rawBody = await response.text(); } catch { /* ignore */ }

      let terms: {
        accepts?: Array<{
          network?: string; maxAmountRequired?: string; payTo?: string;
          asset?: string; description?: string; resource?: string;
        }>;
        description?: string;
        error?: string;
      } | null = null;

      try { terms = JSON.parse(rawBody); } catch { missing.push('payment_terms'); }

      if (terms?.accepts && terms.accepts.length > 0) {
        const opt = terms.accepts[0];

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

        // Recipient
        if (opt.payTo) {
          detected.recipient_display = `${opt.payTo.slice(0, 6)}…${opt.payTo.slice(-4)}`;
          detected.recipient_full = opt.payTo;
        } else {
          missing.push('recipient');
        }

        // Description
        const desc = terms.description ?? opt.description ?? opt.resource;
        if (desc) detected.description = desc;
        else missing.push('description');

      } else {
        missing.push('payment_terms', 'network', 'price', 'recipient', 'description');
      }

      // Schemas: for x402, default input is {} and output is inferred
      detected.input_schema = { type: 'object' };
      detected.output_schema = { type: 'object' };

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

  return NextResponse.json({ detected, missing });
}
