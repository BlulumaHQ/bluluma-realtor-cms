import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/public-shell";
import { ListingCard } from "@/components/listing-card";
import { useRealtor } from "@/hooks/use-realtor";
import { listListings } from "@/lib/realtor.functions";

export const Route = createFileRoute("/commercial")({
  head: () => ({ meta: [{ title: "Commercial Real Estate" }, { name: "description", content: "Commercial properties for sale and lease." }] }),
  component: Page,
});

function Page() { return <PublicShell><Inner /></PublicShell>; }

function Inner() {
  const { data: r } = useRealtor();
  const fn = useServerFn(listListings);
  const { data } = useQuery({
    queryKey: ["listings-commercial", r?.realtor?.id],
    queryFn: () => fn({ data: { realtorId: r!.realtor!.id, category: "commercial" } }),
    enabled: !!r?.realtor?.id,
  });

  const forSale = (data ?? []).filter((l) => l.transaction_type === "sale");
  const forLease = (data ?? []).filter((l) => l.transaction_type === "lease");

  return (
    <div className="mx-auto max-w-7xl px-6 py-20 space-y-20">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Commercial</div>
        <h1 className="mt-2 font-display text-5xl md:text-6xl">Investment & Commercial</h1>
        <div className="gold-rule my-8 max-w-xs" />
      </div>

      <Section title="For Sale" items={forSale} />
      <Section title="For Lease" items={forLease} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
  return (
    <section>
      <h2 className="font-display text-3xl mb-8">{title}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">None available.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </section>
  );
}
