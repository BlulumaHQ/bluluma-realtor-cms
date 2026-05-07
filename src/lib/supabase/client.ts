import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pnstqwyuhdzdmodeqvid.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aN7LwltKQzntPyc4_moyQg_XSWARdPD";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
