import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AdminShell } from "@/components/admin-shell";
import { adminListRealtorsDebug } from "@/lib/admin.functions";
import { paragonAnalyzeLinks, paragonImportItem } from "@/lib/paragon-import.functions";

const searchSchema = z.object({
  realtor: z.string().optional(),
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

type Classification = "active" | "sold" | "commercial_sale" | "commercial_lease" | "needs_review";
type DupStatus = "already_posted" | "new" | "needs_review";

type Item = {
  rowId: string;
  mls_number: string | null;
  address: string | null;
  price: number | null;
  status_label: string | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  detail_url: string | null;
  image_url: string | null;
  image_urls: string[];
  thumbnail_url: string | null;
  image_checks: Array<{ url: string; ok: boolean; status: number | null; content_type: string | null; reason: string | null }>;
  diagnostics: string[];
  raw_anchors: string[];
  candidate_urls: string[];
  classification: Classification;
  duplicate_status: DupStatus;
  duplicate_listing_id: string | null;
  source_url: string;
  source_kind: "group" | "single";
  source_window: string;
  selected: boolean;
  destination: "active" | "sold" | "commercial";
  updateExisting: boolean;
  importStatus: "idle" | "importing" | "imported" | "skipped" | "error";
  importError?: string;
  importResult?: { slug: string; images_stored: number; images_failed: number; warning?: string | null; parsed_individual?: boolean; parse_error?: string | null };
};

type Entry = { url: string; kind: "group" | "single" | "unknown"; itemCount: number; firecrawlUsed: boolean; finalUrl: string | null; error: string | null; diagnostics: string[]; raw_anchors: string[]; candidate_urls: string[] };

function isImportReady(item: Item) {
  return !!item.address && !!item.mls_number && item.price != null && item.image_urls.length > 0;
}

function destFromClassification(c: Classification): "active" | "sold" | "commercial" {
  if (c === "sold") return "sold";
  if (c === "commercial_sale" || c === "commercial_lease") return "commercial";
  return "active";
}

function Page() {
  const search = Route.useSearch();
  const lr = useServerFn(adminListRealtorsDebug);
  const analyzeFn = useServerFn(paragonAnalyzeLinks);
  const importItemFn = useServerFn(paragonImportItem);
  const realtorsQ = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }) });
  const realtors = realtorsQ.data?.rows ?? [];
  const debug = realtorsQ.data?.debug;

  const [realtorId, setRealtorId] = useState(search.realtor ?? "");
  const [links, setLinks] = useState(search.links ?? "");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!realtorId && realtors.length === 1 && !search.realtor) setRealtorId(realtors[0].id);
  }, [realtors, realtorId, search.realtor]);

  const onAnalyze = async () => {
    setError(null);
    if (!realtorId) return setError("Select a realtor first.");
    const urls = links.split("\n").map((s: string) => s.trim()).filter(Boolean);
    if (urls.length === 0) return setError("Paste at least one Paragon link.");
    setAnalyzing(true);
    setEntries([]);
    setItems([]);
    try {
      const res = await analyzeFn({ data: { realtorId, urls } });
      const newEntries: Entry[] = res.entries.map((e: any) => ({ url: e.url, kind: e.kind, itemCount: e.itemCount, firecrawlUsed: e.firecrawlUsed, finalUrl: e.finalUrl, error: e.error, diagnostics: e.diagnostics ?? [], raw_anchors: e.raw_anchors ?? [], candidate_urls: e.candidate_urls ?? [] }));
      const newItems: Item[] = res.entries.flatMap((e: any) => e.items.map((it: any, idx: number) => ({
        rowId: `${e.url}-${it.mls_number ?? idx}-${idx}`,
        mls_number: it.mls_number,
        address: it.address,
        price: it.price,
        status_label: it.status_label,
        property_type: it.property_type,
        beds: it.beds,
        baths: it.baths,
        sqft: it.sqft,
        detail_url: it.detail_url,
        image_url: it.image_url,
        image_urls: it.image_urls ?? (it.image_url ? [it.image_url] : []),
        thumbnail_url: it.thumbnail_url,
        image_checks: it.image_checks ?? [],
        diagnostics: it.diagnostics ?? [],
        raw_anchors: it.raw_anchors ?? e.raw_anchors ?? [],
        candidate_urls: it.candidate_urls ?? e.candidate_urls ?? [],
        classification: it.classification,
        duplicate_status: it.duplicate_status,
        duplicate_listing_id: it.duplicate_listing_id,
        source_url: it.source_url,
        source_kind: it.source_kind,
        source_window: it.source_window,
        selected: it.duplicate_status !== "already_posted" && isImportReady({ ...it, image_urls: it.image_urls ?? (it.image_url ? [it.image_url] : []) } as Item),
        destination: destFromClassification(it.classification),
        updateExisting: false,
        importStatus: "idle",
      })));
      setEntries(newEntries);
      setItems(newItems);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (rowId: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => i.rowId === rowId ? { ...i, ...patch } : i));

  const importOne = async (item: Item) => {
    if (item.duplicate_status === "already_posted" && !item.updateExisting) {
      updateItem(item.rowId, { importStatus: "skipped", importError: "Already posted — enable Update Existing to overwrite." });
      return;
    }
    updateItem(item.rowId, { importStatus: "importing", importError: undefined });
    try {
      const r: any = await importItemFn({
        data: {
          realtorId,
          item: {
            mls_number: item.mls_number,
            address: item.address,
            price: item.price,
            status_label: item.status_label,
            property_type: item.property_type,
            beds: item.beds,
            baths: item.baths,
            sqft: item.sqft,
            detail_url: item.detail_url,
            image_url: item.image_url,
            image_urls: item.image_urls,
            thumbnail_url: item.thumbnail_url,
            image_checks: item.image_checks as any,
            diagnostics: item.diagnostics,
            raw_anchors: item.raw_anchors,
            candidate_urls: item.candidate_urls,
            classification: item.classification,
            duplicate_status: item.duplicate_status,
            duplicate_listing_id: item.duplicate_listing_id,
            source_url: item.source_url,
            source_kind: item.source_kind,
            source_window: item.source_window,
          },
          updateExisting: item.updateExisting,
        },
      });
      updateItem(item.rowId, { importStatus: "imported", importResult: r });
    } catch (e: any) {
      updateItem(item.rowId, { importStatus: "error", importError: e?.message ?? String(e) });
    }
  };

  const importSelected = async () => {
    for (const it of items) {
      if (!it.selected) continue;
      if (it.importStatus === "imported") continue;
      // refetch latest with current edits
      const latest = items.find((x) => x.rowId === it.rowId)!;
      await importOne(latest);
    }
  };

  const totals = useMemo(() => {
    const sel = items.filter((i) => i.selected).length;
    const dup = items.filter((i) => i.duplicate_status === "already_posted").length;
    const newCount = items.filter((i) => i.duplicate_status === "new").length;
    return { sel, dup, newCount, total: items.length };
  }, [items]);

  const showDropdownDebug = !realtorsQ.isLoading && realtors.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bluluma</div>
          <h1 className="mt-2 font-display text-4xl">Group Import from Paragon</h1>
          <div className="gold-rule mt-4 max-w-xs" />
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl">Paste one or more Paragon public listing links — individual or group/report. The importer auto-detects which is which, splits group reports into individual listings, dedupes against existing listings, and lets you choose what to import.</p>
        </div>
        <Link to="/admin/dashboard" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
      </div>

      <div className="border border-accent bg-secondary text-secondary-foreground p-4 text-sm">
        <strong>Legal:</strong> Only import listings and photos that the Realtor has permission to use. MLS and Paragon content may be subject to brokerage, board, and MLS usage rules.
      </div>

      {/* Stage 1 — paste */}
      <section className="bg-card shadow-card p-6 space-y-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stage 1 — Paste links</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Realtor</div>
            <select className="w-full h-11 px-3 border border-border bg-background" value={realtorId} onChange={(e) => setRealtorId(e.target.value)}>
              <option value="">{realtorsQ.isLoading ? "Loading…" : "Select a realtor…"}</option>
              {realtors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Paragon public links (group/report or individual)</div>
          <textarea className="w-full min-h-32 p-3 border border-border bg-background font-mono text-sm" placeholder="One link per line. Group reports will be split into individual listings." value={links} onChange={(e) => setLinks(e.target.value)} />
        </label>
        {error && <div className="text-destructive text-sm">{error}</div>}
        <div className="flex justify-end">
          <button onClick={onAnalyze} disabled={analyzing} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em] disabled:opacity-50">
            {analyzing ? "Analyzing…" : "Analyze Links"}
          </button>
        </div>
      </section>

      {showDropdownDebug && (
        <section className="border border-destructive/40 bg-card text-destructive p-4 text-sm space-y-1">
          <div className="font-medium">Realtor dropdown is empty — Supabase debug</div>
          <div className="font-mono text-xs">Host: {hostnameOf(debug?.supabaseUrl ?? "")}</div>
          <div className="font-mono text-xs">Rows returned: {debug?.rowsReturned ?? 0}</div>
          <div className="font-mono text-xs whitespace-pre-wrap">Error: {debug?.error ?? "None"}</div>
        </section>
      )}

      {/* Entries summary */}
      {entries.length > 0 && (
        <section className="bg-card shadow-card p-4 text-sm space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Detected Sources</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground"><tr>
                <th className="py-1 pr-4">URL</th><th className="py-1 pr-4">Kind</th><th className="py-1 pr-4">Items</th><th className="py-1 pr-4">Final URL</th><th className="py-1">Error</th>
              </tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.url} className="border-t border-border">
                    <td className="py-2 pr-4 font-mono break-all">{e.url}</td>
                    <td className="py-2 pr-4">{e.kind}</td>
                    <td className="py-2 pr-4">{e.itemCount}</td>
                    <td className="py-2 pr-4 font-mono break-all">{e.finalUrl ?? "—"}</td>
                    <td className="py-2 text-destructive">{e.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Stage 2 — review table */}
      {items.length > 0 && (
        <section className="bg-card shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stage 2 — Review detected listings</div>
              <h2 className="font-display text-2xl mt-1">{totals.total} listings detected</h2>
              <div className="text-xs text-muted-foreground mt-1">{totals.newCount} new · {totals.dup} already posted · {totals.sel} selected</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setItems((p) => p.map((i) => ({ ...i, selected: i.duplicate_status !== "already_posted" })))} className="px-3 h-9 border border-border text-xs uppercase tracking-[0.18em] hover:bg-muted">Select new only</button>
              <button onClick={() => setItems((p) => p.map((i) => ({ ...i, selected: true })))} className="px-3 h-9 border border-border text-xs uppercase tracking-[0.18em] hover:bg-muted">Select all</button>
              <button onClick={() => setItems((p) => p.map((i) => ({ ...i, selected: false })))} className="px-3 h-9 border border-border text-xs uppercase tracking-[0.18em] hover:bg-muted">Clear</button>
              <button onClick={importSelected} className="px-4 h-9 bg-foreground text-background text-xs uppercase tracking-[0.18em]">Import selected</button>
            </div>
          </div>

          <div className="overflow-auto border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 w-16">Photo</th>
                  <th className="p-2">Address / MLS</th>
                  <th className="p-2 w-24">Price</th>
                  <th className="p-2 w-32">Status</th>
                  <th className="p-2 w-36">Classification</th>
                  <th className="p-2 w-32">Destination</th>
                  <th className="p-2 w-32">Dup status</th>
                  <th className="p-2 w-28">Source</th>
                  <th className="p-2 w-40">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.rowId} className="border-t border-border align-top">
                    <td className="p-2"><input type="checkbox" checked={it.selected} onChange={(e) => updateItem(it.rowId, { selected: e.target.checked })} /></td>
                    <td className="p-2">
                      {it.image_url ? (
                        <img src={`/api/image-proxy?url=${encodeURIComponent(it.image_url)}`} alt="" className="h-12 w-16 object-cover border border-border" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.25"; }} />
                      ) : <div className="h-12 w-16 bg-muted border border-border" />}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{it.address ?? <span className="text-muted-foreground italic">No address detected</span>}</div>
                      <div className="font-mono text-muted-foreground">MLS {it.mls_number ?? "—"}</div>
                      {it.detail_url && <a href={it.detail_url} target="_blank" rel="noreferrer" className="text-accent underline break-all">Open detail</a>}
                    </td>
                    <td className="p-2">{it.price != null ? `$${it.price.toLocaleString()}` : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2">{it.status_label ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2">
                      <select className="w-full h-8 px-1 border border-border bg-background text-xs" value={it.classification} onChange={(e) => {
                        const c = e.target.value as Classification;
                        updateItem(it.rowId, { classification: c, destination: destFromClassification(c) });
                      }}>
                        <option value="active">Active</option>
                        <option value="sold">Sold / Closed</option>
                        <option value="commercial_sale">Commercial Sale</option>
                        <option value="commercial_lease">Commercial Lease</option>
                        <option value="needs_review">Needs Review</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="w-full h-8 px-1 border border-border bg-background text-xs" value={it.destination} onChange={(e) => updateItem(it.rowId, { destination: e.target.value as Item["destination"] })}>
                        <option value="active">Active Featured</option>
                        <option value="sold">Sold</option>
                        <option value="commercial">Commercial</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <DupBadge status={it.duplicate_status} />
                      {it.duplicate_status === "already_posted" && (
                        <label className="flex items-center gap-1 mt-1 text-[10px]">
                          <input type="checkbox" checked={it.updateExisting} onChange={(e) => updateItem(it.rowId, { updateExisting: e.target.checked })} /> Update existing
                        </label>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`inline-block px-1.5 py-0.5 border text-[10px] uppercase ${it.source_kind === "group" ? "border-accent text-accent" : "border-border"}`}>{it.source_kind}</span>
                      {it.source_kind === "group" && !it.detail_url && <div className="text-[10px] text-muted-foreground mt-1">Needs manual photos</div>}
                    </td>
                    <td className="p-2">
                      <button onClick={() => importOne(it)} disabled={it.importStatus === "importing"} className="px-2 h-8 border border-border text-[10px] uppercase tracking-wider hover:bg-muted disabled:opacity-50 w-full">
                        {it.importStatus === "importing" ? "Importing…" : it.importStatus === "imported" ? "Re-import" : "Import"}
                      </button>
                      {it.importStatus === "imported" && it.importResult && (
                        <div className="text-[10px] text-accent mt-1">Saved · {it.importResult.images_stored} photos{it.importResult.warning ? " · needs photos" : ""}</div>
                      )}
                      {it.importStatus === "skipped" && <div className="text-[10px] text-muted-foreground mt-1">{it.importError}</div>}
                      {it.importStatus === "error" && <div className="text-[10px] text-destructive mt-1 break-words">{it.importError}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function hostnameOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function DupBadge({ status }: { status: DupStatus }) {
  const label = status === "already_posted" ? "Already Posted" : status === "needs_review" ? "Needs Review" : "New";
  const cls = status === "already_posted" ? "border-destructive/50 text-destructive" : status === "needs_review" ? "border-accent text-accent" : "border-border text-foreground";
  return <span className={`inline-block px-1.5 py-0.5 border text-[10px] uppercase ${cls}`}>{label}</span>;
}
