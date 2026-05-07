import { createServerFn } from "@tanstack/react-start";
import { getAdminClient } from "./supabase/admin.server";
import type { Realtor, Listing, ListingPhoto, RealtorDomain } from "./types";

function checkPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD not configured");
  if (password !== expected) throw new Error("Invalid admin password");
}

const PROJECT_URL = "https://pnstqwyuhdzdmodeqvid.supabase.co";

function publicUrl(bucket: string, path: string) {
  return `${PROJECT_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ---------- Auth ----------
export const verifyAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    return { ok: true };
  });

// ---------- Realtors ----------
export const adminListRealtors = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const { data: rows, error } = await sb.from("realtors").select("*").order("name");
    if (error) throw error;
    return rows as Realtor[];
  });

export const adminUpsertRealtor = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; realtor: Partial<Realtor> }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const payload: any = { ...data.realtor, updated_at: new Date().toISOString() };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await sb.from("realtors").upsert(payload).select("*").single();
    if (error) throw error;
    return row as Realtor;
  });

export const adminListDomains = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; realtorId?: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    let q = sb.from("realtor_domains").select("*").order("created_at", { ascending: false });
    if (data.realtorId) q = q.eq("realtor_id", data.realtorId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows as RealtorDomain[];
  });

export const adminUpsertDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; domain: Partial<RealtorDomain> }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const payload: any = { ...data.domain };
    if (payload.domain) payload.domain = String(payload.domain).toLowerCase().replace(/^www\./, "").split(":")[0];
    if (!payload.id) delete payload.id;
    const { data: row, error } = await sb.from("realtor_domains").upsert(payload).select("*").single();
    if (error) throw error;
    return row;
  });

export const adminDeleteDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const { error } = await sb.from("realtor_domains").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Listings ----------
export const adminListListings = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; realtorId?: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    let q = sb.from("listings").select("*").order("sort_order", { ascending: true });
    if (data.realtorId) q = q.eq("realtor_id", data.realtorId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows as Listing[];
  });

export const adminGetListing = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const { data: l } = await sb.from("listings").select("*").eq("id", data.id).single();
    const { data: photos } = await sb.from("listing_photos").select("*").eq("listing_id", data.id).order("sort_order");
    return { listing: l as Listing, photos: (photos ?? []) as ListingPhoto[] };
  });

export const adminUpsertListing = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; listing: Partial<Listing> }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const payload: any = { ...data.listing, updated_at: new Date().toISOString() };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await sb.from("listings").upsert(payload).select("*").single();
    if (error) throw error;
    return row as Listing;
  });

export const adminDeleteListing = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const { error } = await sb.from("listings").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Photos ----------
export const adminAddPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; listingId: string; image_url: string; alt_text?: string; sort_order?: number }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const { data: row, error } = await sb.from("listing_photos").insert({
      listing_id: data.listingId,
      image_url: data.image_url,
      alt_text: data.alt_text ?? null,
      sort_order: data.sort_order ?? 0,
    }).select("*").single();
    if (error) throw error;
    return row;
  });

export const adminDeletePhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const { error } = await sb.from("listing_photos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Uploads (base64 -> storage) ----------
export const adminUpload = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; bucket: "listing-photos" | "realtor-assets" | "listing-pdfs"; path: string; contentType: string; base64: string }) => d)
  .handler(async ({ data }) => {
    checkPassword(data.password);
    const sb = getAdminClient();
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error } = await sb.storage.from(data.bucket).upload(data.path, bytes, {
      contentType: data.contentType,
      upsert: true,
    });
    if (error) throw error;
    return { url: publicUrl(data.bucket, data.path) };
  });
