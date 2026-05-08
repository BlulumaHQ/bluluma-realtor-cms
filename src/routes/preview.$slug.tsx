import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { RealtorProvider } from "@/lib/realtor-context";
import { getRealtorBySlug, getHomeData } from "@/lib/realtor.functions";
import { ListingCard } from "@/components/listing-card";
import { RealtorTheme, ListingsEmpty } from "@/components/realtor-theme";
import type { Listing, Realtor } from "@/lib/types";

export const Route = createFileRoute("/preview/$slug")({ component: PreviewLayout });

function PreviewLayout() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getRealtorBySlug);
  const { data, isLoading } = useQuery({
    queryKey: ["preview-realtor", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  const realtor = data?.realtor;
  if (!realtor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-display text-3xl">Realtor not found</h1>
          <p className="mt-3 text-muted-foreground">No realtor with slug <code>{slug}</code>.</p>
          <Link to="/admin/realtors" className="mt-6 inline-block text-accent">← Back to admin</Link>
        </div>
      </div>
    );
  }

  return (
    <RealtorProvider realtor={realtor} preview>
      <RealtorTheme realtor={realtor} className="min-h-screen flex flex-col">
        <div
          className="text-xs uppercase tracking-[0.2em] px-6 py-2 flex items-center justify-between text-background"
          style={{ background: "var(--brand)" }}
        >
          <span>Preview · {realtor.name} ({slug})</span>
          <Link to="/admin/realtors" className="underline">Exit preview</Link>
        </div>
        <SiteHeader realtor={realtor} />
        <main className="flex-1">
          <RealtorHome realtor={realtor} previewMode />
        </main>
        <SiteFooter realtor={realtor} />
        <Outlet />
      </RealtorTheme>
    </RealtorProvider>
  );
}

function RealtorHome({ realtor, previewMode = false }: { realtor: Realtor; previewMode?: boolean }) {
  const fn = useServerFn(getHomeData);
  const { data } = useQuery({
    queryKey: ["preview-home", realtor.id],
    queryFn: () => fn({ data: { realtorId: realtor.id } }),
  });
  const featured = data?.featured ?? [];
  const sold = data?.sold ?? [];

  return (
    <>
      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-20 md:pt-28 md:pb-32 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-7">
            {realtor.brokerage_name && (
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{realtor.brokerage_name}</div>
            )}
            <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[1.05] text-balance">
              Vancouver homes,{" "}
              <em className="not-italic" style={{ color: "var(--brand)" }}>thoughtfully sold.</em>
            </h1>
            <p className="mt-7 text-lg text-muted-foreground max-w-xl text-balance">
              {realtor.bio ??
                `Working with ${realtor.name} means a calm, considered approach to buying and selling residential real estate across the Lower Mainland.`}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#featured"
                className="inline-flex items-center px-7 h-12 text-sm uppercase tracking-[0.18em] text-background transition hover:opacity-90"
                style={{ background: "var(--brand)" }}
              >
                View Featured Homes
              </a>
              {realtor.phone && (
                <a
                  href={`tel:${realtor.phone}`}
                  className="inline-flex items-center px-7 h-12 border border-foreground/20 text-sm uppercase tracking-[0.18em] hover:bg-foreground hover:text-background transition"
                >
                  Book a Consultation
                </a>
              )}
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
              {realtor.phone && <span>{realtor.phone}</span>}
              {realtor.email && <span>{realtor.email}</span>}
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="relative">
              <div
                className="absolute -inset-4 -z-10 hidden md:block"
                style={{ background: "color-mix(in oklab, var(--brand) 12%, transparent)" }}
              />
              {realtor.headshot_url ? (
                <div className="aspect-[4/5] overflow-hidden shadow-luxury">
                  <img src={realtor.headshot_url} alt={realtor.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div
                  className="aspect-[4/5] flex flex-col items-center justify-center text-center p-8"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in oklab, var(--brand) 18%, var(--secondary)) 0%, var(--secondary) 100%)",
                  }}
                >
                  <div className="font-display text-6xl" style={{ color: "var(--brand)" }}>
                    {realtor.name
                      .split(" ")
                      .map((p) => p[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Portrait coming soon
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section id="featured" className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader eyebrow="Featured" title="Current Listings" link={{ href: "/listings", label: "All listings" }} />
        <FeaturedGrid featured={featured} previewMode={previewMode} />
      </section>

      {/* RECENTLY SOLD */}
      <section className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader eyebrow="Track Record" title="Recently Sold" link={{ href: "/sold", label: "All sold" }} />
          <SoldGrid sold={sold} previewMode={previewMode} />
        </div>
      </section>

      {/* ABOUT */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">About</div>
        <h2 className="mt-4 font-display text-4xl md:text-5xl">{realtor.name}</h2>
        <div
          className="mx-auto my-8 h-px max-w-xs"
          style={{ background: "linear-gradient(to right, transparent, var(--brand), transparent)" }}
        />
        <p className="text-lg text-muted-foreground leading-relaxed text-balance">
          {realtor.bio ?? `${realtor.name} is a trusted residential advisor for buyers and sellers across Greater Vancouver.`}
        </p>
      </section>

      {/* CTA */}
      <section className="py-24 text-background" style={{ background: "var(--brand)" }}>
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl">Thinking of buying or selling?</h2>
          <p className="mt-6 opacity-80">A confidential, no-pressure conversation about your next move.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {realtor.phone && (
              <a href={`tel:${realtor.phone}`} className="inline-flex items-center px-7 h-12 bg-background text-foreground text-sm uppercase tracking-[0.18em]">
                Call {realtor.phone}
              </a>
            )}
            {realtor.email && (
              <a href={`mailto:${realtor.email}`} className="inline-flex items-center px-7 h-12 border border-background/40 text-sm uppercase tracking-[0.18em] hover:bg-background hover:text-foreground transition">
                Email
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeader({
  eyebrow,
  title,
  link,
}: {
  eyebrow: string;
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</div>
          <h2 className="mt-2 font-display text-4xl md:text-5xl">{title}</h2>
        </div>
        {link && (
          <a
            href={link.href}
            className="hidden md:inline text-sm uppercase tracking-[0.18em] transition hover:opacity-70"
            style={{ color: "var(--brand)" }}
          >
            {link.label} →
          </a>
        )}
      </div>
      <div
        className="mb-10 h-px"
        style={{ background: "linear-gradient(to right, var(--brand), transparent)" }}
      />
    </>
  );
}

function FeaturedGrid({ featured, previewMode }: { featured: Listing[]; previewMode: boolean }) {
  if (featured.length === 0) {
    return previewMode ? (
      <ListingsEmpty
        label="No featured listings yet"
        hint="Mark a listing as Featured in /admin/listings to show it here."
      />
    ) : null;
  }
  if (featured.length === 1) {
    return <ListingCard listing={featured[0]} variant="feature" />;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {featured.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}

function SoldGrid({ sold, previewMode }: { sold: Listing[]; previewMode: boolean }) {
  if (sold.length === 0) {
    return previewMode ? (
      <ListingsEmpty
        label="No sold listings yet"
        hint="Mark a listing as Sold and toggle 'Show in sold' in /admin/listings."
      />
    ) : null;
  }
  if (sold.length === 1) {
    return <ListingCard listing={sold[0]} variant="feature" soldBadge />;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {sold.map((l) => (
        <ListingCard key={l.id} listing={l} soldBadge />
      ))}
    </div>
  );
}
