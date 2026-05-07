import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAdminPassword } from "@/hooks/use-admin";
import { verifyAdmin } from "@/lib/admin.functions";

export function AdminShell({ children }: { children?: React.ReactNode }) {
  const { password, set, clear } = useAdminPassword();
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const verify = useServerFn(verifyAdmin);
  const router = useRouter();

  if (!password) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <form
          className="w-full max-w-sm bg-card p-8 shadow-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await verify({ data: { password: input } });
              set(input);
            } catch {
              setErr("Invalid password");
            }
          }}
        >
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin</div>
          <h1 className="font-display text-3xl mt-2">Sign in</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="mt-6 w-full h-11 px-3 border border-border bg-background"
          />
          {err && <div className="mt-2 text-destructive text-sm">{err}</div>}
          <button className="mt-4 w-full h-11 bg-foreground text-background text-sm uppercase tracking-[0.18em]">
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/admin" className="font-display text-xl">CMS Admin</Link>
            <nav className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>Dashboard</Link>
              <Link to="/admin/realtors" activeProps={{ className: "text-foreground" }}>Realtors</Link>
              <Link to="/admin/listings" activeProps={{ className: "text-foreground" }}>Listings</Link>
            </nav>
          </div>
          <button
            onClick={() => { clear(); router.invalidate(); }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children ?? <Outlet />}</main>
    </div>
  );
}
