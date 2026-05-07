import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/public-shell";
import { useRealtor } from "@/hooks/use-realtor";
import { getListingBySlug } from "@/lib/realtor.functions";

export const Route = createFileRoute("/sold/$slug")({ component: Page });

function Page() { return <PublicShell><Inner /></PublicShell>; }

function Inner() {
  const { slug } = Route.useParams();
  const { data: r } = useRealtor();
  const fn = useServerFn(getListingBySlug);
  const { data, isLoading } = useQuery({
    queryKey: ["sold-listing", r?.realtor?.id, slug],
    queryFn: () => fn({ data: { realtorId: r!.realtor!.id, slug } }),
    enabled: !!r?.realtor?.id,
  });

  if (isLoading) return <div className="px-6 py-20 text-muted-foreground">Loading…</div>;
  if (!data?.listing) {
    return (
      <div className="px-6 py-20 max-w-2xl mx-auto text-center">
        <h1 className="font-display text-4xl">Listing not found</h1>
        <Link to="/sold" className="mt-6 inline-block text-accent">← Back to sold</Link>
      </div>
    );
  }
  const l = data.listing;
  const photos = data.photos.length > 0 ? data.photos.map((p) => p.image_url) : l.primary_image_url ? [l.primary_image_url] : [];
  const realtor = r!.realtor!;

  return (
    <article>
      <section className="relative bg-muted">
        {photos[0] && (
          <div className="aspect-[16/9] max-h-[70vh] overflow-hidden">
            <img src={photos[0]} alt={l.address ?? ""} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="absolute top-6 left-6 bg-foreground text-background text-xs uppercase tracking-[0.25em] px-4 py-2">Sold</div>
      </section>

      {photos.length > 1 && (
        <section className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.slice(1, 9).map((src, i) => (
            <div key={i} className="aspect-[4/3] overflow-hidden bg-card">
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </section>
      )}

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{l.city}</div>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">{l.address}</h1>
        <div className="gold-rule my-8 max-w-xs mx-auto" />
        {l.description && <p className="text-foreground/80 leading-relaxed">{l.description}</p>}
      </section>

      <section className="bg-foreground text-background py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-4xl">Thinking of selling?</h2>
          <p className="mt-4 text-background/70">Get a confidential market evaluation from {realtor.name}.</p>
          <div className="mt-8 flex justify-center gap-3">
            {realtor.phone && <a href={`tel:${realtor.phone}`} className="px-7 h-12 inline-flex items-center bg-background text-foreground text-sm uppercase tracking-[0.18em]">Call {realtor.phone}</a>}
            {realtor.email && <a href={`mailto:${realtor.email}`} className="px-7 h-12 inline-flex items-center border border-background/30 text-sm uppercase tracking-[0.18em]">Email</a>}
          </div>
        </div>
      </section>
    </article>
  );
}
