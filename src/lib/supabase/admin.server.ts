import { createClient } from "@supabase/supabase-js";

// Central Bluluma Supabase project (bluluma-central-cms). Realtor CMS tables live in schema realtor_cms.
export const SUPABASE_URL = "https://uzdjwpkgldzhnoxjeyrw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ifsg2zxajGqu19GsJ2X4RQ_KHBHGIvi";
export const DB_SCHEMA = "realtor_cms";

export function getAdminClient() {
  const key = process.env.CENTRAL_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("CENTRAL_SUPABASE_SECRET_KEY is not configured");
  return createClient(SUPABASE_URL, key, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
