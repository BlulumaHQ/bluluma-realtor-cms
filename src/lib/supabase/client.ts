import { createClient } from "@supabase/supabase-js";

// Browser client — used for admin sign-in only (central project auth).
const SUPABASE_URL = "https://uzdjwpkgldzhnoxjeyrw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ifsg2zxajGqu19GsJ2X4RQ_KHBHGIvi";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
