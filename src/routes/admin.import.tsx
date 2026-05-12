import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AdminShell } from "@/components/admin-shell";
import { adminListRealtorsDebug } from "@/lib/admin.functions";
import { paragonParseUrl, paragonImportListing } from "@/lib/paragon-import.functions";
import type { Listing } from "@/lib/types";

const searchSchema = z.object({
  realtor: z.string().optional(),
  destination: z.enum(["active", "sold", "commercial"]).optional(),
  links: z.string().optional(),
});

export const Route = createFileRoute("/admin/import")({
  validateSearch: searchSchema,
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});

type Destination = "active" | "sold" | "commercial";
type Parsed = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof paragonParseUrl>>>>;
type ImportForm = Partial<Omit<Listing, "features">> & { features?: any };

type Card = {
  id: string;
  url: string;
  status: "pending" | "parsing" | "ready" | "saving" | "saved" | "error";
  error?: string;
  parsed?: Parsed;
  form: ImportForm;
  images: string[];
  result?: { slug: string; images_stored: number; images_failed: number; warning?: string | null };
};

function Page() {
  const search = Route.useSearch();
  const lr = useServerFn(adminListRealtorsDebug);
  const parseFn = useServerFn(paragonParseUrl);
  const importFn = useServerFn(paragonImportListing);
  const realtorsQ = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }) });
  const realtors = realtorsQ.data?.rows ?? [];
  const debug = realtorsQ.data?.debug;

  const [realtorId, setRealtorId] = useState(search.realtor ?? "");
  const [destination, setDestination] = useState<Destination>(search.destination ?? "active");
  const [links, setLinks] = useState(search.links ?? "");
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!realtorId && realtors.length > 0 && !search.realtor && realtors.length === 1) setRealtorId(realtors[0].id);
  }, [realtors, realtorId, search.realtor]);

  const onGenerate = async () => {
    setError(null);
    if (!realtorId) return setError("Select a realtor first.");
    const urls = links.split("\n").map((s: string) => s.trim()).filter(Boolean);
    if (urls.length === 0) return setError("Paste at least one Paragon link.");
    const initial: Card[] = urls.map((u: string, i: number) => ({ id: `${Date.now()}-${i}`, url: u, status: "parsing", form: {}, images: [] }));
    setCards(initial);

    for (const card of initial) {
      try {
        const p = await parseFn({ data: { url: card.url } });
        setCards((prev) => prev.map((c) => c.id === card.id ? {
          ...c,
          status: "ready",
          parsed: p,
          images: p.image_urls,
          form: {
            title: p.title,
            address: p.address,
            city: p.city,
            price: p.price,
            status: destination === "sold" ? "sold" : "active",
            category: destination === "commercial" ? "commercial" : p.category,
            transaction_type: p.transaction_type,
            property_type: p.property_type,
            beds: p.beds,
            baths: p.baths,
            sqft: p.sqft,
            lot_size: p.lot_size,
            mls_number: p.mls_number,
            description: p.description,
            features: p.features,
            pdf_url: p.pdf_url,
          },
        } : c));
      } catch (e: any) {
        setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, status: "error", error: e?.message ?? String(e) } : c));
      }
    }
  };

  const updateCard = (id: string, patch: Partial<Card>) => setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));

  const saveCard = async (card: Card) => {
    updateCard(card.id, { status: "saving", error: undefined });
    try {
      const r = await importFn({ data: { realtorId, destination, paragonUrl: card.url, listing: card.form as Partial<Listing>, imageUrls: card.images } });
      updateCard(card.id, { status: "saved", result: r });
    } catch (e: any) {
      updateCard(card.id, { status: "error", error: e?.message ?? String(e) });
    }
  };

  const saveAll = async () => {
    for (const c of cards) if (c.status === "ready") await saveCard(c);
  };

  const showDropdownDebug = !realtorsQ.isLoading && realtors.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bluluma</div>
          <h1 className="mt-2 font-display text-4xl">Import from Paragon</h1>
          <div className="gold-rule mt-4 max-w-xs" />
        </div>
        <Link to="/admin/dashboard" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
      </div>

      <div className="border border-accent bg-secondary text-secondary-foreground p-4 text-sm">
        <strong>Legal:</strong> Only import listings and photos that the Realtor has permission to use. MLS and Paragon content may be subject to brokerage, board, and MLS usage rules.
      </div>

      <section className="bg-card shadow-card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Realtor</div>
            <select className="w-full h-11 px-3 border border-border bg-background" value={realtorId} onChange={(e) => setRealtorId(e.target.value)}>
              <option value="">{realtorsQ.isLoading ? "Loading…" : "Select a realtor…"}</option>
              {realtors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Destination</div>
            <select className="w-full h-11 px-3 border border-border bg-background" value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
              <option value="active">Active Featured Listing</option>
              <option value="sold">Sold Listing</option>
              <option value="commercial">Commercial Listing</option>
            </select>
          </label>
        </div>

        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Paragon public listing links</div>
          <textarea className="w-full min-h-32 p-3 border border-border bg-background font-mono text-sm" placeholder="One link per line" value={links} onChange={(e) => setLinks(e.target.value)} />
          <div className="text-xs text-muted-foreground mt-1">One link per line. Each link becomes a review card.</div>
        </label>

        {error && <div className="text-destructive text-sm">{error}</div>}

        <div className="flex justify-end">
          <button onClick={onGenerate} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">Generate Imports</button>
        </div>
      </section>

      {showDropdownDebug && (
        <section className="border border-destructive/40 bg-card text-destructive p-4 text-sm space-y-1">
          <div className="font-medium">Realtor dropdown is empty — Supabase debug</div>
          <div className="font-mono text-xs">Host: {hostnameOf(debug?.supabaseUrl ?? "")}</div>
          <div className="font-mono text-xs">Query: select * from realtors order by name asc</div>
          <div className="font-mono text-xs">Rows returned: {debug?.rowsReturned ?? 0}</div>
          <div className="font-mono text-xs whitespace-pre-wrap">Error: {debug?.error ?? "None"}</div>
        </section>
      )}

      {cards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Review ({cards.length})</h2>
            <button onClick={saveAll} className="px-4 h-9 border border-border text-xs uppercase tracking-[0.18em] hover:bg-muted">Save all ready</button>
          </div>
          {cards.map((c) => <ReviewCard key={c.id} card={c} onChange={(patch) => updateCard(c.id, patch)} onSave={() => saveCard(c)} />)}
        </div>
      )}
    </div>
  );
}

function hostnameOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function ReviewCard({ card, onChange, onSave }: { card: Card; onChange: (patch: Partial<Card>) => void; onSave: () => void }) {
  const { form, images, parsed, status, error, result, url } = card;
  const set = (patch: ImportForm) => onChange({ form: { ...form, ...patch } });
  const featureData = form.features ?? {};
  const updateFeature = (key: string, value: any) => set({ features: { ...featureData, [key]: value } });
  const clientSideOnly = parsed?.diagnostics.rendering_type === "client-side" && !parsed.title && !parsed.address && !parsed.price;

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const copy = [...images];
    const [selected] = copy.splice(index, 1);
    onChange({ images: [selected, ...copy] });
  };

  return (
    <div className="bg-card shadow-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate font-mono">{url}</div>
          <div className="text-xs uppercase tracking-[0.18em] mt-1"><StatusPill status={status} /></div>
        </div>
        {status === "ready" && <button onClick={onSave} className="px-4 h-9 bg-foreground text-background text-xs uppercase tracking-[0.18em]">Save</button>}
        {status === "saved" && result && <span className="text-xs text-accent">Saved · {result.images_stored} images{result.warning ? " · needs photos" : ""}</span>}
      </div>

      {status === "parsing" && <p className="text-sm text-muted-foreground">Extracting listing facts and gallery photos…</p>}
      {status === "error" && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}

      {parsed && status !== "parsing" && (
        <>
          {clientSideOnly && <div className="bg-secondary border border-accent text-secondary-foreground p-3 text-xs">Paragon content appears to require rendered extraction. Review all fields before saving.</div>}
          {images.length === 0 && <div className="bg-secondary border border-accent text-secondary-foreground p-3 text-xs">No property gallery images were detected. Please upload photos manually.</div>}

          <Section title="1. Basic Details" defaultOpen>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Title"><input className="input" value={form.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Address"><input className="input" value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="City"><input className="input" value={form.city ?? ""} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="Province"><input className="input" value={featureData.province ?? parsed.province ?? ""} onChange={(e) => updateFeature("province", e.target.value)} /></Field>
              <Field label="Postal code"><input className="input" value={featureData.postal_code ?? parsed.postal_code ?? ""} onChange={(e) => updateFeature("postal_code", e.target.value)} /></Field>
              <Field label="Price"><input type="number" className="input" value={form.price ?? ""} onChange={(e) => set({ price: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="MLS #"><input className="input" value={form.mls_number ?? ""} onChange={(e) => set({ mls_number: e.target.value })} /></Field>
              <Field label="Status"><input className="input" value={form.status ?? ""} onChange={(e) => set({ status: e.target.value })} /></Field>
              <Field label="Category"><input className="input" value={form.category ?? ""} onChange={(e) => set({ category: e.target.value })} /></Field>
              <Field label="Transaction"><input className="input" value={form.transaction_type ?? ""} onChange={(e) => set({ transaction_type: e.target.value })} /></Field>
              <Field label="Property type"><input className="input" value={form.property_type ?? ""} onChange={(e) => set({ property_type: e.target.value })} /></Field>
              <Field label="PDF/report URL"><input className="input" value={form.pdf_url ?? ""} onChange={(e) => set({ pdf_url: e.target.value })} /></Field>
            </div>
          </Section>

          <Section title="2. Property Specs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Beds"><input type="number" className="input" value={form.beds ?? ""} onChange={(e) => set({ beds: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Baths"><input type="number" step="0.5" className="input" value={form.baths ?? ""} onChange={(e) => set({ baths: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Sqft"><input type="number" className="input" value={form.sqft ?? ""} onChange={(e) => set({ sqft: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Lot size"><input className="input" value={form.lot_size ?? ""} onChange={(e) => set({ lot_size: e.target.value })} /></Field>
              {[
                ["year_built", "Year built"], ["strata_fee", "Strata fee"], ["taxes", "Taxes"], ["zoning", "Zoning"],
                ["parking", "Parking"], ["garage", "Garage / carport"], ["property_style", "Property style"], ["building_type", "Building type"],
                ["land_size", "Land size"], ["floor_area", "Floor area"], ["units", "Units"], ["lease_sale_information", "Lease / sale info"],
              ].map(([key, label]) => <Field key={key} label={label}><input className="input" value={featureData[key] ?? ""} onChange={(e) => updateFeature(key, e.target.value)} /></Field>)}
            </div>
          </Section>

          <Section title="3. Description">
            <Field label="Public remarks / marketing description"><textarea className="input min-h-32" value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
          </Section>

          <Section title="4. Brokerage / Company Info">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["brokerage", "Brokerage"], ["listing_agent", "Listing agent"], ["co_listing_agent", "Co-listing agent"], ["office_name", "Office name"]].map(([key, label]) => (
                <Field key={key} label={label}><input className="input" value={featureData[key] ?? ""} onChange={(e) => updateFeature(key, e.target.value)} /></Field>
              ))}
            </div>
          </Section>

          <Section title="5. Features / Amenities">
            <div className="grid md:grid-cols-2 gap-3">
              {[
                ["feature_list", "General features"], ["interior_features", "Interior features"], ["exterior_features", "Exterior features"], ["amenities", "Amenities"],
                ["appliances", "Appliances"], ["utilities", "Utilities"], ["heating", "Heating"], ["cooling", "Cooling"],
                ["fireplace", "Fireplace"], ["basement", "Basement"], ["view", "View"], ["site_influences", "Site influences"],
                ["nearby_amenities", "Nearby amenities"], ["public_transportation", "Public transportation"],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <textarea
                    className="input min-h-20"
                    value={Array.isArray(featureData[key]) ? featureData[key].join("\n") : featureData[key] ?? ""}
                    onChange={(e) => updateFeature(key, ["feature_list", "interior_features", "exterior_features", "amenities", "appliances", "utilities", "site_influences", "nearby_amenities"].includes(key) ? e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) : e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </Section>

          <Section title={`6. Raw Facts Extracted (${parsed.raw_facts.length})`}>
            <div className="max-h-80 overflow-auto border border-border divide-y divide-border">
              {parsed.raw_facts.map((fact, i) => (
                <div key={`${fact.label}-${i}`} className="grid md:grid-cols-[220px_1fr_120px] gap-3 p-3 text-xs">
                  <div className="font-medium">{fact.label}</div>
                  <div className="text-muted-foreground break-words">{fact.value}</div>
                  <div className="font-mono text-muted-foreground">{fact.source}</div>
                </div>
              ))}
              {parsed.raw_facts.length === 0 && <div className="p-4 text-sm text-muted-foreground">No key/value facts detected.</div>}
            </div>
          </Section>

          <Section title={`7. Gallery Images (${images.length})`} defaultOpen>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {images.map((u, i) => (
                <div key={u + i} className="relative aspect-[4/3] bg-muted border border-border overflow-hidden">
                  <img
                    src={`/api/image-proxy?url=${encodeURIComponent(u)}`}
                    className="h-full w-full object-cover"
                    alt="Imported property gallery candidate"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.25"; }}
                  />
                  <div className="absolute left-1 top-1 flex gap-1">
                    <button onClick={() => makePrimary(i)} className="bg-background/90 text-foreground text-[10px] px-1.5 py-0.5 border border-border">{i === 0 ? "Primary" : "Set primary"}</button>
                  </div>
                  <button onClick={() => onChange({ images: images.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 bg-foreground text-background text-[10px] px-1.5 py-0.5">×</button>
                </div>
              ))}
              {images.length === 0 && <div className="col-span-full p-4 border border-border text-sm text-muted-foreground">No kept property gallery images.</div>}
            </div>
          </Section>

          <details className="text-xs border border-border p-3">
            <summary className="cursor-pointer text-muted-foreground">Parser diagnostics</summary>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono">
              <Diag k="Fetch success" v={String(parsed.diagnostics.fetch_success)} />
              <Diag k="Final URL" v={parsed.diagnostics.final_url ?? "—"} />
              <Diag k="HTTP status" v={String(parsed.diagnostics.plain_fetch_status ?? "—")} />
              <Diag k="HTML length" v={String(parsed.diagnostics.html_length)} />
              <Diag k="Page title" v={parsed.diagnostics.page_title ?? "—"} />
              <Diag k="Text blocks" v={String(parsed.diagnostics.text_blocks_found)} />
              <Diag k="Key/value rows" v={String(parsed.diagnostics.key_value_rows_found)} />
              <Diag k="Image URLs found" v={String(parsed.diagnostics.image_urls_found)} />
              <Diag k="Images kept" v={String(parsed.diagnostics.gallery_images_kept)} />
              <Diag k="Images rejected" v={String(parsed.diagnostics.images_rejected)} />
              <Diag k="Rendering" v={parsed.diagnostics.rendering_type} />
              <Diag k="Firecrawl used" v={String(parsed.diagnostics.firecrawl_used)} />
              <Diag k="Blocked" v={String(parsed.diagnostics.page_blocked)} />
              <Diag k="Client rendered" v={String(parsed.diagnostics.appears_client_side_rendered)} />
            </div>
            {parsed.parse_warnings.length > 0 && <div className="text-accent mt-2 text-xs">Warnings: {parsed.parse_warnings.join("; ")}</div>}
            {parsed.diagnostics.firecrawl_error && <div className="text-destructive mt-2 text-xs">Rendered extraction: {parsed.diagnostics.firecrawl_error}</div>}
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <DiagnosticList title="Selectors used" items={parsed.diagnostics.selectors_used} />
              <DiagnosticList title="Selectors failed" items={parsed.diagnostics.selectors_failed} />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-muted-foreground">Image preflight checks ({parsed.diagnostics.image_checks.length})</summary>
              <div className="mt-2 max-h-72 overflow-auto border border-border divide-y divide-border">
                {parsed.diagnostics.image_checks.map((c, i) => (
                  <div key={`${c.url}-${i}`} className="p-2 grid md:grid-cols-[1fr_120px_160px_160px] gap-2">
                    <div className="break-all font-mono">{c.url}</div>
                    <div className={c.ok ? "text-accent" : "text-destructive"}>{c.ok ? "ok" : "rejected"}</div>
                    <div className="font-mono text-muted-foreground">HTTP {c.status ?? "—"} · {c.content_type ?? "?"}</div>
                    <div className="font-mono text-muted-foreground">{c.content_length ?? "?"}B · {c.reason ?? ""}</div>
                  </div>
                ))}
                {parsed.diagnostics.image_checks.length === 0 && <div className="p-3 text-sm text-muted-foreground">No images to preflight.</div>}
              </div>
            </details>
            <details className="mt-3">
              <summary className="cursor-pointer text-muted-foreground">Rejected images ({parsed.rejected_images.length})</summary>
              <div className="mt-2 max-h-72 overflow-auto border border-border divide-y divide-border">
                {parsed.rejected_images.map((img, i) => (
                  <div key={`${img.url}-${i}`} className="p-2 grid md:grid-cols-[1fr_220px_120px] gap-2">
                    <div className="break-all font-mono">{img.url}</div>
                    <div>{img.reason}</div>
                    <div className="font-mono text-muted-foreground">{img.source}</div>
                  </div>
                ))}
              </div>
            </details>
            <details className="mt-3"><summary className="cursor-pointer text-muted-foreground">Detected text blocks</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap bg-muted p-3">{parsed.detected_text_blocks.join("\n")}</pre></details>
            <details className="mt-3"><summary className="cursor-pointer text-muted-foreground">Raw HTML preview</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap bg-muted p-3">{parsed.html_preview}</pre></details>
          </details>
        </>
      )}
      <style>{`.input{width:100%;height:2.5rem;padding:0 .65rem;border:1px solid var(--border);background:var(--background);font-size:.875rem}textarea.input{height:auto;padding:.5rem .65rem}`}</style>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="border border-border p-4" open={defaultOpen}>
      <summary className="cursor-pointer font-display text-xl">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function StatusPill({ status }: { status: Card["status"] }) {
  const map: Record<Card["status"], string> = { pending: "text-muted-foreground", parsing: "text-accent", ready: "text-accent", saving: "text-accent", saved: "text-accent", error: "text-destructive" };
  return <span className={map[status]}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>{children}</label>;
}

function Diag({ k, v }: { k: string; v: string }) {
  return <div className="border border-border p-2"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div><div className="truncate" title={v}>{v}</div></div>;
}

function DiagnosticList({ title, items }: { title: string; items: string[] }) {
  return <div className="border border-border p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</div>{items.length ? <ul className="space-y-1">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <div className="text-muted-foreground">None</div>}</div>;
}
