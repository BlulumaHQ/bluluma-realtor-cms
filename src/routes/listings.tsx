import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/public-shell";
import { ListingCard } from "@/components/listing-card";
import { useRealtor } from "@/hooks/use-realtor";
import { listListings } from "@/lib/realtor.functions";

export const Route = createFileRoute("/listings")({
  head: () => ({ meta: [{ title: "Current Listings" }, { name: "description", content: "Browse current residential listings." }] }),
  component: Page,
});

function Page() {
  return (
    <PublicShell>
      <Inner />
    </PublicShell>
  );
}

function Inner() {
  const { data: r } = useRealtor();
  const fn = useServerFn(listListings);
  const { data, isLoading } = useQuery({
    queryKey: ["listings-active", r?.realtor?.id],
    queryFn: () => fn({ data: { realtorId: r!.realtor!.id, status: "active" } }),
    enabled: !!r?.realtor?.id,
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Portfolio</div>
      <h1 className="mt-2 font-display text-5xl md:text-6xl">Current Listings</h1>
      <div className="gold-rule my-8 max-w-xs" />
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground">No active listings at the moment.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {data!.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  );
}
