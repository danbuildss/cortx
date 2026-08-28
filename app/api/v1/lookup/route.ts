import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.hostname = u.hostname.toLowerCase();
    u.protocol = u.protocol.toLowerCase();
    // strip trailing slash on bare origins
    const normalized = u.toString().replace(/\/$/, '');
    return normalized;
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function lookup(rawUrl: string | null) {
  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400, headers: CORS });
  }

  const url = normalizeUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ error: 'url must be a valid http(s):// URL' }, { status: 400, headers: CORS });
  }

  const supabase = db();
  const { data: service } = await supabase
    .from('services')
    .select('id, endpoint_url, name, status')
    .eq('endpoint_url', url)
    .is('deleted_at', null)
    .maybeSingle();

  if (!service) {
    return NextResponse.json(
      { monitored: false, endpoint_url: url },
      { status: 404, headers: CORS }
    );
  }

  return NextResponse.json(
    {
      monitored:    true,
      serviceId:    service.id,
      endpoint_url: service.endpoint_url,
      name:         service.name,
      status:       service.status ?? 'unknown',
    },
    {
      headers: {
        ...CORS,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
      },
    }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return lookup(searchParams.get('url'));
}

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') ?? '';
  let rawUrl: string | null = null;

  if (ct.includes('application/x-www-form-urlencoded')) {
    const body = await req.formData();
    rawUrl = body.get('url') as string | null;
  } else {
    try {
      const body = await req.json();
      rawUrl = typeof body?.url === 'string' ? body.url : null;
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400, headers: CORS });
    }
  }

  return lookup(rawUrl);
}
