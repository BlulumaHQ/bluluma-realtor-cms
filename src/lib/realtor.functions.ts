import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Realtor, Listing, ListingPhoto } from "./types";

const SUPABASE_URL = "https://pnstqwyuhdzdmodeqvid.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aN7LwltKQzntPyc4_moyQg_XSWARdPD";

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
}

function normalizeHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "").split(":")[0];
}

export const getRealtorByHost = createServerFn({ method: "GET" })
  .inputValidator((data: { host: string }) => data)
  .handler(async ({ data }) => {
    const supabase = sb();
    const host = normalizeHost(data.host);

    const { data: domainRow } = await supabase
      .from("realtor_domains")
      .select("realtor_id")
      .eq("domain", host)
      .maybeSingle();

    if (!domainRow) {
      return { realtor: null as Realtor | null, host };
    }

    const { data: realtor } = await supabase
      .from("realtors")
      .select("*")
      .eq("id", domainRow.realtor_id)
      .maybeSingle();

    return { realtor: realtor as Realtor | null, host };
  });

export const getRealtorBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = sb();
    const { data: realtor } = await supabase
      .from("realtors")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    return { realtor: realtor as Realtor | null };
  });

export const getHomeData = createServerFn({ method: "GET" })
  .inputValidator((data: { realtorId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = sb();
    const [featured, sold] = await Promise.all([
      supabase
        .from("listings")
        .select("*")
        .eq("realtor_id", data.realtorId)
        .eq("featured", true)
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .limit(6),
      supabase
        .from("listings")
        .select("*")
        .eq("realtor_id", data.realtorId)
        .eq("show_in_sold", true)
        .eq("status", "sold")
        .order("sold_sort_order", { ascending: true })
        .limit(6),
    ]);
    return {
      featured: (featured.data ?? []) as Listing[],
      sold: (sold.data ?? []) as Listing[],
    };
  });

export const listListings = createServerFn({ method: "GET" })
  .inputValidator((data: { realtorId: string; status?: string; category?: string; transactionType?: string }) => data)
  .handler(async ({ data }) => {
    const supabase = sb();
    let q = supabase.from("listings").select("*").eq("realtor_id", data.realtorId);
    if (data.status) q = q.eq("status", data.status);
    if (data.category) q = q.eq("category", data.category);
    if (data.transactionType) q = q.eq("transaction_type", data.transactionType);
    const { data: rows } = await q.order("sort_order", { ascending: true });
    return (rows ?? []) as Listing[];
  });

export const getListingBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { realtorId: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = sb();
    const { data: listing } = await supabase
      .from("listings")
      .select("*")
      .eq("realtor_id", data.realtorId)
      .eq("slug", data.slug)
      .maybeSingle();
    if (!listing) return { listing: null, photos: [] as ListingPhoto[] };
    const { data: photos } = await supabase
      .from("listing_photos")
      .select("*")
      .eq("listing_id", listing.id)
      .order("sort_order", { ascending: true });
    return { listing: listing as Listing, photos: (photos ?? []) as ListingPhoto[] };
  });
