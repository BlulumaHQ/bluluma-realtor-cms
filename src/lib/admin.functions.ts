import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient, SUPABASE_URL } from "./supabase/admin.server";
import type { Realtor, Listing, ListingPhoto, RealtorDomain } from "./types";

const PROJECT_URL = SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aN7LwltKQzntPyc4_moyQg_XSWARdPD";
const REALTOR_QUERY = "select * from realtors order by name asc";

type OptionalAdminInput = { password?: string } | undefined;
type RealtorListDebug = {
  supabaseUrl: string;
  viteSupabaseUrlExists: boolean;
  viteSupabasePublishableKeyExists: boolean;
  serviceRoleKeyExists: boolean;
  exactQuery: string;
  rowsReturned: number;
  error: string | null;
  dataSource: "real Supabase data" | "mock/local data";
};

function publicUrl(bucket: string, path: string) {
  return `${PROJECT_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function getPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function formatSupabaseError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

async function readRealtorsWithDebug() {
  const debug: RealtorListDebug = {
    supabaseUrl: SUPABASE_URL,
    viteSupabaseUrlExists: Boolean(process.env.VITE_SUPABASE_URL),
    viteSupabasePublishableKeyExists: Boolean(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    serviceRoleKeyExists: Boolean(process.env.SERVICE_ROLE_KEY),
    exactQuery: REALTOR_QUERY,
    rowsReturned: 0,
    error: null,
    dataSource: "real Supabase data",
  };

  try {
    const sb = getAdminClient();
    const { data: rows, error } = await sb
      .from("realtors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      debug.error = formatSupabaseError(error);
    } else {
      debug.rowsReturned = rows?.length ?? 0;
      return { rows: (rows ?? []) as Realtor[], debug };
    }
  } catch (error) {
    debug.error = formatSupabaseError(error);
  }

  const publicClient = getPublicClient();
  const { data: publicRows, error: publicError } = await publicClient
    .from("realtors")
    .select("*")
    .order("created_at", { ascending: false });

  if (publicError) {
    debug.error = [debug.error, `Publishable key fallback: ${formatSupabaseError(publicError)}`]
      .filter(Boolean)
      .join("\n");
    debug.rowsReturned = 0;
    return { rows: [] as Realtor[], debug };
  }

  debug.rowsReturned = publicRows?.length ?? 0;
  return { rows: (publicRows ?? []) as Realtor[], debug };
}

// ---------- Auth ----------
export const verifyAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: OptionalAdminInput) => d ?? {})
  .handler(async () => {
    return { ok: true };
  });

// ---------- Realtors ----------
export const adminListRealtors = createServerFn({ method: "POST" })
  .inputValidator((d: OptionalAdminInput) => d ?? {})
  .handler(async () => {
    const { rows } = await readRealtorsWithDebug();
    return rows;
  });

export const adminListRealtorsDebug = createServerFn({ method: "POST" })
  .inputValidator((d: OptionalAdminInput) => d ?? {})
  .handler(async () => {
    return readRealtorsWithDebug();
  });

export const adminUpsertRealtor = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; realtor: Partial<Realtor> }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const payload: any = { ...data.realtor, updated_at: new Date().toISOString() };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await sb.from("realtors").upsert(payload).select("*").single();
    if (error) throw error;
    return row as Realtor;
  });

export const adminListDomains = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; realtorId?: string }) => d ?? {})
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    let q = sb.from("realtor_domains").select("*").order("created_at", { ascending: false });
    if (data.realtorId) q = q.eq("realtor_id", data.realtorId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows as RealtorDomain[];
  });

export const adminUpsertDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; domain: Partial<RealtorDomain> }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const payload: any = { ...data.domain };
    if (payload.domain) payload.domain = String(payload.domain).toLowerCase().replace(/^www\./, "").split(":")[0];
    if (!payload.id) delete payload.id;
    const { data: row, error } = await sb.from("realtor_domains").upsert(payload).select("*").single();
    if (error) throw error;
    return row;
  });

export const adminDeleteDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; id: string }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const { error } = await sb.from("realtor_domains").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Listings ----------
export const adminListListings = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; realtorId?: string } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    let q = sb.from("listings").select("*").order("sort_order", { ascending: true });
    if (data.realtorId) q = q.eq("realtor_id", data.realtorId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows as Listing[];
  });

export const adminGetListing = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; id: string }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const { data: l } = await sb.from("listings").select("*").eq("id", data.id).single();
    const { data: photos } = await sb.from("listing_photos").select("*").eq("listing_id", data.id).order("sort_order");
    return { listing: l as Listing, photos: (photos ?? []) as ListingPhoto[] };
  });

export const adminUpsertListing = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; listing: Partial<Listing> }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const payload: any = { ...data.listing, updated_at: new Date().toISOString() };
    if (!payload.id) delete payload.id;
    const { data: row, error } = await sb.from("listings").upsert(payload).select("*").single();
    if (error) throw error;
    return row as Listing;
  });

export const adminDeleteListing = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; id: string }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const { error } = await sb.from("listings").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Photos ----------
export const adminAddPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; listingId: string; image_url: string; alt_text?: string; sort_order?: number }) => d)
  .handler(async ({ data }) => {
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
  .inputValidator((d: { password?: string; id: string }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const { error } = await sb.from("listing_photos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Uploads (base64 -> storage) ----------
export const adminUpload = createServerFn({ method: "POST" })
  .inputValidator((d: { password?: string; bucket: "listing-photos" | "realtor-assets" | "listing-pdfs"; path: string; contentType: string; base64: string }) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error } = await sb.storage.from(data.bucket).upload(data.path, bytes, {
      contentType: data.contentType,
      upsert: true,
    });
    if (error) throw error;
    return { url: publicUrl(data.bucket, data.path) };
  });
