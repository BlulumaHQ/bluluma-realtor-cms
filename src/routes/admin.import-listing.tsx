import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { adminListRealtors } from "@/lib/admin.functions";
import { paragonParseUrl, paragonImportListing } from "@/lib/paragon-import.functions";
import type { Listing } from "@/lib/types";

export const Route = createFileRoute("/admin/import-listing")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});

type Destination = "active" | "sold" | "commercial";

type Parsed = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof paragonParseUrl>>>>;

function Page() {
  const navigate = useNavigate();
  const lr = useServerFn(adminListRealtors);
  const parseFn = useServerFn(paragonParseUrl);
  const importFn = useServerFn(paragonImportListing);
  const realtors = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }) });

  const [realtorId, setRealtorId] = useState("");
  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState<Destination>("active");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [form, setForm] = useState<Partial<Listing>>({});
  const [images, setImages] = useState<string[]>([]);
  const [newImg, setNewImg] = useState("");
  const [result, setResult] = useState<{ slug: string; images_stored: number; images_failed: number; failed_urls: string[] } | null>(null);

  const updateForm = (patch: Partial<Listing>) => setForm((s) => ({ ...s, ...patch }));

  const onParse = async () => {
    setError(null);
    setResult(null);
    if (!realtorId) return setError("Select a realtor first.");
    if (!url.trim()) return setError("Paste a Paragon public listing URL.");
    setParsing(true);
    try {
      const p = await parseFn({ data: { url: url.trim() } });
      setParsed(p);
      setImages(p.image_urls);
      setForm({
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
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setParsing(false);
    }
  };

  const onSave = async () => {
    setError(null);
    setImporting(true);
    try {
      const r = await importFn({
        data: {
          realtorId,
          destination,
          paragonUrl: url.trim(),
          listing: form,
          imageUrls: images,
        },
      });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-4xl">Import from Paragon</h1>
        <div className="gold-rule mt-4 max-w-xs" />
      </div>

      <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 text-sm">
        <strong>Legal:</strong> Only import listings and photos that the Realtor has permission to use.
        MLS and Paragon content may be subject to brokerage, board, and MLS usage rules.
      </div>

      {result ? (
        <div className="bg-card shadow-card p-6 space-y-4">
          <h2 className="font-display text-2xl">Listing imported</h2>
          <p>Images copied: {result.images_stored} · Failed: {result.images_failed}</p>
          {result.images_failed > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 text-sm">
              Images could not be copied automatically. Please upload them manually on the edit screen.
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => navigate({ to: "/admin/listings" })} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">
              Go to listings
            </button>
            <button
              onClick={() => {
                setResult(null); setParsed(null); setUrl(""); setForm({}); setImages([]);
              }}
              className="px-5 h-10 border border-border text-sm uppercase tracking-[0.18em]"
            >
              Import another
            </button>
          </div>
        </div>
      ) : !parsed ? (
        <div className="bg-card shadow-card p-6 space-y-4">
          <Field label="Realtor">
            <select className="input" value={realtorId} onChange={(e) => setRealtorId(e.target.value)}>
              <option value="">Select a realtor…</option>
              {(realtors.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Paragon public listing URL">
            <input className="input" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field label="Destination">
            <select className="input" value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
              <option value="active">Active Featured Listing</option>
              <option value="sold">Sold Listing</option>
              <option value="commercial">Commercial Listing</option>
            </select>
          </Field>
          {error && <div className="text-destructive text-sm whitespace-pre-wrap">{error}</div>}
          <button
            onClick={onParse}
            disabled={parsing}
            className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em] disabled:opacity-50"
          >
            {parsing ? "Extracting…" : "Test Extraction"}
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            Fetches and renders the Paragon page (headless when needed). Shows parsed fields for review — nothing is saved until you click <strong>Save Listing</strong>.</p>
          <style>{`.input{width:100%;height:2.75rem;padding:0 .75rem;border:1px solid var(--border);background:var(--background)}`}</style>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card shadow-card p-6">
            <h2 className="font-display text-2xl mb-4">Review before save</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Title"><input className="input" value={form.title ?? ""} onChange={(e) => updateForm({ title: e.target.value })} /></Field>
              <Field label="Address"><input className="input" value={form.address ?? ""} onChange={(e) => updateForm({ address: e.target.value })} /></Field>
              <Field label="City"><input className="input" value={form.city ?? ""} onChange={(e) => updateForm({ city: e.target.value })} /></Field>
              <Field label="Price"><input type="number" className="input" value={form.price ?? ""} onChange={(e) => updateForm({ price: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Status"><input className="input" value={form.status ?? ""} onChange={(e) => updateForm({ status: e.target.value })} /></Field>
              <Field label="Category"><input className="input" value={form.category ?? ""} onChange={(e) => updateForm({ category: e.target.value })} /></Field>
              <Field label="Transaction"><input className="input" value={form.transaction_type ?? ""} onChange={(e) => updateForm({ transaction_type: e.target.value })} /></Field>
              <Field label="Property type"><input className="input" value={form.property_type ?? ""} onChange={(e) => updateForm({ property_type: e.target.value })} /></Field>
              <Field label="Beds"><input type="number" className="input" value={form.beds ?? ""} onChange={(e) => updateForm({ beds: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Baths"><input type="number" step="0.5" className="input" value={form.baths ?? ""} onChange={(e) => updateForm({ baths: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Sqft"><input type="number" className="input" value={form.sqft ?? ""} onChange={(e) => updateForm({ sqft: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Lot size"><input className="input" value={form.lot_size ?? ""} onChange={(e) => updateForm({ lot_size: e.target.value })} /></Field>
              <Field label="MLS #"><input className="input" value={form.mls_number ?? ""} onChange={(e) => updateForm({ mls_number: e.target.value })} /></Field>
              <Field label="PDF URL"><input className="input" value={form.pdf_url ?? ""} onChange={(e) => updateForm({ pdf_url: e.target.value })} /></Field>
            </div>
            <Field label="Description">
              <textarea className="input min-h-24" value={form.description ?? ""} onChange={(e) => updateForm({ description: e.target.value })} />
            </Field>
            <Field label="Features (one per line)">
              <textarea
                className="input min-h-24"
                value={Array.isArray(form.features) ? form.features.join("\n") : ""}
                onChange={(e) => updateForm({ features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) as any })}
              />
            </Field>
          </div>

          <div className="bg-card shadow-card p-6">
            <div className="flex items-end justify-between mb-3">
              <h3 className="font-display text-xl">Images ({images.length})</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((u, i) => (
                <div key={u + i} className="relative aspect-[4/3] bg-muted">
                  <img src={u} className="h-full w-full object-cover" />
                  <button
                    onClick={() => setImages((arr) => arr.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-foreground text-background text-xs px-2 py-1"
                  >×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input className="input flex-1" placeholder="Add image URL" value={newImg} onChange={(e) => setNewImg(e.target.value)} />
              <button
                onClick={() => { if (newImg.trim()) { setImages((a) => [...a, newImg.trim()]); setNewImg(""); } }}
                className="px-4 h-11 border border-border text-sm uppercase tracking-[0.18em]"
              >Add</button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Images will be copied into Supabase storage on save. Additional photos can be uploaded after save from the edit screen.
            </p>
          </div>

          <div className="bg-card shadow-card p-6 space-y-4">
            <h3 className="font-display text-xl">Parser diagnostics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
              <Diag k="Fetch success" v={String(parsed.diagnostics.fetch_success)} />
              <Diag k="HTTP status" v={String(parsed.diagnostics.plain_fetch_status ?? "—")} />
              <Diag k="HTML returned" v={String(parsed.diagnostics.html_returned)} />
              <Diag k="HTML length" v={String(parsed.diagnostics.html_length)} />
              <Diag k="Page blocked" v={String(parsed.diagnostics.page_blocked)} />
              <Diag k="Rendering" v={parsed.diagnostics.rendering_type} />
              <Diag k="Firecrawl used" v={String(parsed.diagnostics.firecrawl_used)} />
              <Diag k="Gallery images" v={String(parsed.diagnostics.gallery_images_detected)} />
              <Diag k="Images found" v={String(parsed.image_urls.length)} />
            </div>
            {parsed.diagnostics.firecrawl_error && (
              <div className="text-destructive text-xs font-mono">Firecrawl error: {parsed.diagnostics.firecrawl_error}</div>
            )}
            {parsed.parse_warnings.length > 0 && (
              <div className="text-amber-700 text-xs">Warnings: {parsed.parse_warnings.join("; ")}</div>
            )}

            <details className="text-xs font-mono">
              <summary className="cursor-pointer">Matched / failed selectors</summary>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {Object.entries(parsed.matched_selectors).map(([k, v]) => (
                  <div key={k} className={v ? "text-emerald-700" : "text-destructive"}>
                    {v ? "✓" : "✗"} {k}
                  </div>
                ))}
              </div>
            </details>

            <details className="text-xs font-mono">
              <summary className="cursor-pointer">Detected image URLs ({parsed.image_urls.length})</summary>
              <ul className="mt-2 space-y-1 break-all">
                {parsed.image_urls.slice(0, 30).map((u) => <li key={u}>{u}</li>)}
              </ul>
            </details>

            <details className="text-xs font-mono">
              <summary className="cursor-pointer">Detected text blocks ({parsed.detected_text_blocks.length})</summary>
              <ul className="mt-2 space-y-1">
                {parsed.detected_text_blocks.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </details>

            <details className="text-xs font-mono">
              <summary className="cursor-pointer">Raw HTML preview (first 3000 chars)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all bg-background p-2 border border-border max-h-80 overflow-auto">{parsed.html_preview}</pre>
            </details>

            {parsed.markdown_preview && (
              <details className="text-xs font-mono">
                <summary className="cursor-pointer">Rendered markdown preview</summary>
                <pre className="mt-2 whitespace-pre-wrap bg-background p-2 border border-border max-h-80 overflow-auto">{parsed.markdown_preview}</pre>
              </details>
            )}

            {parsed.diagnostics.screenshot_url && (
              <details className="text-xs font-mono">
                <summary className="cursor-pointer">Page screenshot</summary>
                <img src={parsed.diagnostics.screenshot_url} alt="page screenshot" className="mt-2 max-w-full border border-border" />
              </details>
            )}

            <details className="text-xs font-mono">
              <summary className="cursor-pointer">Full extracted JSON</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(parsed, null, 2)}</pre>
            </details>
          </div>

          {error && <div className="text-destructive text-sm whitespace-pre-wrap">{error}</div>}

          <div className="flex justify-between">
            <button
              onClick={() => { setParsed(null); setForm({}); setImages([]); }}
              className="px-5 h-10 border border-border text-sm uppercase tracking-[0.18em]"
            >Back</button>
            <button
              onClick={onSave}
              disabled={importing}
              className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em] disabled:opacity-50"
            >{importing ? "Saving…" : "Save Listing"}</button>
          </div>
          <style>{`.input{width:100%;height:2.75rem;padding:0 .75rem;border:1px solid var(--border);background:var(--background)}textarea.input{height:auto;padding:.6rem .75rem}`}</style>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1 mt-3">{label}</div>
      {children}
    </label>
  );
}
