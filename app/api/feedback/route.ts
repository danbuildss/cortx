import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramAlert } from '@/lib/telegram';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const task = typeof body.task === 'string' ? body.task.trim().slice(0, 2000) : '';
  const problem = typeof body.problem === 'string' ? body.problem.trim().slice(0, 2000) : '';

  if (!task && !problem) {
    return NextResponse.json({ error: 'Feedback cannot be empty' }, { status: 400 });
  }

  // Forward to the owner's Telegram if configured
  const ownerChatId = process.env.FEEDBACK_TELEGRAM_CHAT_ID;
  if (ownerChatId) {
    const msg = [
      `💬 <b>Beta Feedback</b>`,
      `👤 ${user.email}`,
      task ? `\n<b>Trying to:</b> ${task}` : '',
      problem ? `\n<b>What went wrong:</b> ${problem}` : '',
    ].filter(Boolean).join('\n');

    await sendTelegramAlert(ownerChatId, msg).catch(() => {});
  }

  // Also persist to DB so nothing is lost if Telegram is down
  await supabase.from('feedback').insert({
    user_id: user.id,
    email: user.email,
    task,
    problem,
  }).then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true });
}
