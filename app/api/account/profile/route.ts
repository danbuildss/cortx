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

  const displayName = body.display_name;
  if (displayName !== null && typeof displayName !== 'string') {
    return NextResponse.json({ error: 'Invalid display_name' }, { status: 400 });
  }

  await supabase
    .from('profiles')
    .update({ display_name: displayName ?? null })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
