import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { RealtorProvider } from "@/lib/realtor-context";
import { getRealtorBySlug, getHomeData } from "@/lib/realtor.functions";
import { ListingCard } from "@/components/listing-card";

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
      <div className="min-h-screen flex flex-col">
        <div className="bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em] px-6 py-2 flex items-center justify-between">
          <span>Preview · {realtor.name} ({slug})</span>
          <Link to="/admin/realtors" className="underline">Exit preview</Link>
        </div>
        <SiteHeader realtor={realtor} />
        <main className="flex-1">
          <PreviewHome realtorId={realtor.id} realtorName={realtor.name} bio={realtor.bio} headshot={realtor.headshot_url} brokerage={realtor.brokerage_name} phone={realtor.phone} email={realtor.email} />
        </main>
        <SiteFooter realtor={realtor} />
        <Outlet />
      </div>
    </RealtorProvider>
  );
}

function PreviewHome({ realtorId, realtorName, bio, headshot, brokerage, phone, email }: { realtorId: string; realtorName: string; bio: string | null; headshot: string | null; brokerage: string | null; phone: string | null; email: string | null }) {
  const fn = useServerFn(getHomeData);
  const { data } = useQuery({ queryKey: ["preview-home", realtorId], queryFn: () => fn({ data: { realtorId } }) });
  const featured = data?.featured ?? [];
  const sold = data?.sold ?? [];

  return (
    <>
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-24 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-7">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{brokerage}</div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[1.05]">{realtorName}</h1>
          <p className="mt-8 text-lg text-muted-foreground max-w-xl">{bio ?? "Real estate, considered."}</p>
          <div className="mt-8 flex gap-4 text-sm text-muted-foreground">
            {phone && <span>{phone}</span>}
            {email && <span>{email}</span>}
          </div>
        </div>
        <div className="md:col-span-5">
          {headshot ? (
            <div className="aspect-[4/5] overflow-hidden shadow-luxury">
              <img src={headshot} alt={realtorName} className="h-full w-full object-cover" />
            </div>
          ) : <div className="aspect-[4/5] bg-muted" />}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="font-display text-4xl mb-8">Featured Listings</h2>
        {featured.length === 0 ? (
          <p className="text-muted-foreground">No featured listings.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      {sold.length > 0 && (
        <section className="bg-secondary/40 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-display text-4xl mb-8">Recently Sold</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {sold.map((l) => <ListingCard key={l.id} listing={l} soldBadge />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
