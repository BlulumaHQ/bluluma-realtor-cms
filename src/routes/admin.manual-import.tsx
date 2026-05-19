import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { adminListRealtorsDebug } from "@/lib/admin.functions";
import {
  manualExtractFromScreenshots,
  manualFetchCover,
  manualCheckDuplicate,
  manualSaveListing,
  type ManualListingType,
} from "@/lib/manual-import.functions";

export const Route = createFileRoute("/admin/manual-import")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});

type ListingTypeOpt = { value: ManualListingType; label: string };
const LISTING_TYPES: ListingTypeOpt[] = [
  { value: "residential_active", label: "Residential Active" },
  { value: "residential_sold", label: "Residential Sold" },
  { value: "commercial_sale_active", label: "Commercial Sale Active" },
  { value: "commercial_lease", label: "Commercial For Lease" },
  { value: "commercial_sold", label: "Commercial Sold" },
];

type Fields = {
  title: string;
  address: string;
  city: string;
  area: string;
  postal_code: string;
  list_price: string;
  sold_price: string;
  sold_date: string;
  lease_rate: string;
  lease_rate_unit: string;
  available_sqft: string;
  beds: string;
  baths: string;
  sqft: string;
  property_type: string;
  building_type: string;
  zoning: string;
  year_built: string;
  mls_number: string;
  description: string;
};

const EMPTY: Fields = {
  title: "",
  address: "", city: "", area: "", postal_code: "",
  list_price: "", sold_price: "", sold_date: "",
  lease_rate: "", lease_rate_unit: "per_month",
  available_sqft: "", beds: "", baths: "", sqft: "",
  property_type: "", building_type: "", zoning: "", year_built: "",
  mls_number: "", description: "",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function Page() {
  const lr = useServerFn(adminListRealtorsDebug);
  const extractFn = useServerFn(manualExtractFromScreenshots);
  const coverFn = useServerFn(manualFetchCover);
  const dupFn = useServerFn(manualCheckDuplicate);
  const saveFn = useServerFn(manualSaveListing);

  const realtorsQ = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }) });
  const realtors = realtorsQ.data?.rows ?? [];

  const [realtorId, setRealtorId] = useState("");
  const [listingType, setListingType] = useState<ManualListingType>("residential_active");
  const [paragonUrl, setParagonUrl] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [gallery, setGallery] = useState<File[]>([]);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; photos_stored: number } | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; address: string | null; status: string | null } | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    if (!realtorId && realtors.length === 1) setRealtorId(realtors[0].id);
  }, [realtors, realtorId]);

  // Re-check duplicate when MLS changes
  useEffect(() => {
    let cancelled = false;
    setDuplicate(null);
    setOverwrite(false);
    const mls = fields.mls_number.trim();
    if (!realtorId || !mls) return;
    const t = setTimeout(async () => {
      try {
        const r = await dupFn({ data: { realtorId, mlsNumber: mls } });
        if (!cancelled && r.existing) setDuplicate(r.existing as any);
      } catch {}
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [fields.mls_number, realtorId, dupFn]);

  const readScreenshots = async () => {
    setError(null);
    if (screenshots.length === 0) return setError("Upload at least one screenshot first.");
    setReading(true);
    try {
      const dataUrls = await Promise.all(screenshots.map(fileToDataUrl));
      const r: any = await extractFn({ data: { images: dataUrls } });
      const e = r.extracted ?? {};
      setFields({
        address: e.address ?? "",
        city: e.city ?? "",
        area: e.area ?? "",
        postal_code: e.postal_code ?? "",
        list_price: e.list_price != null ? String(e.list_price) : "",
        sold_price: e.sold_price != null ? String(e.sold_price) : "",
        sold_date: e.sold_date ?? "",
        lease_rate: e.lease_rate != null ? String(e.lease_rate) : "",
        lease_rate_unit: e.lease_rate_unit ?? "per_month",
        available_sqft: e.available_sqft != null ? String(e.available_sqft) : "",
        beds: e.beds != null ? String(e.beds) : "",
        baths: e.baths != null ? String(e.baths) : "",
        sqft: e.sqft != null ? String(e.sqft) : "",
        property_type: e.property_type ?? "",
        building_type: e.building_type ?? "",
        zoning: e.zoning ?? "",
        year_built: e.year_built != null ? String(e.year_built) : "",
        mls_number: e.mls_number ?? "",
        description: e.description ?? "",
      });
      setExtra(e.extra ?? {});
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setReading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    setResult(null);
    if (!realtorId) return setError("Select a realtor.");
    if (!fields.address) return setError("Address is required.");
    if (!fields.mls_number) return setError("MLS number is required.");
    if (duplicate && !overwrite) return setError("This MLS already exists. Choose Skip or Overwrite.");

    setSaving(true);
    try {
      // Try to fetch cover from paragon link
      let coverUrl: string | null = null;
      if (paragonUrl.trim()) {
        try {
          const c = await coverFn({ data: { url: paragonUrl.trim() } });
          coverUrl = c.url ?? null;
        } catch {}
      }

      // Sort gallery by filename so lowest-numbered wins as fallback cover
      const sortedGallery = [...gallery].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const galleryPayload = await Promise.all(
        sortedGallery.map(async (file) => ({ filename: file.name, dataUrl: await fileToDataUrl(file) })),
      );

      const r: any = await saveFn({
        data: {
          realtorId,
          listingType,
          paragonUrl: paragonUrl.trim(),
          coverImageUrl: coverUrl,
          fields: {
            address: fields.address || null,
            city: fields.city || null,
            area: fields.area || null,
            postal_code: fields.postal_code || null,
            list_price: num(fields.list_price),
            sold_price: num(fields.sold_price),
            sold_date: fields.sold_date || null,
            lease_rate: num(fields.lease_rate),
            lease_rate_unit: fields.lease_rate_unit || null,
            available_sqft: num(fields.available_sqft),
            beds: num(fields.beds),
            baths: num(fields.baths),
            sqft: num(fields.sqft),
            property_type: fields.property_type || null,
            building_type: fields.building_type || null,
            zoning: fields.zoning || null,
            year_built: num(fields.year_built),
            mls_number: fields.mls_number || null,
            description: fields.description || null,
            extra,
          },
          gallery: galleryPayload,
          overwriteListingId: overwrite && duplicate ? duplicate.id : null,
        },
      });
      setResult({ slug: r.slug, photos_stored: r.photos_stored });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const isCommercial = listingType.startsWith("commercial");
  const isSold = listingType.endsWith("_sold");
  const isLease = listingType === "commercial_lease";

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bluluma</div>
          <h1 className="mt-2 font-display text-4xl">Manual Import</h1>
          <div className="gold-rule mt-4 max-w-xs" />
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
            Upload a screenshot of a Paragon listing detail page. AI extracts the visible fields for you to review and correct before saving.
          </p>
        </div>
        <Link to="/admin/dashboard" className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
      </div>

      {/* Stage 1 — inputs */}
      <section className="bg-card shadow-card p-6 space-y-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stage 1 — Source</div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Realtor</div>
            <select className="w-full h-11 px-3 border border-border bg-background" value={realtorId} onChange={(e) => setRealtorId(e.target.value)}>
              <option value="">{realtorsQ.isLoading ? "Loading…" : "Select a realtor…"}</option>
              {realtors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Listing type</div>
            <select className="w-full h-11 px-3 border border-border bg-background" value={listingType} onChange={(e) => setListingType(e.target.value as ManualListingType)}>
              {LISTING_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Paragon public link (used only to fetch the cover image)</div>
          <input className="w-full h-11 px-3 border border-border bg-background font-mono text-sm" placeholder="https://www.paragonrels.com/..." value={paragonUrl} onChange={(e) => setParagonUrl(e.target.value)} />
        </label>

        <Dropzone
          label="Screenshot(s) of Paragon detail page"
          files={screenshots}
          setFiles={setScreenshots}
          accept="image/*"
        />

        <div className="flex justify-end">
          <button onClick={readScreenshots} disabled={reading || screenshots.length === 0} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em] disabled:opacity-50">
            {reading ? "Reading…" : "Read Screenshot"}
          </button>
        </div>
        {error && <div className="text-destructive text-sm">{error}</div>}
      </section>

      {/* Stage 2 — review */}
      <section className="bg-card shadow-card p-6 space-y-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stage 2 — Review & edit</div>

        {duplicate && (
          <div className="border border-accent bg-secondary p-3 text-sm space-y-2">
            <div><strong>Duplicate MLS detected.</strong> A listing with MLS <span className="font-mono">{fields.mls_number}</span> already exists ({duplicate.address ?? "no address"} · {duplicate.status ?? "?"}).</div>
            <div className="flex gap-3 text-xs uppercase tracking-[0.18em]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!overwrite} onChange={() => setOverwrite(false)} /> Skip
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={overwrite} onChange={() => setOverwrite(true)} /> Overwrite existing
              </label>
            </div>
          </div>
        )}

        <FieldsForm
          fields={fields}
          setFields={setFields}
          isCommercial={isCommercial}
          isSold={isSold}
          isLease={isLease}
        />

        {Object.keys(extra ?? {}).length > 0 && (
          <details className="border border-border p-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground uppercase tracking-[0.18em]">Extra extracted fields (saved to features)</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.entries(extra).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted-foreground">{k}:</span>
                  <span className="font-mono break-all">{v == null ? "—" : String(v)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Stage 3 — gallery + save */}
      <section className="bg-card shadow-card p-6 space-y-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stage 3 — Gallery & save</div>
        <Dropzone
          label="Gallery photos (lowest-numbered filename is used as the cover if no Paragon link cover is found)"
          files={gallery}
          setFiles={setGallery}
          accept="image/*"
        />
        {error && <div className="text-destructive text-sm">{error}</div>}
        {result && (
          <div className="border border-accent bg-secondary p-3 text-sm">
            Saved listing <span className="font-mono">{result.slug}</span> with {result.photos_stored} photo(s).
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onSave} disabled={saving} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em] disabled:opacity-50">
            {saving ? "Saving…" : "Save Listing"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Dropzone({ label, files, setFiles, accept }: { label: string; files: File[]; setFiles: (f: File[]) => void; accept: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setFiles([...files, ...arr]);
  };

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        onClick={() => ref.current?.click()}
        className={`border-2 border-dashed p-6 text-sm text-center cursor-pointer ${dragging ? "border-accent bg-secondary" : "border-border bg-background"}`}
      >
        <div>Drag & drop images here, or click to choose files</div>
        <div className="text-xs text-muted-foreground mt-1">{files.length} file(s) selected</div>
        <input ref={ref} type="file" multiple accept={accept} className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative border border-border bg-muted p-1 text-[10px]">
              <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover" />
              <div className="truncate mt-1" title={f.name}>{f.name}</div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)); }}
                className="absolute top-0 right-0 bg-foreground text-background w-5 h-5 text-xs"
                title="Remove"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      <input className="w-full h-10 px-3 border border-border bg-background text-sm" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function FieldsForm({ fields, setFields, isCommercial, isSold, isLease }: { fields: Fields; setFields: (f: Fields) => void; isCommercial: boolean; isSold: boolean; isLease: boolean }) {
  const u = (k: keyof Fields) => (v: string) => setFields({ ...fields, [k]: v });

  // Build field order
  const blocks: React.ReactNode[] = [];

  // Always-first: address / city / postal
  blocks.push(
    <div key="loc" className="grid md:grid-cols-3 gap-3">
      <Input label="Address *" value={fields.address} onChange={u("address")} />
      <Input label="City" value={fields.city} onChange={u("city")} />
      <Input label="Postal code" value={fields.postal_code} onChange={u("postal_code")} />
    </div>
  );

  if (isLease) {
    blocks.push(
      <div key="lease" className="grid md:grid-cols-3 gap-3">
        <Input label="Lease rate" type="number" value={fields.lease_rate} onChange={u("lease_rate")} />
        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Lease rate unit</div>
          <select className="w-full h-10 px-3 border border-border bg-background text-sm" value={fields.lease_rate_unit} onChange={(e) => setFields({ ...fields, lease_rate_unit: e.target.value })}>
            <option value="per_month">per month</option>
            <option value="per_year">per year</option>
            <option value="per_sqft">per sqft</option>
          </select>
        </label>
        <Input label="Available sqft" type="number" value={fields.available_sqft} onChange={u("available_sqft")} />
      </div>
    );
    blocks.push(
      <div key="cmlease" className="grid md:grid-cols-3 gap-3">
        <Input label="Building type" value={fields.building_type} onChange={u("building_type")} />
        <Input label="Zoning" value={fields.zoning} onChange={u("zoning")} />
        <Input label="MLS # *" value={fields.mls_number} onChange={u("mls_number")} />
      </div>
    );
  } else if (isCommercial) {
    blocks.push(
      <div key="cprice" className="grid md:grid-cols-3 gap-3">
        <Input label="Sale price" type="number" value={fields.list_price} onChange={u("list_price")} />
        {isSold && <Input label="Sold price" type="number" value={fields.sold_price} onChange={u("sold_price")} />}
        {isSold && <Input label="Sold date" type="date" value={fields.sold_date} onChange={u("sold_date")} />}
      </div>
    );
    blocks.push(
      <div key="cspec" className="grid md:grid-cols-3 gap-3">
        <Input label="Sqft" type="number" value={fields.sqft} onChange={u("sqft")} />
        <Input label="Building type" value={fields.building_type} onChange={u("building_type")} />
        <Input label="Zoning" value={fields.zoning} onChange={u("zoning")} />
      </div>
    );
    blocks.push(
      <div key="cmeta" className="grid md:grid-cols-3 gap-3">
        <Input label="Year built" type="number" value={fields.year_built} onChange={u("year_built")} />
        <Input label="MLS # *" value={fields.mls_number} onChange={u("mls_number")} />
        <Input label="Area" value={fields.area} onChange={u("area")} />
      </div>
    );
  } else {
    // Residential
    blocks.push(
      <div key="rprice" className="grid md:grid-cols-3 gap-3">
        <Input label="List price" type="number" value={fields.list_price} onChange={u("list_price")} />
        {isSold && <Input label="Sold price" type="number" value={fields.sold_price} onChange={u("sold_price")} />}
        {isSold && <Input label="Sold date" type="date" value={fields.sold_date} onChange={u("sold_date")} />}
      </div>
    );
    blocks.push(
      <div key="rspec" className="grid md:grid-cols-4 gap-3">
        <Input label="Bedrooms" type="number" value={fields.beds} onChange={u("beds")} />
        <Input label="Bathrooms" type="number" value={fields.baths} onChange={u("baths")} />
        <Input label="Sqft" type="number" value={fields.sqft} onChange={u("sqft")} />
        <Input label="Year built" type="number" value={fields.year_built} onChange={u("year_built")} />
      </div>
    );
    blocks.push(
      <div key="rmeta" className="grid md:grid-cols-3 gap-3">
        <Input label="Property type" value={fields.property_type} onChange={u("property_type")} />
        <Input label="MLS # *" value={fields.mls_number} onChange={u("mls_number")} />
        <Input label="Area" value={fields.area} onChange={u("area")} />
      </div>
    );
  }

  blocks.push(
    <label key="desc" className="block">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Description</div>
      <textarea className="w-full min-h-32 p-3 border border-border bg-background text-sm" value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} />
    </label>
  );

  return <div className="space-y-3">{blocks}</div>;
}
