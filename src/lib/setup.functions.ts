import { createServerFn } from "@tanstack/react-start";
import { getAdminClient } from "./supabase/admin.server";

async function anyUserExists(): Promise<boolean> {
  const sb = getAdminClient();
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(error.message);
  return (data?.users?.length ?? 0) > 0;
}

export const setupStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { completed: await anyUserExists() };
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => {
    const email = String(d?.email ?? "").trim();
    const password = String(d?.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
    if (password.length < 10) throw new Error("Password must be at least 10 characters");
    return { email, password };
  })
  .handler(async ({ data }) => {
    if (await anyUserExists()) {
      return { ok: false as const, error: "Setup already completed" };
    }
    const sb = getAdminClient();
    const { error } = await sb.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
