export type TelegramResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends one Telegram message. Never throws, and never reports success it didn't get:
 * until Oct 17 every failure was swallowed, and a dead bot token went unnoticed for
 * weeks (incident, Cori-watchdog and low-wallet alerts all lost). Failures are logged
 * (without the token) and returned, so callers can retry instead of assuming delivery.
 */
export async function sendTelegramAlert(chatId: string, text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return fail('TELEGRAM_BOT_TOKEN not set');
  if (!chatId) return fail('no chat id');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (res.ok) return { ok: true };
    // Telegram explains refusals in `description` (e.g. "Unauthorized", "bot was blocked by the user")
    const body = (await res.json().catch(() => null)) as { description?: unknown } | null;
    const why = typeof body?.description === 'string' ? body.description : '';
    return fail(`Telegram refused (HTTP ${res.status})${why ? `: ${why}` : ''}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Telegram unreachable: ${message.split(token).join('[token]')}`);
  }
}

function fail(reason: string): TelegramResult {
  console.error(`[telegram] alert not delivered: ${reason}`);
  return { ok: false, reason };
}
