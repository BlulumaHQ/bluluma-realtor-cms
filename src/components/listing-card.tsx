import { Link } from "@tanstack/react-router";
import type { Listing } from "@/lib/types";

function formatPrice(p: number | null) {
  if (!p) return "Price on request";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(p);
}

type Variant = "default" | "feature" | "compact";

export function ListingCard({
  listing,
  soldBadge = false,
  variant = "default",
}: {
  listing: Listing;
  soldBadge?: boolean;
  variant?: Variant;
}) {
  const detailRoute = soldBadge ? "/sold/$slug" : "/listings/$slug";

  if (variant === "feature") {
    return (
      <Link
        to={detailRoute}
        params={{ slug: listing.slug }}
        className="group grid md:grid-cols-2 gap-8 md:gap-12 items-center bg-card shadow-card hover:shadow-luxury transition-all duration-500"
      >
        <div className="relative aspect-[4/3] md:aspect-[5/4] overflow-hidden bg-muted">
          {listing.primary_image_url ? (
            <img
              src={listing.primary_image_url}
              alt={listing.address ?? listing.title ?? "Listing"}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">No photo</div>
          )}
          <div
            className="absolute top-5 left-5 text-xs uppercase tracking-[0.2em] px-3 py-1.5 text-background"
            style={{ background: soldBadge ? "var(--foreground)" : "var(--brand, var(--accent))" }}
          >
            {soldBadge ? "Sold" : "Featured"}
          </div>
        </div>
        <div className="p-8 md:p-4 md:pr-10">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{listing.city}</div>
          <div className="font-display text-4xl md:text-5xl mt-3 leading-tight">{formatPrice(listing.price)}</div>
          <div className="mt-3 text-lg text-foreground/80">{listing.address}</div>
          <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
            {listing.beds != null && <span>{listing.beds} Bed</span>}
            {listing.baths != null && <span>{listing.baths} Bath</span>}
            {listing.sqft != null && <span>{listing.sqft.toLocaleString()} sqft</span>}
          </div>
          {listing.description && (
            <p className="mt-6 text-muted-foreground line-clamp-3">{listing.description}</p>
          )}
          <div
            className="mt-8 inline-flex items-center text-sm uppercase tracking-[0.2em] border-b pb-1 transition"
            style={{ color: "var(--brand, var(--foreground))", borderColor: "var(--brand, var(--foreground))" }}
          >
            View property →
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={detailRoute}
      params={{ slug: listing.slug }}
      className="group block bg-card shadow-card hover:shadow-luxury transition-all duration-500"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {listing.primary_image_url ? (
          <img
            src={listing.primary_image_url}
            alt={listing.address ?? listing.title ?? "Listing"}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">No photo</div>
        )}
        <div
          className="absolute top-4 left-4 text-xs uppercase tracking-[0.2em] px-3 py-1.5 text-background"
          style={{ background: soldBadge ? "var(--foreground)" : "var(--brand, var(--accent))" }}
        >
          {soldBadge ? "Sold" : "For Sale"}
        </div>
      </div>
      <div className="p-6">
        <div className="font-display text-2xl text-foreground">{formatPrice(listing.price)}</div>
        <div className="mt-1 text-foreground/90">{listing.address}</div>
        <div className="text-sm text-muted-foreground">{listing.city}</div>
        <div className="mt-4 flex items-center gap-5 text-sm text-muted-foreground">
          {listing.beds != null && <span>{listing.beds} Bed</span>}
          {listing.baths != null && <span>{listing.baths} Bath</span>}
          {listing.sqft != null && <span>{listing.sqft.toLocaleString()} sqft</span>}
        </div>
      </div>
    </Link>
  );
}
