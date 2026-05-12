import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/public-shell";
import { useRealtor } from "@/hooks/use-realtor";
import { getListingBySlug } from "@/lib/realtor.functions";

export const Route = createFileRoute("/listings/$slug")({
  component: Page,
});

function Page() { return <PublicShell><Inner /></PublicShell>; }

function fmtPrice(p: number | null) {
  if (!p) return "Price on request";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(p);
}

function asFeatureObject(features: any) {
  return features && !Array.isArray(features) && typeof features === "object" ? features : null;
}

function asList(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string" && value.trim()) return value.split(/\n|,|;|•/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function featureList(features: any): string[] {
  if (Array.isArray(features)) return features.map(String);
  const obj = asFeatureObject(features);
  if (!obj) return [];
  return [
    ...asList(obj.feature_list),
    ...asList(obj.interior_features),
    ...asList(obj.exterior_features),
    ...asList(obj.amenities),
    ...asList(obj.appliances),
  ].filter((item, index, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index);
}

function Inner() {
  const { slug } = Route.useParams();
  const { data: r } = useRealtor();
  const fn = useServerFn(getListingBySlug);
  const { data, isLoading } = useQuery({
    queryKey: ["listing", r?.realtor?.id, slug],
    queryFn: () => fn({ data: { realtorId: r!.realtor!.id, slug } }),
    enabled: !!r?.realtor?.id,
  });

  if (isLoading) return <div className="px-6 py-20 text-muted-foreground">Loading…</div>;
  if (!data?.listing) {
    return (
      <div className="px-6 py-20 max-w-2xl mx-auto text-center">
        <h1 className="font-display text-4xl">Listing not found</h1>
        <Link to="/listings" className="mt-6 inline-block text-accent">← Back to listings</Link>
      </div>
    );
  }
  const l = data.listing;
  const photos = data.photos.length > 0
    ? data.photos.map((p) => p.image_url)
    : l.primary_image_url ? [l.primary_image_url] : [];
  const realtor = r!.realtor!;
  const extra = asFeatureObject(l.features);
  const features = featureList(l.features);
  const propertyDetails = extra ? [
    ["Year built", extra.year_built],
    ["Strata fee", extra.strata_fee],
    ["Taxes", extra.taxes],
    ["Zoning", extra.zoning],
    ["Parking", extra.parking],
    ["Garage / carport", extra.garage],
    ["Style", extra.property_style],
    ["Building type", extra.building_type],
    ["Floor area", extra.floor_area],
    ["Land size", extra.land_size],
    ["Heating", extra.heating],
    ["Cooling", extra.cooling],
    ["Fireplace", extra.fireplace],
    ["Basement", extra.basement],
    ["View", extra.view],
  ].filter(([, value]) => value) : [];
  const locationDetails = extra ? [extra.neighborhood, extra.subdivision, extra.region, extra.municipality].filter(Boolean) : [];

  return (
    <article>
      {/* Gallery */}
      <section className="bg-muted">
        {photos[0] && (
          <div className="aspect-[16/9] max-h-[80vh] overflow-hidden">
            <img src={photos[0]} alt={l.address ?? ""} className="h-full w-full object-cover" />
          </div>
        )}
        {photos.length > 1 && (
          <div className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {photos.slice(1, 9).map((src, i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden bg-card">
                <img src={src} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Overview */}
      <section className="mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{l.property_type ?? "Residential"}</div>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">{l.address}</h1>
          <div className="text-muted-foreground mt-1">{l.city}</div>
          <div className="font-display text-3xl mt-6">{fmtPrice(l.price)}</div>

          <div className="gold-rule my-10" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
            <Stat label="Beds" value={l.beds} />
            <Stat label="Baths" value={l.baths} />
            <Stat label="Sqft" value={l.sqft?.toLocaleString()} />
            <Stat label="Lot" value={l.lot_size} />
          </div>

          {l.description && (
            <div className="mt-12">
              <h2 className="font-display text-2xl mb-4">About this property</h2>
              <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{l.description}</p>
            </div>
          )}

          {propertyDetails.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-2xl mb-4">Property details</h2>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {propertyDetails.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right text-foreground/85">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {features.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-2xl mb-4">Features</h2>
              <ul className="grid sm:grid-cols-2 gap-2 text-foreground/80">
                {features.map((f, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{f}</li>)}
              </ul>
            </div>
          )}

          {locationDetails.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-2xl mb-4">Location</h2>
              <p className="text-foreground/80">{locationDetails.join(" · ")}</p>
            </div>
          )}

          {extra?.brokerage && (
            <div className="mt-12 text-sm text-muted-foreground">
              Listed by {extra.listing_agent ? `${extra.listing_agent} · ` : ""}{extra.brokerage}
            </div>
          )}

          {l.mls_number && <div className="mt-12 text-xs uppercase tracking-[0.2em] text-muted-foreground">MLS® {l.mls_number}</div>}
        </div>

        {/* Sidebar CTA */}
        <aside className="md:sticky md:top-28 self-start bg-card shadow-card p-8">
          <div className="flex items-center gap-4">
            {realtor.headshot_url && <img src={realtor.headshot_url} alt={realtor.name} className="h-14 w-14 rounded-full object-cover" />}
            <div>
              <div className="font-display text-xl">{realtor.name}</div>
              <div className="text-xs text-muted-foreground">{realtor.brokerage_name}</div>
            </div>
          </div>
          <div className="gold-rule my-6" />
          <div className="space-y-3">
            {realtor.phone && <a href={`tel:${realtor.phone}`} className="block text-center px-5 h-11 leading-[44px] bg-foreground text-background text-sm uppercase tracking-[0.18em]">Book a Showing</a>}
            {realtor.email && <a href={`mailto:${realtor.email}?subject=${encodeURIComponent(l.address ?? "Listing inquiry")}`} className="block text-center px-5 h-11 leading-[44px] border border-foreground/20 text-sm uppercase tracking-[0.18em]">Email Inquiry</a>}
            {l.paragon_url && <a href={l.paragon_url} target="_blank" rel="noreferrer" className="block text-center px-5 h-11 leading-[44px] border border-foreground/20 text-sm uppercase tracking-[0.18em]">View on Paragon</a>}
            {l.pdf_url && <a href={l.pdf_url} target="_blank" rel="noreferrer" className="block text-center px-5 h-11 leading-[44px] border border-foreground/20 text-sm uppercase tracking-[0.18em]">Download PDF</a>}
          </div>
        </aside>
      </section>

      {/* Map */}
      {l.address && (
        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="aspect-[16/7] overflow-hidden border border-border">
            <iframe
              title="Map"
              className="w-full h-full"
              loading="lazy"
              src={`https://www.google.com/maps?q=${encodeURIComponent(`${l.address}, ${l.city ?? ""}`)}&output=embed`}
            />
          </div>
        </section>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl">{value ?? "—"}</div>
    </div>
  );
}
