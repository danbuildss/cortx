import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: connection } = await supabase
    .from('telegram_connections')
    .select('chat_id, username, connected_at, active, on_open, on_severity_increase, on_resolve')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  return NextResponse.json({ connected: !!connection, connection: connection ?? null });
}
