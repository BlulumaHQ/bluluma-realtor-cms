import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function AdminShell({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [status, setStatus] = useState<"checking" | "authed" | "anon">("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        setStatus("authed");
      } else {
        setStatus("anon");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session) {
        setEmail(session.user.email ?? null);
        setStatus("authed");
      } else {
        setEmail(null);
        setStatus("anon");
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === "anon") {
      navigate({ to: "/admin/login", search: { redirect: pathname }, replace: true });
    }
  }, [status, navigate, pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  };

  if (status !== "authed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Checking session…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/admin/dashboard" className="flex items-baseline gap-2">
              <span className="font-display text-xl tracking-tight">Bluluma</span>
              <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Realtor CMS</span>
            </Link>
            <nav className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/admin/dashboard" activeProps={{ className: "text-foreground" }}>Dashboard</Link>
              <Link to="/admin/realtors" activeProps={{ className: "text-foreground" }}>Realtors</Link>
              <Link to="/admin/listings" activeProps={{ className: "text-foreground" }}>Listings</Link>
              <Link to="/admin/import" activeProps={{ className: "text-foreground" }}>Import</Link>
              <Link to="/admin/manual-import" activeProps={{ className: "text-foreground" }}>Manual Import</Link>
              <Link to="/admin/realtors" className="hover:text-foreground">Preview</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {email && <span className="text-muted-foreground truncate max-w-[200px]">{email}</span>}
            <button
              onClick={signOut}
              className="uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children ?? <Outlet />}</main>
    </div>
  );
}
