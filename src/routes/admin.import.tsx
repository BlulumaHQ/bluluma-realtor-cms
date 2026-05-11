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

type Card = {
  id: string;
  url: string;
  status: "pending" | "parsing" | "ready" | "saving" | "saved" | "error";
  error?: string;
  parsed?: Parsed;
  form: Partial<Listing>;
  images: string[];
  result?: { slug: string; images_stored: number; images_failed: number };
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
    if (!realtorId && realtors.length > 0 && !search.realtor) {
      // auto-pick if exactly one
      if (realtors.length === 1) setRealtorId(realtors[0].id);
    }
  }, [realtors, realtorId, search.realtor]);

  const onGenerate = async () => {
    setError(null);
    if (!realtorId) return setError("Select a realtor first.");
    const urls = links.split("\n").map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) return setError("Paste at least one Paragon link.");
    const initial: Card[] = urls.map((u, i) => ({
      id: `${Date.now()}-${i}`,
      url: u,
      status: "parsing",
      form: {},
      images: [],
    }));
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

  const updateCard = (id: string, patch: Partial<Card>) =>
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));

  const saveCard = async (card: Card) => {
    updateCard(card.id, { status: "saving", error: undefined });
    try {
      const r = await importFn({
        data: {
          realtorId,
          destination,
          paragonUrl: card.url,
          listing: card.form,
          imageUrls: card.images,
        },
      });
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

      <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 text-sm">
        <strong>Legal:</strong> Only import listings and photos that the Realtor has permission to use.
        MLS and Paragon content may be subject to brokerage, board, and MLS usage rules.
      </div>

      <section className="bg-card shadow-card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Realtor</div>
            <select
              className="w-full h-11 px-3 border border-border bg-background"
              value={realtorId}
              onChange={(e) => setRealtorId(e.target.value)}
            >
              <option value="">{realtorsQ.isLoading ? "Loading…" : "Select a realtor…"}</option>
              {realtors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Destination</div>
            <select
              className="w-full h-11 px-3 border border-border bg-background"
              value={destination}
              onChange={(e) => setDestination(e.target.value as Destination)}
            >
              <option value="active">Active Featured Listing</option>
              <option value="sold">Sold Listing</option>
              <option value="commercial">Commercial Listing</option>
            </select>
          </label>
        </div>

        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Paragon public listing links</div>
          <textarea
            className="w-full min-h-32 p-3 border border-border bg-background font-mono text-sm"
            placeholder="One link per line"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
          />
          <div className="text-xs text-muted-foreground mt-1">One link per line. Each link becomes a review card.</div>
        </label>

        {error && <div className="text-destructive text-sm">{error}</div>}

        <div className="flex justify-end">
          <button onClick={onGenerate} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">
            Generate Imports
          </button>
        </div>
      </section>

      {showDropdownDebug && (
        <section className="border border-destructive/40 bg-destructive/5 text-destructive p-4 text-sm space-y-1">
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
          {cards.map((c) => (
            <ReviewCard
              key={c.id}
              card={c}
              onChange={(patch) => updateCard(c.id, patch)}
              onSave={() => saveCard(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function hostnameOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function ReviewCard({
  card,
  onChange,
  onSave,
}: {
  card: Card;
  onChange: (patch: Partial<Card>) => void;
  onSave: () => void;
}) {
  const { form, images, parsed, status, error, result, url } = card;
  const set = (patch: Partial<Listing>) => onChange({ form: { ...form, ...patch } });
  const clientSideOnly = parsed?.diagnostics.rendering_type === "client-side" && !parsed.title && !parsed.address && !parsed.price;

  return (
    <div className="bg-card shadow-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate font-mono">{url}</div>
          <div className="text-xs uppercase tracking-[0.18em] mt-1">
            <StatusPill status={status} />
          </div>
        </div>
        {status === "ready" && (
          <button onClick={onSave} className="px-4 h-9 bg-foreground text-background text-xs uppercase tracking-[0.18em]">Save</button>
        )}
        {status === "saved" && result && (
          <span className="text-xs text-emerald-700">Saved · {result.images_stored} images</span>
        )}
      </div>

      {status === "parsing" && <p className="text-sm text-muted-foreground">Extracting…</p>}
      {status === "error" && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}

      {parsed && status !== "parsing" && (
        <>
          {clientSideOnly && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 text-xs">
              Paragon content appears to require rendered extraction. Manual review required — fields below may be empty. Edit before saving.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Title"><input className="input" value={form.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Address"><input className="input" value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label="City"><input className="input" value={form.city ?? ""} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="Price"><input type="number" className="input" value={form.price ?? ""} onChange={(e) => set({ price: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="MLS #"><input className="input" value={form.mls_number ?? ""} onChange={(e) => set({ mls_number: e.target.value })} /></Field>
            <Field label="Property type"><input className="input" value={form.property_type ?? ""} onChange={(e) => set({ property_type: e.target.value })} /></Field>
            <Field label="Beds"><input type="number" className="input" value={form.beds ?? ""} onChange={(e) => set({ beds: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Baths"><input type="number" step="0.5" className="input" value={form.baths ?? ""} onChange={(e) => set({ baths: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Sqft"><input type="number" className="input" value={form.sqft ?? ""} onChange={(e) => set({ sqft: e.target.value ? Number(e.target.value) : null })} /></Field>
          </div>
          <Field label="Description">
            <textarea className="input min-h-20" value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </Field>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Images ({images.length})</div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {images.map((u, i) => (
                <div key={u + i} className="relative aspect-[4/3] bg-muted">
                  <img src={u} className="h-full w-full object-cover" />
                  <button
                    onClick={() => onChange({ images: images.filter((_, idx) => idx !== i) })}
                    className="absolute top-1 right-1 bg-foreground text-background text-[10px] px-1.5 py-0.5"
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Parser diagnostics</summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 font-mono">
              <Diag k="Fetch success" v={String(parsed.diagnostics.fetch_success)} />
              <Diag k="HTTP status" v={String(parsed.diagnostics.plain_fetch_status ?? "—")} />
              <Diag k="HTML length" v={String(parsed.diagnostics.html_length)} />
              <Diag k="Title detected" v={parsed.title || "—"} />
              <Diag k="Text blocks" v={String(parsed.detected_text_blocks.length)} />
              <Diag k="Image URLs" v={String(parsed.image_urls.length)} />
              <Diag k="Rendering" v={parsed.diagnostics.rendering_type} />
              <Diag k="Firecrawl used" v={String(parsed.diagnostics.firecrawl_used)} />
              <Diag k="Blocked" v={String(parsed.diagnostics.page_blocked)} />
            </div>
            {parsed.parse_warnings.length > 0 && (
              <div className="text-amber-700 mt-2 text-xs">Warnings: {parsed.parse_warnings.join("; ")}</div>
            )}
            {parsed.diagnostics.firecrawl_error && (
              <div className="text-destructive mt-2 text-xs">Firecrawl: {parsed.diagnostics.firecrawl_error}</div>
            )}
          </details>
        </>
      )}
      <style>{`.input{width:100%;height:2.5rem;padding:0 .65rem;border:1px solid var(--border);background:var(--background);font-size:.875rem}textarea.input{height:auto;padding:.5rem .65rem}`}</style>
    </div>
  );
}

function StatusPill({ status }: { status: Card["status"] }) {
  const map: Record<Card["status"], string> = {
    pending: "text-muted-foreground",
    parsing: "text-accent",
    ready: "text-emerald-700",
    saving: "text-accent",
    saved: "text-emerald-700",
    error: "text-destructive",
  };
  return <span className={map[status]}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Diag({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="truncate">{v}</div>
    </div>
  );
}
