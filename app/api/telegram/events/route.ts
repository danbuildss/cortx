import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only allow toggling specific boolean fields
  const allowed = new Set(['on_open', 'on_severity_increase', 'on_resolve']);
  const update: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(body)) {
    if (allowed.has(key) && typeof val === 'boolean') {
      update[key] = val;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  await supabase
    .from('telegram_connections')
    .update(update)
    .eq('user_id', user.id)
    .eq('active', true);

  return NextResponse.json({ ok: true });
}
