import { createClient } from '@supabase/supabase-js';

function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Sliding-window rate limit backed by Postgres.
 * Returns true if the request is allowed, false if the limit is exceeded.
 *
 * key            — unique bucket, e.g. "run:userId:serviceId"
 * max            — max requests in the window
 * windowSeconds  — window size in seconds
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const db = serviceRoleClient();
  const { data, error } = await db.rpc('check_and_record_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail open — don't block legitimate requests if the rate limit store is down
    console.error('[rate-limit] RPC error:', error.message);
    return true;
  }
  return Boolean(data);
}
