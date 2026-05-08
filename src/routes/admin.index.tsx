import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin-shell";
import { adminListRealtors, adminListListings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({ component: Page });

function Page() {
  return (
    <AdminShell>
      <Inner />
    </AdminShell>
  );
}

function Inner() {
  const lr = useServerFn(adminListRealtors);
  const ll = useServerFn(adminListListings);
  const realtors = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }), enabled: true });
  const listings = useQuery({ queryKey: ["a-listings"], queryFn: () => ll({ data: {} }), enabled: true });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl">Dashboard</h1>
        <div className="gold-rule my-6 max-w-xs" />
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        <Card title="Realtors" count={realtors.data?.length ?? 0} href="/admin/realtors" />
        <Card title="Listings" count={listings.data?.length ?? 0} href="/admin/listings" />
      </div>
    </div>
  );
}

function Card({ title, count, href }: { title: string; count: number; href: string }) {
  return (
    <Link to={href} className="block bg-card shadow-card p-8 hover:shadow-luxury transition">
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{title}</div>
      <div className="mt-3 font-display text-5xl">{count}</div>
      <div className="mt-2 text-sm text-accent">Manage →</div>
    </Link>
  );
}
