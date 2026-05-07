import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/public-shell";
import { ListingCard } from "@/components/listing-card";
import { useRealtor } from "@/hooks/use-realtor";
import { getHomeData } from "@/lib/realtor.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Premium Vancouver Real Estate" },
      { name: "description", content: "Curated residential listings, sold properties, and trusted local real estate expertise." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <PublicShell>
      <HomeContent />
    </PublicShell>
  );
}

function HomeContent() {
  const { data: realtorData } = useRealtor();
  const realtor = realtorData?.realtor;
  const fn = useServerFn(getHomeData);
  const { data } = useQuery({
    queryKey: ["home", realtor?.id],
    queryFn: () => fn({ data: { realtorId: realtor!.id } }),
    enabled: !!realtor?.id,
  });

  if (!realtor) return null;
  const featured = data?.featured ?? [];
  const sold = data?.sold ?? [];

  return (
    <>
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-32 md:pb-40 grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {realtor.brokerage_name}
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[1.05] text-balance">
              A considered approach to <em className="text-accent not-italic">Vancouver</em> homes.
            </h1>
            <p className="mt-8 text-lg text-muted-foreground max-w-xl text-balance">
              {realtor.bio ?? "Helping families find homes they love and sellers achieve standout results across the Lower Mainland."}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#featured" className="inline-flex items-center px-7 h-12 bg-foreground text-background text-sm uppercase tracking-[0.18em] hover:bg-foreground/90 transition">
                View Featured Homes
              </a>
              <a href={`tel:${realtor.phone ?? ""}`} className="inline-flex items-center px-7 h-12 border border-foreground/20 text-sm uppercase tracking-[0.18em] hover:bg-foreground hover:text-background transition">
                Book a Consultation
              </a>
            </div>
          </div>
          <div className="md:col-span-5">
            {realtor.headshot_url ? (
              <div className="aspect-[4/5] overflow-hidden shadow-luxury">
                <img src={realtor.headshot_url} alt={realtor.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[4/5] bg-muted" />
            )}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section id="featured" className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Featured</div>
            <h2 className="mt-2 font-display text-4xl md:text-5xl">Current Listings</h2>
          </div>
          <a href="/listings" className="hidden md:inline text-sm uppercase tracking-[0.18em] hover:text-accent">All listings →</a>
        </div>
        <div className="gold-rule mb-10" />
        {featured.length === 0 ? (
          <p className="text-muted-foreground">No featured listings yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      {/* Sold */}
      {sold.length > 0 && (
        <section className="bg-secondary/40 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex items-end justify-between mb-10">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Track Record</div>
                <h2 className="mt-2 font-display text-4xl md:text-5xl">Recently Sold</h2>
              </div>
              <a href="/sold" className="hidden md:inline text-sm uppercase tracking-[0.18em] hover:text-accent">All sold →</a>
            </div>
            <div className="gold-rule mb-10" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {sold.map((l) => <ListingCard key={l.id} listing={l} soldBadge />)}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">About</div>
        <h2 className="mt-4 font-display text-4xl md:text-5xl">{realtor.name}</h2>
        <div className="gold-rule my-8 max-w-xs mx-auto" />
        <p className="text-lg text-muted-foreground leading-relaxed text-balance">
          {realtor.bio ?? "A trusted advisor for buyers and sellers across Greater Vancouver."}
        </p>
      </section>

      {/* CTA */}
      <section className="bg-foreground text-background py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl">Thinking of buying or selling?</h2>
          <p className="mt-6 text-background/70">A confidential, no-pressure conversation about your next move.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {realtor.phone && (
              <a href={`tel:${realtor.phone}`} className="inline-flex items-center px-7 h-12 bg-background text-foreground text-sm uppercase tracking-[0.18em]">
                Call {realtor.phone}
              </a>
            )}
            {realtor.email && (
              <a href={`mailto:${realtor.email}`} className="inline-flex items-center px-7 h-12 border border-background/30 text-sm uppercase tracking-[0.18em] hover:bg-background hover:text-foreground transition">
                Email
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
