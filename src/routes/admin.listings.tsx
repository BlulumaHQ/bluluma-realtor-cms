import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { fileToBase64 } from "@/hooks/use-admin";
import {
  adminListRealtors, adminListListings, adminGetListing,
  adminUpsertListing, adminDeleteListing,
  adminAddPhoto, adminDeletePhoto, adminUpload,
} from "@/lib/admin.functions";
import type { Listing } from "@/lib/types";

export const Route = createFileRoute("/admin/listings")({ component: () => <AdminShell><Page /></AdminShell> });

function Page() {
  const lr = useServerFn(adminListRealtors);
  const ll = useServerFn(adminListListings);
  const realtors = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }), enabled: true });
  const [realtorId, setRealtorId] = useState<string>("");
  const listings = useQuery({
    queryKey: ["a-listings", realtorId],
    queryFn: () => ll({ data: { realtorId: realtorId || undefined } }),
    enabled: true,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl">Listings</h1>
          <div className="gold-rule mt-4 max-w-xs" />
        </div>
        <div className="flex gap-2">
          <select value={realtorId} onChange={(e) => setRealtorId(e.target.value)} className="h-10 px-3 border border-border bg-background">
            <option value="">All realtors</option>
            {(realtors.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Link
            to="/admin/import"
            className="px-5 h-10 inline-flex items-center border border-foreground text-sm uppercase tracking-[0.18em]"
          >
            Import from Paragon Link
          </Link>
          <button
            onClick={() => { setCreating(true); setEditingId("new"); }}
            disabled={!realtorId && (realtors.data ?? []).length === 0}
            className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]"
          >
            + New listing
          </button>
        </div>
      </div>

      <div className="bg-card shadow-card divide-y divide-border">
        {(listings.data ?? []).map((l) => (
          <div key={l.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {l.primary_image_url ? (
                <img src={l.primary_image_url} className="h-14 w-20 object-cover" />
              ) : <div className="h-14 w-20 bg-muted" />}
              <div className="min-w-0">
                <div className="font-medium truncate">{l.address ?? l.title}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {l.city} · {l.status} · {l.category}
                  {l.featured && " · ★ featured"}
                  {l.show_in_sold && " · sold-page"}
                </div>
              </div>
            </div>
            <button onClick={() => { setCreating(false); setEditingId(l.id); }} className="text-sm text-accent shrink-0">Edit →</button>
          </div>
        ))}
        {(listings.data ?? []).length === 0 && <div className="p-8 text-muted-foreground text-center">No listings.</div>}
      </div>

      {editingId && (
        <ListingEditor
          listingId={editingId}
          isNew={creating}
          defaultRealtorId={realtorId || (realtors.data?.[0]?.id ?? "")}
          realtors={realtors.data ?? []}
          onClose={() => { setEditingId(null); setCreating(false); listings.refetch(); }}
        />
      )}
    </div>
  );
}

function ListingEditor({
  listingId, isNew, defaultRealtorId, realtors, onClose,
}: {
  listingId: string; isNew: boolean; defaultRealtorId: string;
  realtors: { id: string; name: string }[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const get = useServerFn(adminGetListing);
  const upsert = useServerFn(adminUpsertListing);
  const del = useServerFn(adminDeleteListing);
  const upload = useServerFn(adminUpload);
  const addPhoto = useServerFn(adminAddPhoto);
  const delPhoto = useServerFn(adminDeletePhoto);

  const data = useQuery({
    queryKey: ["a-listing", listingId],
    queryFn: () => get({ data: { id: listingId } }),
    enabled: !isNew,
  });

  const [l, setL] = useState<Partial<Listing>>(
    isNew
      ? { realtor_id: defaultRealtorId, status: "active", category: "residential", transaction_type: "sale", featured: false, show_in_sold: false, sort_order: 0, sold_sort_order: 0 }
      : {}
  );
  const ready = isNew || !!data.data;
  const current = isNew ? l : { ...data.data?.listing, ...l };

  const update = (patch: Partial<Listing>) => setL((s) => ({ ...s, ...patch }));

  const save = async () => {
    const payload = isNew ? l : { id: data.data!.listing.id, ...l };
    const saved = await upsert({ data: { listing: payload } });
    if (isNew) { setL({}); qc.invalidateQueries({ queryKey: ["a-listings"] }); onClose(); return; }
    qc.invalidateQueries({ queryKey: ["a-listing", saved.id] });
    qc.invalidateQueries({ queryKey: ["a-listings"] });
    setL({});
  };

  const remove = async () => {
    if (!confirm("Delete listing?")) return;
    await del({ data: { id: data.data!.listing.id } });
    onClose();
  };

  const uploadPhoto = async (file: File, primary = false) => {
    const base64 = await fileToBase64(file);
    const path = `${current.realtor_id}/${current.slug ?? listingId}/${Date.now()}-${file.name}`;
    const { url } = await upload({ data: { bucket: "listing-photos", path, contentType: file.type, base64 } });
    if (primary) {
      update({ primary_image_url: url });
    } else if (!isNew) {
      await addPhoto({ data: { listingId: data.data!.listing.id, image_url: url, sort_order: (data.data!.photos.length ?? 0) } });
      data.refetch();
    }
  };

  const uploadPdf = async (file: File) => {
    const base64 = await fileToBase64(file);
    const path = `${current.realtor_id}/${current.slug ?? listingId}/${Date.now()}-${file.name}`;
    const { url } = await upload({ data: { bucket: "listing-pdfs", path, contentType: file.type, base64 } });
    update({ pdf_url: url });
  };

  if (!ready) {
    return <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">Loading…</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-background w-full max-w-4xl my-8 p-8 shadow-luxury" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl">{isNew ? "New listing" : "Edit listing"}</h2>
          <button onClick={onClose} className="text-muted-foreground">Close</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Realtor">
            <select className="input" value={current.realtor_id ?? ""} onChange={(e) => update({ realtor_id: e.target.value })}>
              {realtors.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Slug"><input className="input" value={current.slug ?? ""} onChange={(e) => update({ slug: e.target.value })} /></Field>
          <Field label="Title"><input className="input" value={current.title ?? ""} onChange={(e) => update({ title: e.target.value })} /></Field>
          <Field label="Address"><input className="input" value={current.address ?? ""} onChange={(e) => update({ address: e.target.value })} /></Field>
          <Field label="City"><input className="input" value={current.city ?? ""} onChange={(e) => update({ city: e.target.value })} /></Field>
          <Field label="Price"><input type="number" className="input" value={current.price ?? ""} onChange={(e) => update({ price: e.target.value ? Number(e.target.value) : null })} /></Field>

          <Field label="Status">
            <select className="input" value={current.status ?? ""} onChange={(e) => update({ status: e.target.value })}>
              <option value="active">active</option>
              <option value="sold">sold</option>
              <option value="archived">archived</option>
            </select>
          </Field>
          <Field label="Category">
            <select className="input" value={current.category ?? ""} onChange={(e) => update({ category: e.target.value })}>
              <option value="residential">residential</option>
              <option value="commercial">commercial</option>
            </select>
          </Field>
          <Field label="Transaction">
            <select className="input" value={current.transaction_type ?? ""} onChange={(e) => update({ transaction_type: e.target.value })}>
              <option value="sale">sale</option>
              <option value="lease">lease</option>
            </select>
          </Field>
          <Field label="Property type"><input className="input" value={current.property_type ?? ""} onChange={(e) => update({ property_type: e.target.value })} /></Field>

          <Field label="Beds"><input type="number" className="input" value={current.beds ?? ""} onChange={(e) => update({ beds: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Baths"><input type="number" step="0.5" className="input" value={current.baths ?? ""} onChange={(e) => update({ baths: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Sqft"><input type="number" className="input" value={current.sqft ?? ""} onChange={(e) => update({ sqft: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Lot size"><input className="input" value={current.lot_size ?? ""} onChange={(e) => update({ lot_size: e.target.value })} /></Field>
          <Field label="MLS #"><input className="input" value={current.mls_number ?? ""} onChange={(e) => update({ mls_number: e.target.value })} /></Field>
          <Field label="Paragon URL"><input className="input" value={current.paragon_url ?? ""} onChange={(e) => update({ paragon_url: e.target.value })} /></Field>

          <Field label="Sort order"><input type="number" className="input" value={current.sort_order ?? 0} onChange={(e) => update({ sort_order: Number(e.target.value) })} /></Field>
          <Field label="Sold sort order"><input type="number" className="input" value={current.sold_sort_order ?? 0} onChange={(e) => update({ sold_sort_order: Number(e.target.value) })} /></Field>

          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={!!current.featured} onChange={(e) => update({ featured: e.target.checked })} />
            <span>Featured (homepage)</span>
          </label>
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={!!current.show_in_sold} onChange={(e) => update({ show_in_sold: e.target.checked })} />
            <span>Show on Sold page</span>
          </label>
        </div>

        <Field label="Description">
          <textarea className="input min-h-32" value={current.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
        </Field>

        <Field label="Features (one per line)">
          <textarea
            className="input min-h-24"
            value={Array.isArray(current.features) ? current.features.join("\n") : ""}
            onChange={(e) => update({ features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) as any })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <Field label="Primary image">
            <div className="flex items-center gap-3">
              {current.primary_image_url && <img src={current.primary_image_url} className="h-14 w-20 object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], true)} />
            </div>
          </Field>
          <Field label="PDF brochure">
            <div className="flex items-center gap-3">
              {current.pdf_url && <a href={current.pdf_url} target="_blank" rel="noreferrer" className="text-sm text-accent">Current PDF</a>}
              <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
            </div>
          </Field>
        </div>

        {!isNew && (
          <div className="mt-8">
            <h3 className="font-display text-xl mb-3">Gallery photos</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {(data.data?.photos ?? []).map((p) => (
                <div key={p.id} className="relative aspect-[4/3] bg-muted">
                  <img src={p.image_url} className="h-full w-full object-cover" />
                  <button
                    onClick={async () => { await delPhoto({ data: { id: p.id } }); data.refetch(); }}
                    className="absolute top-1 right-1 bg-foreground text-background text-xs px-2 py-1"
                  >×</button>
                </div>
              ))}
              <label className="aspect-[4/3] border-2 border-dashed border-border flex items-center justify-center text-sm text-muted-foreground cursor-pointer">
                + Add
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
              </label>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <div>
            {!isNew && <button onClick={remove} className="px-5 h-10 border border-destructive text-destructive text-sm uppercase tracking-[0.18em]">Delete</button>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 h-10 border border-border text-sm uppercase tracking-[0.18em]">Cancel</button>
            <button onClick={save} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">Save</button>
          </div>
        </div>

        <style>{`.input{width:100%;height:2.75rem;padding:0 .75rem;border:1px solid var(--border);background:var(--background)}textarea.input{height:auto;padding:.6rem .75rem}`}</style>
      </div>
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
