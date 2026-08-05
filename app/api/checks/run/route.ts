import { NextRequest, NextResponse } from 'next/server';
import { runCheck } from '@/lib/check-runner/runner';
import type { ServiceConfig } from '@/lib/check-runner/types';

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { config?: ServiceConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { config } = body;

  if (!config?.id || !config?.endpoint_url) {
    return NextResponse.json({ error: 'Missing required config fields' }, { status: 400 });
  }

  try {
    const result = await runCheck(config);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Runner failed: ${err}` },
      { status: 500 }
    );
  }
}
