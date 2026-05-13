import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { adminDashboardStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({ component: Page });

function Page() {
  return (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const statsFn = useServerFn(adminDashboardStats);
  const stats = useQuery({ queryKey: ["a-dashboard"], queryFn: () => statsFn({ data: {} }) });

  const [selectedRealtor, setSelectedRealtor] = useState("");
  const [quickLinks, setQuickLinks] = useState("");

  const realtors = stats.data?.realtors ?? [];
  const counts = stats.data?.counts;
  const recent = stats.data?.recent ?? [];
  const byRealtor = stats.data?.listingCountByRealtor ?? {};

  const realtorById = useMemo(() => {
    const m = new Map<string, string>();
    realtors.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [realtors]);

  const startImport = () => {
    const links = quickLinks.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const params = new URLSearchParams();
    if (selectedRealtor) params.set("realtor", selectedRealtor);
    if (links.length) params.set("links", links.join("\n"));
    navigate({ to: "/admin/import", search: Object.fromEntries(params) as any });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bluluma</div>
          <h1 className="mt-2 font-display text-4xl">Dashboard</h1>
          <div className="gold-rule mt-4 max-w-xs" />
        </div>
        <Link to="/admin/import" className="px-5 h-10 inline-flex items-center bg-foreground text-background text-sm uppercase tracking-[0.18em]">
          Import listings
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Realtors" value={counts?.realtors ?? (stats.isLoading ? "…" : 0)} href="/admin/realtors" />
        <Stat label="Listings" value={counts?.listings ?? (stats.isLoading ? "…" : 0)} href="/admin/listings" />
        <Stat label="Featured" value={counts?.featured ?? (stats.isLoading ? "…" : 0)} href="/admin/listings" />
        <Stat label="Sold" value={counts?.sold ?? (stats.isLoading ? "…" : 0)} href="/admin/listings" />
        <Stat label="Commercial" value={counts?.commercial ?? (stats.isLoading ? "…" : 0)} href="/admin/listings" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Import */}
        <section className="lg:col-span-2 bg-card shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Quick Import</h2>
            <Link to="/admin/import" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">Open full import →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Realtor</div>
              <select
                className="w-full h-11 px-3 border border-border bg-background"
                value={selectedRealtor}
                onChange={(e) => setSelectedRealtor(e.target.value)}
              >
                <option value="">Select a realtor…</option>
                {realtors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Destination</div>
              <select
                className="w-full h-11 px-3 border border-border bg-background"
                value={quickDest}
                onChange={(e) => setQuickDest(e.target.value as any)}
              >
                <option value="active">Active Featured Listing</option>
                <option value="sold">Sold Listing</option>
                <option value="commercial">Commercial Listing</option>
              </select>
            </label>
          </div>
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Paragon links — one per line</div>
            <textarea
              className="w-full min-h-28 p-3 border border-border bg-background font-mono text-sm"
              placeholder="https://...&#10;https://..."
              value={quickLinks}
              onChange={(e) => setQuickLinks(e.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <button onClick={startImport} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">
              Generate Imports
            </button>
          </div>
        </section>

        {/* Realtor list */}
        <section className="bg-card shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Realtors</h2>
            <Link to="/admin/realtors" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">Manage →</Link>
          </div>
          {realtors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{stats.isLoading ? "Loading…" : "No realtors found."}</p>
          ) : (
            <ul className="divide-y divide-border">
              {realtors.map((r) => (
                <li key={r.id} className="py-3 flex items-center gap-3">
                  {r.headshot_url ? (
                    <img src={r.headshot_url} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs uppercase">
                      {r.name?.[0] ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.brokerage_name ?? "—"} · {byRealtor[r.id] ?? 0} listings
                    </div>
                  </div>
                  <a
                    href={`/preview/${r.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent shrink-0"
                  >Preview ↗</a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Realtor management cards */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Realtor Management</h2>
          <Link to="/admin/realtors" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">All realtors →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {realtors.map((r) => (
            <div key={r.id} className="bg-card shadow-card p-5">
              <div className="flex items-center gap-3">
                {r.headshot_url ? (
                  <img src={r.headshot_url} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted" />
                )}
                <div>
                  <div className="font-display text-lg">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.brokerage_name ?? "—"}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Slug: <span className="font-mono">{r.slug}</span> · {byRealtor[r.id] ?? 0} listings
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em]">
                <Link to="/admin/realtors" className="px-3 h-8 inline-flex items-center border border-border hover:bg-muted">Edit</Link>
                <Link to="/admin/listings" className="px-3 h-8 inline-flex items-center border border-border hover:bg-muted">Listings</Link>
                <Link
                  to="/admin/import"
                  search={{ realtor: r.id } as any}
                  className="px-3 h-8 inline-flex items-center border border-border hover:bg-muted"
                >Import</Link>
                <a
                  href={`/preview/${r.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 h-8 inline-flex items-center border border-border hover:bg-muted"
                >Preview</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent listings */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Recent Listings</h2>
          <Link to="/admin/listings" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">All →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{stats.isLoading ? "Loading…" : "No listings yet."}</p>
        ) : (
          <div className="bg-card shadow-card divide-y divide-border">
            {recent.map((l) => (
              <div key={l.id} className="p-4 flex items-center gap-4">
                {l.primary_image_url ? (
                  <img src={l.primary_image_url} className="h-14 w-20 object-cover" />
                ) : (
                  <div className="h-14 w-20 bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.title ?? l.address ?? l.slug}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {realtorById.get(l.realtor_id) ?? "—"} · {l.status ?? "—"} · {l.category ?? "—"}
                  </div>
                </div>
                <Link to="/admin/listings" className="text-xs text-accent shrink-0">Edit →</Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link to={href} className="bg-card shadow-card p-5 hover:shadow-luxury transition block">
      <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-4xl">{value}</div>
    </Link>
  );
}
