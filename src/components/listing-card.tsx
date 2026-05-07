import { Link } from "@tanstack/react-router";
import type { Listing } from "@/lib/types";

function formatPrice(p: number | null) {
  if (!p) return "Price on request";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(p);
}

export function ListingCard({ listing, soldBadge = false }: { listing: Listing; soldBadge?: boolean }) {
  const detailRoute = soldBadge ? "/sold/$slug" : "/listings/$slug";
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
        {soldBadge && (
          <div className="absolute top-4 left-4 bg-foreground text-background text-xs uppercase tracking-[0.2em] px-3 py-1.5">
            Sold
          </div>
        )}
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
