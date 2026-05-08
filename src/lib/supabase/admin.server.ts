import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://pnstqwyuhdzdmodeqvid.supabase.co";

export function getAdminClient() {
  const key = process.env.SERVICE_ROLE_KEY;
  if (!key) throw new Error("SERVICE_ROLE_KEY is not configured");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
