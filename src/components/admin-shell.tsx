import { Link, Outlet } from "@tanstack/react-router";

export function AdminShell({ children }: { children?: React.ReactNode }) {
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
              <Link to="/admin/import-listing" activeProps={{ className: "text-foreground" }}>Import</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children ?? <Outlet />}</main>
    </div>
  );
}
