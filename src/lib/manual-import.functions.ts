import { createServerFn } from "@tanstack/react-start";
import { getAdminClient, SUPABASE_URL } from "./supabase/admin.server";

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// --- AI vision: extract listing data from screenshot(s) ---
const EXTRACTION_PROMPT = `You are extracting real-estate listing data from one or more screenshots of a Paragon MLS listing detail page.

Look carefully at every visible field. Return ONE strict JSON object with this shape (use null for anything that is not visible — never guess):

{
  "address": string|null,
  "city": string|null,
  "area": string|null,
  "postal_code": string|null,
  "list_price": number|null,
  "sold_price": number|null,
  "sold_date": string|null,
  "lease_rate": number|null,
  "lease_rate_unit": "per_month"|"per_year"|"per_sqft"|null,
  "available_sqft": number|null,
  "beds": number|null,
  "baths": number|null,
  "sqft": number|null,
  "property_type": string|null,
  "building_type": string|null,
  "zoning": string|null,
  "year_built": number|null,
  "mls_number": string|null,
  "description": string|null,
  "extra": { [key: string]: string|number|null }
}

Numeric fields must be plain numbers (no $ or commas). Put EVERY other visible field (taxes, lot size, parking, heating, brokerage, agent, etc.) into "extra" as key/value pairs. Return ONLY the JSON object, no prose, no code fences.`;

export const manualExtractFromScreenshots = createServerFn({ method: "POST" })
  .inputValidator((d: { images: string[] /* data URLs */ }) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    if (!data.images || data.images.length === 0) throw new Error("Upload at least one screenshot");

    const content: any[] = [{ type: "text", text: EXTRACTION_PROMPT }];
    for (const img of data.images) {
      content.push({ type: "image_url", image_url: { url: img } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 300)}`);
    }

    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("AI did not return JSON. Raw: " + text.slice(0, 200));
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch (e: any) {
      throw new Error("Could not parse AI JSON: " + e.message);
    }
    return { extracted: parsed, raw: text };
  });

// --- Fetch cover image from a Paragon link ---
export const manualFetchCover = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BlulumaImportBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) return { url: null as string | null, error: `HTTP ${res.status}` };
      const html = await res.text();

      const candidates = new Set<string>();
      // og:image
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (og) candidates.add(og[1]);
      // any zimg.paragon URL
      const re = /https?:\/\/[^\s"'<>]*zimg\.paragon[^\s"'<>]*\.(?:jpg|jpeg|png|webp)/gi;
      let m;
      while ((m = re.exec(html))) candidates.add(m[0]);

      const chosen = Array.from(candidates).find((u) => /zimg\.paragon/i.test(u)) ?? Array.from(candidates)[0] ?? null;
      if (!chosen) return { url: null, error: "No image found in page" };
      return { url: chosen, error: null as string | null };
    } catch (e: any) {
      return { url: null as string | null, error: e?.message ?? String(e) };
    }
  });

// --- Duplicate check ---
export const manualCheckDuplicate = createServerFn({ method: "POST" })
  .inputValidator((d: { realtorId: string; mlsNumber: string }) => d)
  .handler(async ({ data }) => {
    if (!data.mlsNumber) return { existing: null };
    const sb = getAdminClient();
    const { data: row } = await sb
      .from("listings")
      .select("id, slug, address, status")
      .eq("realtor_id", data.realtorId)
      .eq("mls_number", data.mlsNumber)
      .maybeSingle();
    return { existing: row ?? null };
  });

// --- Upload one gallery photo from a data URL ---
async function uploadDataUrl(
  sb: ReturnType<typeof getAdminClient>,
  basePath: string,
  index: number,
  filename: string,
  dataUrl: string,
): Promise<string | null> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const ct = m[1] || "image/jpeg";
  const b64 = m[2];
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
  const path = `${basePath}/${Date.now()}-${index}-${safeName}.${ext}`;
  const { error } = await sb.storage.from("listing-photos").upload(path, buf, { contentType: ct, upsert: true });
  if (error) return null;
  return publicUrl("listing-photos", path);
}

// --- Download a remote image URL and store it ---
async function downloadAndStore(
  sb: ReturnType<typeof getAdminClient>,
  basePath: string,
  url: string,
  index: number,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlulumaImportBot/1.0)",
        Accept: "image/*,*/*;q=0.8",
        Referer: new URL(url).origin,
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(ct)) return null;
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    const path = `${basePath}/cover-${Date.now()}-${index}.${ext}`;
    const { error } = await sb.storage.from("listing-photos").upload(path, buf, { contentType: ct, upsert: true });
    if (error) return null;
    return publicUrl("listing-photos", path);
  } catch {
    return null;
  }
}

// --- Save listing ---
export type ManualListingType =
  | "residential_active"
  | "residential_sold"
  | "commercial_sale_active"
  | "commercial_lease"
  | "commercial_sold";

type SavePayload = {
  realtorId: string;
  listingType: ManualListingType;
  paragonUrl: string;
  coverImageUrl: string | null; // remote URL fetched from paragon link, optional
  fields: {
    address: string | null;
    city: string | null;
    area: string | null;
    postal_code: string | null;
    list_price: number | null;
    sold_price: number | null;
    sold_date: string | null;
    lease_rate: number | null;
    lease_rate_unit: string | null;
    available_sqft: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    property_type: string | null;
    building_type: string | null;
    zoning: string | null;
    year_built: number | null;
    mls_number: string | null;
    description: string | null;
    extra: Record<string, any> | null;
  };
  // Gallery photos, ordered. Each item is a data URL (already on the client).
  gallery: Array<{ filename: string; dataUrl: string }>;
  overwriteListingId?: string | null;
};

export const manualSaveListing = createServerFn({ method: "POST" })
  .inputValidator((d: SavePayload) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const f = data.fields;

    if (!f.address) throw new Error("Address is required");
    if (!f.mls_number) throw new Error("MLS number is required");

    const isCommercial = data.listingType.startsWith("commercial");
    const isSold = data.listingType.endsWith("_sold");
    const isLease = data.listingType === "commercial_lease";
    const category = isCommercial ? "commercial" : "residential";
    const status = isSold ? "sold" : "active";
    const transaction_type = isLease ? "lease" : isCommercial ? "sale" : null;

    // Price: residential uses list_price; commercial sale uses list_price; lease uses lease_rate
    const price = isLease ? f.lease_rate : f.list_price;

    const features: Record<string, any> = {
      ...(f.extra ?? {}),
      area: f.area,
      postal_code: f.postal_code,
      sold_price: f.sold_price,
      sold_date: f.sold_date,
      lease_rate: f.lease_rate,
      lease_rate_unit: f.lease_rate_unit,
      available_sqft: f.available_sqft,
      building_type: f.building_type,
      zoning: f.zoning,
      year_built: f.year_built,
      listing_type_choice: data.listingType,
    };

    const baseListing: any = {
      realtor_id: data.realtorId,
      listing_type: "manual",
      paragon_url: data.paragonUrl || null,
      category,
      status,
      transaction_type,
      address: f.address,
      city: f.city,
      price,
      beds: isCommercial ? null : f.beds,
      baths: isCommercial ? null : f.baths,
      sqft: f.sqft ?? f.available_sqft ?? null,
      property_type: isCommercial ? f.building_type : f.property_type,
      mls_number: f.mls_number,
      description: f.description,
      features,
      featured: !isSold && !isCommercial,
      show_in_sold: isSold,
    };

    // Insert or overwrite
    let listingId: string;
    let slug: string;
    if (data.overwriteListingId) {
      const { data: updated, error } = await sb
        .from("listings")
        .update({ ...baseListing, updated_at: new Date().toISOString() })
        .eq("id", data.overwriteListingId)
        .select("id, slug")
        .single();
      if (error) throw error;
      listingId = updated.id;
      slug = updated.slug;

      // Clear existing photos so the new gallery replaces them
      await sb.from("listing_photos").delete().eq("listing_id", listingId);
    } else {
      const seed = f.address || f.mls_number || `listing-${Date.now()}`;
      const newSlug = `${slugify(seed)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: inserted, error } = await sb
        .from("listings")
        .insert({ ...baseListing, slug: newSlug, updated_at: new Date().toISOString() })
        .select("id, slug")
        .single();
      if (error) throw error;
      listingId = inserted.id;
      slug = inserted.slug;
    }

    const basePath = `${data.realtorId}/${listingId}`;

    // Upload gallery photos in given order
    const galleryUrls: string[] = [];
    for (let i = 0; i < data.gallery.length; i++) {
      const g = data.gallery[i];
      const url = await uploadDataUrl(sb, basePath, i, g.filename, g.dataUrl);
      if (url) galleryUrls.push(url);
    }

    // Cover: try paragon-link cover first
    let primary: string | null = null;
    if (data.coverImageUrl) {
      primary = await downloadAndStore(sb, basePath, data.coverImageUrl, 0);
    }
    if (!primary) {
      primary = galleryUrls[0] ?? null;
    }

    if (galleryUrls.length > 0) {
      const rows = galleryUrls.map((u, idx) => ({
        listing_id: listingId,
        image_url: u,
        sort_order: idx,
      }));
      await sb.from("listing_photos").insert(rows);
    }

    if (primary) {
      await sb.from("listings").update({ primary_image_url: primary }).eq("id", listingId);
    }

    return {
      listing_id: listingId,
      slug,
      photos_stored: galleryUrls.length,
      primary_image_url: primary,
    };
  });
