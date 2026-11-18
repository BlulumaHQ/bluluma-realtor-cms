// Every admin server function runs with the central service key, so each call must
// prove it comes from a signed-in admin. The browser attaches the Supabase session
// token; the server verifies it against central auth and an email allow-list.
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabase } from "./supabase/client";
import { getAdminClient } from "./supabase/admin.server";

const ADMIN_EMAILS = ["sony@bluluma.com"];

export const adminAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  })
  .server(async ({ next }) => {
    const header = getRequestHeader("authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Not signed in");
    const { data, error } = await getAdminClient().auth.getUser(token);
    const email = data.user?.email?.toLowerCase();
    if (error || !email || !ADMIN_EMAILS.includes(email)) throw new Error("Not authorized");
    return next({ context: { adminEmail: email } });
  });
