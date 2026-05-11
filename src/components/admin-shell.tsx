import { Link, Outlet } from "@tanstack/react-router";

export function AdminShell({ children }: { children?: React.ReactNode }) {
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
              <Link to="/admin/realtors" className="hover:text-foreground">Preview</Link>
            </nav>
          </div>
          <Link to="/" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">Exit</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children ?? <Outlet />}</main>
    </div>
  );
}
