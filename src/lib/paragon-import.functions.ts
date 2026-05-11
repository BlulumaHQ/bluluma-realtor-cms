import { createServerFn } from "@tanstack/react-start";
import { getAdminClient, SUPABASE_URL } from "./supabase/admin.server";
import type { Listing } from "./types";

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(s: string) {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function getMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeHtml(m[1]);
  }
  return null;
}

function getAllMeta(html: string, prop: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "gi",
  );
  let m;
  while ((m = re.exec(html))) out.push(decodeHtml(m[1]));
  return out;
}

type Diagnostics = {
  fetch_success: boolean;
  html_returned: boolean;
  html_length: number;
  page_blocked: boolean;
  rendering_type: "server-side" | "client-side" | "unknown";
  gallery_images_detected: boolean;
  firecrawl_used: boolean;
  firecrawl_error: string | null;
  plain_fetch_status: number | null;
  screenshot_url: string | null;
};

type Parsed = {
  title: string | null;
  address: string | null;
  city: string | null;
  price: number | null;
  status: string | null;
  category: string | null;
  transaction_type: string | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: string | null;
  mls_number: string | null;
  description: string | null;
  features: string[];
  image_urls: string[];
  pdf_url: string | null;
  source_url: string;
  parse_warnings: string[];
  diagnostics: Diagnostics;
  html_preview: string;
  detected_text_blocks: string[];
  matched_selectors: Record<string, boolean>;
  failed_selectors: string[];
  markdown_preview: string | null;
};

function parseFromContent(
  html: string,
  markdown: string | null,
  sourceUrl: string,
  diagnostics: Diagnostics,
): Parsed {
  const warnings: string[] = [];
  const ogTitle = getMeta(html, "og:title") ?? getMeta(html, "twitter:title");
  const ogDesc = getMeta(html, "og:description") ?? getMeta(html, "description");
  const ogImage = getMeta(html, "og:image");
  const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;

  // Try JSON-LD
  let ld: any = null;
  const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        const t = item?.["@type"];
        if (t === "Product" || t === "Residence" || t === "SingleFamilyResidence" || t === "RealEstateListing" || t === "Apartment" || t === "House") {
          ld = item;
          break;
        }
        if (item?.["@graph"]) {
          for (const g of item["@graph"]) {
            if (typeof g?.["@type"] === "string" && /(Residence|Listing|House|Apartment|Property)/i.test(g["@type"])) {
              ld = g;
              break;
            }
          }
        }
        if (ld) break;
      }
      if (ld) break;
    } catch {
      // ignore bad ld+json
    }
  }

  // Images: collect from og:image:* and visible <img> tags pointing at likely listing photos
  const images = new Set<string>();
  for (const u of getAllMeta(html, "og:image")) images.add(u);
  for (const u of getAllMeta(html, "og:image:secure_url")) images.add(u);
  for (const u of getAllMeta(html, "twitter:image")) images.add(u);

  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let im;
  while ((im = imgRe.exec(html))) {
    const url = im[1];
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(url) && !/(logo|sprite|icon|avatar|placeholder)/i.test(url)) {
      try {
        const abs = new URL(url, sourceUrl).toString();
        images.add(abs);
      } catch {
        // ignore
      }
    }
  }
  // data-src lazy loading
  const dataSrcRe = /data-(?:src|original|lazy(?:-src)?)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi;
  while ((im = dataSrcRe.exec(html))) {
    try {
      const abs = new URL(im[1], sourceUrl).toString();
      if (!/(logo|sprite|icon|avatar)/i.test(abs)) images.add(abs);
    } catch {
      // ignore
    }
  }

  // Text-only body for regex hunting
  const text = stripTags(html);

  const priceMatch =
    text.match(/\$\s?([\d,]{4,})\b/) ||
    null;
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : ld?.offers?.price ?? null;

  const beds =
    ld?.numberOfBedrooms ??
    (Number(text.match(/(\d+)\s*(?:bed|bd|bedroom)/i)?.[1] ?? "") || null);
  const baths =
    ld?.numberOfBathroomsTotal ??
    (Number(text.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i)?.[1] ?? "") || null);
  const sqftMatch = text.match(/([\d,]{3,})\s*(?:sq\.?\s*ft|sqft|square\s+feet)/i);
  const sqft = sqftMatch ? Number(sqftMatch[1].replace(/,/g, "")) : null;
  const lot = text.match(/lot\s*size[:\s]*([\d.,]+\s*(?:sq\s*ft|acres?|ac))/i)?.[1] ?? null;
  const mls =
    text.match(/MLS\s*#?\s*[:\-]?\s*([A-Z0-9-]{4,})/i)?.[1] ??
    text.match(/listing\s*#?\s*[:\-]?\s*([A-Z0-9-]{4,})/i)?.[1] ??
    null;

  // Address: prefer JSON-LD
  let address: string | null = null;
  let city: string | null = null;
  if (ld?.address) {
    const a = ld.address;
    address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(", ");
    city = a.addressLocality ?? null;
  }
  if (!address && ogTitle) {
    address = ogTitle.split("|")[0].trim();
  }

  // property type heuristics
  const propType =
    ld?.["@type"] ??
    (/(condo|townhouse|townhome|detached|semi-detached|apartment|duplex|land|lot|commercial|office|retail|industrial|warehouse)/i.exec(text)?.[1] ?? null);

  const transaction = /for\s+lease|rental|for\s+rent/i.test(text) ? "lease" : "sale";
  const status = /\b(sold|closed|completed)\b/i.test(text) ? "sold" : "active";

  // Features: bulleted lists
  const features: string[] = [];
  const liRe = /<li[^>]*>([^<]{3,160})<\/li>/gi;
  let lm;
  while ((lm = liRe.exec(html)) && features.length < 40) {
    const v = decodeHtml(lm[1]).trim();
    if (v && !/menu|navigation|sign in|©|copyright/i.test(v)) features.push(v);
  }

  // PDF link
  const pdfMatch = html.match(/href=["']([^"']+\.pdf[^"']*)["']/i);
  let pdfUrl: string | null = null;
  if (pdfMatch) {
    try {
      pdfUrl = new URL(pdfMatch[1], sourceUrl).toString();
    } catch {
      pdfUrl = null;
    }
  }

  if (images.size === 0) warnings.push("No images detected on page.");
  if (!address) warnings.push("Could not detect address.");
  if (!price) warnings.push("Could not detect price.");

  return {
    title: ogTitle ?? titleTag,
    address,
    city,
    price: price && Number.isFinite(price) ? Number(price) : null,
    status,
    category: /commercial|office|retail|industrial|warehouse/i.test(text) ? "commercial" : "residential",
    transaction_type: transaction,
    property_type: typeof propType === "string" ? propType : null,
    beds: beds && Number.isFinite(beds) ? Number(beds) : null,
    baths: baths && Number.isFinite(baths) ? Number(baths) : null,
    sqft,
    lot_size: lot,
    mls_number: mls,
    description: ogDesc,
    features,
    image_urls: Array.from(images),
    pdf_url: pdfUrl,
    source_url: sourceUrl,
    parse_warnings: warnings,
  };
}

export const paragonParseUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    const url = data.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("Invalid URL. Must start with http(s)://");
    }
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ParagonImportBot/1.0; +https://lovable.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
      html = await res.text();
    } catch (e: any) {
      throw new Error(`Could not fetch the Paragon page: ${e?.message ?? String(e)}`);
    }
    return parseHtml(html, url);
  });

type ImportPayload = {
  realtorId: string;
  destination: "active" | "sold" | "commercial";
  paragonUrl: string;
  listing: Partial<Listing>;
  imageUrls: string[];
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function downloadAndStore(
  sb: ReturnType<typeof getAdminClient>,
  url: string,
  basePath: string,
  index: number,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ParagonImportBot/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    const path = `${basePath}/${Date.now()}-${index}.${ext}`;
    const { error } = await sb.storage.from("listing-photos").upload(path, buf, {
      contentType: ct,
      upsert: true,
    });
    if (error) return null;
    return publicUrl("listing-photos", path);
  } catch {
    return null;
  }
}

export const paragonImportListing = createServerFn({ method: "POST" })
  .inputValidator((d: ImportPayload) => d)
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const dest = data.destination;

    const baseListing: Partial<Listing> = { ...data.listing };
    baseListing.realtor_id = data.realtorId;
    baseListing.listing_type = "paragon";
    baseListing.paragon_url = data.paragonUrl;

    if (dest === "active") {
      baseListing.status = "active";
      baseListing.featured = true;
      baseListing.show_in_sold = false;
      baseListing.category = baseListing.category ?? "residential";
    } else if (dest === "sold") {
      baseListing.status = "sold";
      baseListing.featured = false;
      baseListing.show_in_sold = true;
      baseListing.category = baseListing.category ?? "residential";
    } else if (dest === "commercial") {
      baseListing.category = "commercial";
      baseListing.featured = baseListing.featured ?? false;
      baseListing.status = baseListing.status ?? "active";
    }

    if (!baseListing.slug) {
      const seed = baseListing.address || baseListing.title || baseListing.mls_number || `listing-${Date.now()}`;
      baseListing.slug = `${slugify(seed)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Insert listing first (without photos so we have ID)
    const { data: inserted, error: insertErr } = await sb
      .from("listings")
      .insert({ ...baseListing, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (insertErr) throw insertErr;

    const listing = inserted as Listing;
    const basePath = `${data.realtorId}/${listing.id}`;
    const storedUrls: string[] = [];
    const failedUrls: string[] = [];

    for (let i = 0; i < data.imageUrls.length; i++) {
      const src = data.imageUrls[i];
      const stored = await downloadAndStore(sb, src, basePath, i);
      if (stored) storedUrls.push(stored);
      else failedUrls.push(src);
    }

    let primary = listing.primary_image_url ?? null;
    if (!primary && storedUrls.length > 0) primary = storedUrls[0];

    if (storedUrls.length > 0) {
      const rows = storedUrls.map((u, idx) => ({
        listing_id: listing.id,
        image_url: u,
        sort_order: idx,
      }));
      await sb.from("listing_photos").insert(rows);
    }

    if (primary && primary !== listing.primary_image_url) {
      await sb.from("listings").update({ primary_image_url: primary }).eq("id", listing.id);
    }

    return {
      listing_id: listing.id,
      slug: listing.slug,
      images_stored: storedUrls.length,
      images_failed: failedUrls.length,
      failed_urls: failedUrls,
      primary_image_url: primary,
    };
  });
