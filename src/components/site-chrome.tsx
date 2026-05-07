import { Link } from "@tanstack/react-router";
import type { Realtor } from "@/lib/types";

export function SiteHeader({ realtor }: { realtor: Realtor | null }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          {realtor?.logo_url ? (
            <img src={realtor.logo_url} alt={realtor.name} className="h-10 w-auto" />
          ) : (
            <span className="font-display text-2xl tracking-tight">{realtor?.name ?? "Realtor"}</span>
          )}
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-sm uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition">Home</Link>
          <Link to="/listings" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition">Listings</Link>
          <Link to="/sold" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition">Sold</Link>
          <Link to="/commercial" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition">Commercial</Link>
        </nav>
        <a
          href={`tel:${realtor?.phone ?? ""}`}
          className="hidden md:inline-flex items-center px-5 h-10 border border-foreground/20 text-sm uppercase tracking-[0.18em] hover:bg-foreground hover:text-background transition"
        >
          Contact
        </a>
      </div>
    </header>
  );
}

export function SiteFooter({ realtor }: { realtor: Realtor | null }) {
  return (
    <footer className="mt-32 border-t border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-3 gap-10">
        <div>
          <div className="font-display text-2xl">{realtor?.name}</div>
          <div className="text-muted-foreground text-sm mt-1">{realtor?.brokerage_name}</div>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          {realtor?.phone && <div>{realtor.phone}</div>}
          {realtor?.email && <div>{realtor.email}</div>}
        </div>
        <div className="text-xs text-muted-foreground md:text-right">
          © {new Date().getFullYear()} {realtor?.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
