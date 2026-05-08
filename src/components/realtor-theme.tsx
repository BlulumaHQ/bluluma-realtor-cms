import type { CSSProperties, ReactNode } from "react";
import type { Realtor } from "@/lib/types";

const DEFAULT_BRAND = "oklch(0.45 0.05 250)";

/** Wraps Realtor frontend with brand-color CSS variables. */
export function RealtorTheme({ realtor, children, className }: { realtor: Realtor | null; children: ReactNode; className?: string }) {
  const brand = realtor?.brand_color?.trim() || DEFAULT_BRAND;
  const style = {
    "--brand": brand,
    "--brand-foreground": "oklch(0.99 0 0)",
  } as CSSProperties;
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/** Listings empty state shown only in preview/admin modes. */
export function ListingsEmpty({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="border border-dashed border-border rounded-sm py-20 px-8 text-center bg-secondary/30">
      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Empty</div>
      <div className="mt-3 font-display text-2xl">{label}</div>
      {hint && <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">{hint}</p>}
    </div>
  );
}
