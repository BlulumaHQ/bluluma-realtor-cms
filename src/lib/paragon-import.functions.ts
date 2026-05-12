import { createServerFn } from "@tanstack/react-start";
import { getAdminClient, SUPABASE_URL } from "./supabase/admin.server";
import type { Listing } from "./types";

function publicUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function decodeHtml(s: string) {
  return String(s ?? "")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
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

function compact(s: string) {
  return decodeHtml(s).replace(/\s+/g, " ").trim();
}

function stripTags(s: string) {
  return compact(String(s ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function getMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return compact(m[1]);
  }
  return null;
}

function getAllMeta(html: string, prop: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "gi");
  let m;
  while ((m = re.exec(html))) out.push(compact(m[1]));
  return out;
}

type RawFact = { label: string; value: string; source: string };
type RejectedImage = { url: string; reason: string; source: string; context?: string };
type ImageCandidate = {
  url: string;
  source: string;
  context: string;
  width?: number | null;
  height?: number | null;
  score: number;
};

type ImageCheck = {
  url: string;
  ok: boolean;
  status: number | null;
  content_type: string | null;
  content_length: number | null;
  width: number | null;
  height: number | null;
  reason: string | null;
};

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
  final_url: string | null;
  page_title: string | null;
  text_blocks_found: number;
  key_value_rows_found: number;
  image_urls_found: number;
  gallery_images_kept: number;
  images_rejected: number;
  rejected_images: RejectedImage[];
  image_checks: ImageCheck[];
  selectors_used: string[];
  selectors_failed: string[];
  appears_client_side_rendered: boolean;
};

type StructuredFeatures = {
  brokerage: string | null;
  listing_agent: string | null;
  co_listing_agent: string | null;
  office_name: string | null;
  province: string | null;
  postal_code: string | null;
  neighborhood: string | null;
  subdivision: string | null;
  region: string | null;
  municipality: string | null;
  latitude: string | null;
  longitude: string | null;
  year_built: string | null;
  strata_fee: string | null;
  taxes: string | null;
  zoning: string | null;
  parking: string | null;
  garage: string | null;
  property_style: string | null;
  building_type: string | null;
  land_size: string | null;
  floor_area: string | null;
  units: string | null;
  lease_sale_information: string | null;
  heating: string | null;
  cooling: string | null;
  fireplace: string | null;
  basement: string | null;
  view: string | null;
  site_influences: string[];
  nearby_amenities: string[];
  public_transportation: string | null;
  interior_features: string[];
  exterior_features: string[];
  amenities: string[];
  appliances: string[];
  utilities: string[];
  feature_list: string[];
  raw_facts: RawFact[];
};

type Parsed = {
  title: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
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
  features: StructuredFeatures;
  image_urls: string[];
  rejected_images: RejectedImage[];
  all_image_urls: string[];
  pdf_url: string | null;
  source_url: string;
  parse_warnings: string[];
  diagnostics: Diagnostics;
  html_preview: string;
  detected_text_blocks: string[];
  raw_facts: RawFact[];
  matched_selectors: Record<string, boolean>;
  failed_selectors: string[];
  markdown_preview: string | null;
};

function isGenericTitle(title: string | null | undefined) {
  if (!title) return true;
  return /^(view listings?|listings?|paragon|property search|home|search)$/i.test(compact(title));
}

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = String(value).match(/\$?\s*([0-9][0-9,]{3,})(?:\.\d{2})?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = String(value).match(/([0-9][0-9,]*)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function addFact(facts: RawFact[], seen: Set<string>, label: string, value: string, source: string) {
  const cleanLabel = compact(label).replace(/^[:\-–—]+|[:\-–—]+$/g, "");
  const cleanValue = compact(value).replace(/^[:\-–—]+|[:\-–—]+$/g, "");
  if (cleanLabel.length < 2 || cleanValue.length < 1 || cleanLabel.length > 90 || cleanValue.length > 1500) return;
  if (/^(menu|navigation|privacy|terms|copyright|login|sign in|share|print|save|view listings?)$/i.test(cleanLabel)) return;
  if (/^(menu|navigation|privacy|terms|copyright|login|sign in|share|print|save)$/i.test(cleanValue)) return;
  const key = `${cleanLabel.toLowerCase()}::${cleanValue.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  facts.push({ label: cleanLabel, value: cleanValue, source });
}

function extractFacts(html: string, markdown: string | null): RawFact[] {
  const facts: RawFact[] = [];
  const seen = new Set<string>();

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm;
  while ((rm = rowRe.exec(html))) {
    const cells = [...rm[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
    if (cells.length >= 2 && cells.length <= 8) {
      for (let i = 0; i + 1 < cells.length; i += 2) addFact(facts, seen, cells[i], cells[i + 1], "table-row");
    }
  }

  const ddRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let dm;
  while ((dm = ddRe.exec(html))) addFact(facts, seen, stripTags(dm[1]), stripTags(dm[2]), "definition-list");

  const ariaRe = /<(?:div|span|li|p)[^>]+(?:class|data-testid|aria-label)=["'][^"']*(?:row|field|detail|fact|spec|item|label|value)[^"']*["'][^>]*>([\s\S]{0,600}?)<\/(?:div|span|li|p)>/gi;
  let am;
  while ((am = ariaRe.exec(html))) {
    const text = stripTags(am[1]);
    const kv = text.match(/^([^:|•]{2,70})\s*[:|•]\s*(.{1,600})$/);
    if (kv) addFact(facts, seen, kv[1], kv[2], "detail-block");
  }

  const md = markdown ?? "";
  for (const rawLine of md.split(/\n+/)) {
    const line = compact(rawLine.replace(/^[-*#\s]+/, ""));
    if (!line || line.length > 800 || /^https?:\/\//i.test(line)) continue;
    const kv = line.match(/^([^:|•]{2,70})\s*(?::|\||•| - | – | — )\s*(.{1,700})$/);
    if (kv) addFact(facts, seen, kv[1], kv[2], "markdown");
  }

  const text = stripTags(html);
  const labelPatterns = [
    "MLS", "MLS Number", "List Price", "Price", "Address", "City", "Municipality", "Area", "Sub Area", "Bedrooms", "Bathrooms", "Full Baths", "Floor Area", "Lot Size", "Year Built", "Property Type", "Dwelling Type", "Building Type", "Public Remarks", "Remarks", "Features", "Amenities", "Appliances", "Heating", "Cooling", "Taxes", "Strata Fee", "Zoning", "Parking", "Garage", "Basement", "View", "Listing Brokerage", "Listing Agent", "Office", "Postal Code", "Province",
  ];
  for (const label of labelPatterns) {
    const re = new RegExp(`${label.replace(/ /g, "\\s+")}\\s*[:\\-–—]?\\s*(.{1,220})`, "i");
    const match = text.match(re);
    if (match) addFact(facts, seen, label, match[1].split(/\s{3,}|\|/)[0], "text-regex");
  }

  return facts;
}


function findFact(facts: RawFact[], patterns: RegExp[], opts?: { excludeSources?: string[]; validate?: (v: string) => boolean }) {
  for (const p of patterns) {
    for (const f of facts) {
      if (!p.test(f.label)) continue;
      if (opts?.excludeSources?.includes(f.source)) continue;
      if (opts?.validate && !opts.validate(f.value)) continue;
      if (f.value) return f.value;
    }
  }
  return null;
}

// Stricter fact lookup: ignore loose text-regex source (which often grabs neighboring text).
function findStructured(facts: RawFact[], patterns: RegExp[], validate?: (v: string) => boolean) {
  return findFact(facts, patterns, { excludeSources: ["text-regex"], validate });
}

// Field validators / sanitizers
const STRUCTURED_SOURCES = ["table-row", "definition-list", "detail-block", "markdown"];

function isPlausibleCity(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = compact(v);
  if (s.length < 2 || s.length > 50) return false;
  if (/[\/\\]/.test(s)) return false;
  if (/\d/.test(s)) return false;
  if (/(electricity|gas|water|sewer|storey|storeys|story|stories|heating|cooling|fireplace|garage|parking|basement|zoning|municipal\b|none|n\/a|n\.a\.|listing|mls|price|tax|strata|amenit|appliance|utility|utilities|feature)/i.test(s)) return false;
  return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .,-]*$/.test(s);
}

function sanitizeCity(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = compact(v).replace(/,.*$/, "").trim();
  return isPlausibleCity(s) ? s : null;
}

function isPlausibleYear(v: string | null | undefined): boolean {
  if (!v) return false;
  const m = String(v).match(/\b(1[89]\d{2}|20\d{2}|21\d{2})\b/);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 1800 && n <= new Date().getFullYear() + 3;
}

function sanitizeYear(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = String(v).match(/\b(1[89]\d{2}|20\d{2}|21\d{2})\b/);
  return m ? m[1] : null;
}

function isMoneyLike(v: string | null | undefined): boolean {
  if (!v) return false;
  return /\$|\b\d{2,3}(?:[.,]\d{3})+\b|\bmonthly\b|\bper month\b|\bper year\b|\bannual/i.test(v);
}

function sanitizeMoneyText(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = compact(v).slice(0, 80);
  return isMoneyLike(s) ? s : null;
}

function isShortLabelValue(v: string | null | undefined, max = 80): boolean {
  if (!v) return false;
  const s = compact(v);
  return s.length > 0 && s.length <= max && !/\$\d/.test(s);
}

function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return compact(value)
    .split(/\s*(?:,|;|\||•|·|\n|\r|\/\/| - )\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 140)
    .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, 80);
}

function textBlocks(html: string, markdown: string | null): string[] {
  const blocks: string[] = [];
  const seen = new Set<string>();
  const blockRe = /<(h1|h2|h3|h4|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let bm;
  while ((bm = blockRe.exec(html)) && blocks.length < 80) {
    const value = stripTags(bm[2]);
    const key = value.toLowerCase();
    if (value.length >= 4 && value.length < 700 && !seen.has(key) && !/^(menu|navigation|share|print|save|login)$/i.test(value)) {
      seen.add(key);
      blocks.push(`[${bm[1]}] ${value}`);
    }
  }
  for (const raw of (markdown ?? "").split(/\n+/)) {
    const value = compact(raw.replace(/^#+\s*/, ""));
    const key = value.toLowerCase();
    if (blocks.length >= 80) break;
    if (value.length >= 8 && value.length < 700 && !seen.has(key) && !/^https?:\/\//i.test(value)) {
      seen.add(key);
      blocks.push(`[md] ${value}`);
    }
  }
  return blocks;
}

function absoluteUrl(raw: string, sourceUrl: string): string | null {
  const cleaned = decodeHtml(raw)
    .replace(/^url\((.*)\)$/i, "$1")
    .replace(/^['"]|['"]$/g, "")
    .replace(/[),;]+$/g, "")
    .trim();
  if (!cleaned || /^(data:|blob:|javascript:|mailto:|tel:)/i.test(cleaned)) return null;
  try {
    return new URL(cleaned, sourceUrl).toString();
  } catch {
    return null;
  }
}

function looksLikeImageUrl(url: string) {
  const clean = decodeURIComponent(url).toLowerCase();
  return /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(clean) || /(photo|image|img|gallery|media|picture|thumbnail|fullsize|paragon|mlsphoto|getphoto|listingphoto|propertyphoto)/i.test(clean);
}

function imageDuplicateKey(url: string) {
  try {
    const u = new URL(url);
    const params = new URLSearchParams(u.search);
    for (const key of Array.from(params.keys())) {
      if (/^(w|h|width|height|size|thumb|thumbnail|quality|q|cache|crop|resize|format)$/i.test(key)) params.delete(key);
    }
    const cleanSearch = params.toString();
    return `${u.origin}${u.pathname}${cleanSearch ? `?${cleanSearch}` : ""}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function attrValue(attrs: string, name: string) {
  const m = attrs.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m ? compact(m[1]) : null;
}

function inferDimensionFromUrl(url: string, names: string[]) {
  try {
    const u = new URL(url);
    for (const name of names) {
      const v = u.searchParams.get(name);
      if (v && /^\d+$/.test(v)) return Number(v);
    }
  } catch {
    return null;
  }
  return null;
}

function addCandidate(candidates: ImageCandidate[], sourceUrl: string, raw: string, source: string, context: string, width?: number | null, height?: number | null) {
  const url = absoluteUrl(raw, sourceUrl);
  if (!url || !looksLikeImageUrl(url)) return;
  const inferredWidth = width ?? inferDimensionFromUrl(url, ["w", "width", "maxWidth"]);
  const inferredHeight = height ?? inferDimensionFromUrl(url, ["h", "height", "maxHeight"]);
  const lower = `${url} ${context}`.toLowerCase();
  let score = 0;
  if (/gallery|carousel|slider|photo|photos|property|listing|thumbnail|media|viewer|full|large|image/i.test(context)) score += 10;
  if (/property|listing|gallery|photo|photos|media|mlsphoto|paragon|fullsize|getphoto|listingphoto|propertyphoto/i.test(url)) score += 7;
  if (/srcset|data-src|lazy|background|href|json|firecrawl/i.test(source)) score += 4;
  if (/og:image|twitter:image/i.test(source)) score += 2;
  if (/hero|main|primary|large|full/i.test(lower)) score += 3;
  if (inferredWidth && inferredWidth >= 600) score += 3;
  if (inferredHeight && inferredHeight >= 400) score += 3;
  candidates.push({ url, source, context: compact(stripTags(context)).slice(0, 220), width: inferredWidth, height: inferredHeight, score });
}

function collectImageCandidates(html: string, sourceUrl: string, metaImages: string[], extraUrls: string[], structuredImages: string[]): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  for (const url of metaImages) addCandidate(candidates, sourceUrl, url, "og:image", "Open Graph listing image", null, null);
  for (const url of structuredImages) addCandidate(candidates, sourceUrl, url, "firecrawl-json", "Structured extraction image", null, null);
  for (const url of extraUrls) addCandidate(candidates, sourceUrl, url, "firecrawl-link", "Rendered page link", null, null);

  const tagRe = /<([a-z0-9-]+)([^>]{0,5000})>/gi;
  let tm;
  while ((tm = tagRe.exec(html))) {
    const tag = tm[1].toLowerCase();
    const attrs = tm[2];
    const around = html.slice(Math.max(0, tm.index - 350), Math.min(html.length, tm.index + tm[0].length + 350));
    const context = `${tag} ${attrs} ${around}`;
    const width = parseInteger(attrValue(attrs, "width"));
    const height = parseInteger(attrValue(attrs, "height"));
    const attrRe = /([:@\w-]+)=["']([^"']+)["']/gi;
    let am;
    while ((am = attrRe.exec(attrs))) {
      const name = am[1].toLowerCase();
      const value = am[2];
      if (name === "srcset" || /srcset/i.test(name)) {
        for (const part of value.split(",")) {
          const bits = part.trim().split(/\s+/);
          const descriptor = bits[1]?.match(/^(\d+)w$/i)?.[1];
          addCandidate(candidates, sourceUrl, bits[0], `srcset:${tag}`, context, descriptor ? Number(descriptor) : width, height);
        }
      } else if (name === "style") {
        const bgRe = /url\(([^)]+)\)/gi;
        let bg;
        while ((bg = bgRe.exec(value))) addCandidate(candidates, sourceUrl, bg[1], `background:${tag}`, context, width, height);
      } else if (name === "src" || name === "href" || /(?:src|image|img|photo|thumb|large|full|lazy|url|background|media)/i.test(name)) {
        addCandidate(candidates, sourceUrl, value, `${name}:${tag}`, context, width, height);
      }
    }
  }

  const cssBgRe = /background(?:-image)?\s*:\s*url\(([^)]+)\)/gi;
  let bg;
  while ((bg = cssBgRe.exec(html))) addCandidate(candidates, sourceUrl, bg[1], "background-css", html.slice(Math.max(0, bg.index - 220), bg.index + 260), null, null);

  const escapedUrlRe = /(?:https?:)?\\?\/\\?\/[^"'\s<>]+/gi;
  let um;
  while ((um = escapedUrlRe.exec(html))) {
    const raw = um[0].startsWith("//") || um[0].startsWith("\\/\\/") ? `https:${um[0]}` : um[0];
    addCandidate(candidates, sourceUrl, raw, "raw-url", html.slice(Math.max(0, um.index - 180), um.index + 220), null, null);
  }

  return candidates;
}

function rejectReason(candidate: ImageCandidate): string | null {
  const lowerUrl = decodeURIComponent(candidate.url).toLowerCase();
  const lowerContext = candidate.context.toLowerCase();
  const combined = `${lowerUrl} ${lowerContext}`;
  const hasPropertySignal = /(gallery|carousel|property|listing-photo|propertyphoto|mlsphoto|photo-gallery|photo viewer|getphoto|large|fullsize)/i.test(combined);
  if (/\.(svg|gif|ico)(?:[?#].*)?$/i.test(lowerUrl)) return "Rejected UI/vector image format";
  if (/(favicon|sprite|icon|marker|map-pin|map_|staticmap|maps\.google|googleapis\.com\/maps|placeholder|blank|loading|transparent|pixel|ui-|button|print|share)/i.test(lowerUrl) || (!hasPropertySignal && /(favicon|sprite|icon|marker|map-pin|map_|placeholder|button|print|share)/i.test(lowerContext))) return "Rejected UI icon, map, or placeholder image";
  if (/(logo|mls[-_\s]?logo|brokerage[-_\s]?logo|company[-_\s]?logo|brandmark|watermark)/i.test(lowerUrl) || (!hasPropertySignal && /(logo|brokerage[-_\s]?logo|company[-_\s]?logo|brandmark|watermark)/i.test(lowerContext))) return "Rejected logo/branding image";
  if (/(headshot|agent|avatar|profile|portrait|realtor|broker|brokerage|office|team|signature)/i.test(combined) && !hasPropertySignal) return "Rejected agent, avatar, office, or brokerage image";
  if ((candidate.width && candidate.width < 220) || (candidate.height && candidate.height < 160)) return "Rejected image that appears too small";
  if (candidate.width && candidate.height && candidate.width * candidate.height < 70000) return "Rejected image that appears too small";
  if (candidate.score < 5) return "Rejected image without property-gallery signals";
  return null;
}

function filterPropertyImages(candidates: ImageCandidate[]) {
  const rejected: RejectedImage[] = [];
  const grouped = new Map<string, ImageCandidate>();
  for (const c of candidates) {
    const reason = rejectReason(c);
    if (reason) {
      rejected.push({ url: c.url, reason, source: c.source, context: c.context });
      continue;
    }
    const key = imageDuplicateKey(c.url);
    const current = grouped.get(key);
    if (!current) grouped.set(key, c);
    else if ((c.score + (c.width ?? 0) / 1000) > (current.score + (current.width ?? 0) / 1000)) {
      rejected.push({ url: current.url, reason: "Rejected duplicate property image; kept a better/larger version", source: current.source, context: current.context });
      grouped.set(key, c);
    } else {
      rejected.push({ url: c.url, reason: "Rejected duplicate property image", source: c.source, context: c.context });
    }
  }
  const kept = Array.from(grouped.values())
    .sort((a, b) => b.score - a.score)
    .map((c) => c.url)
    .filter((url, i, arr) => arr.indexOf(url) === i)
    .slice(0, 80);
  return { kept, rejected };
}

function firstStructuredValue(json: any, keys: string[]): any {
  if (!json || typeof json !== "object") return null;
  const queue = [json];
  const keySet = new Set(keys.map((k) => k.toLowerCase()));
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object") continue;
    for (const [k, v] of Object.entries(item)) {
      if (keySet.has(k.toLowerCase()) && v != null && v !== "") return v;
      if (typeof v === "object") queue.push(v);
    }
  }
  return null;
}

function structuredString(json: any, keys: string[]) {
  const value = firstStructuredValue(json, keys);
  if (Array.isArray(value)) return value.map((x) => compact(String(x))).filter(Boolean).join(", ");
  if (value && typeof value === "object") return null;
  return value == null ? null : compact(String(value));
}

function structuredImages(json: any): string[] {
  const out: string[] = [];
  const queue = [json];
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object") continue;
    for (const [key, value] of Object.entries(item)) {
      if (/image|photo|gallery/i.test(key)) {
        if (typeof value === "string") out.push(value);
        if (Array.isArray(value)) for (const v of value) if (typeof v === "string") out.push(v);
      }
      if (typeof value === "object") queue.push(value);
    }
  }
  return out;
}

function extractPdf(html: string, links: string[], sourceUrl: string) {
  const pdfs = [
    ...[...html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)].map((m) => m[1]),
    ...links.filter((u) => /\.pdf(?:[?#]|$)/i.test(u)),
  ];
  for (const pdf of pdfs) {
    const abs = absoluteUrl(pdf, sourceUrl);
    if (abs) return abs;
  }
  return null;
}

function parseFromContent(
  html: string,
  markdown: string | null,
  sourceUrl: string,
  diagnostics: Diagnostics,
  firecrawlLinks: string[],
  firecrawlJson: any,
): Parsed {
  const warnings: string[] = [];
  const ogTitle = getMeta(html, "og:title") ?? getMeta(html, "twitter:title");
  const ogDesc = getMeta(html, "og:description") ?? getMeta(html, "description");
  const titleTag = compact(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "") || null;
  const text = stripTags(html);
  const blocks = textBlocks(html, markdown);
  const facts = extractFacts(html, markdown);
  const searchable = `${markdown ?? ""}\n${text}`;

  let ld: any = null;
  const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(decodeHtml(m[1]).trim());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const queue = [...arr];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const t = Array.isArray(item["@type"]) ? item["@type"].join(" ") : String(item["@type"] ?? "");
        if (/(Residence|RealEstate|Listing|House|Apartment|Product|Place|LocalBusiness)/i.test(t)) {
          ld = item;
          break;
        }
        if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
      }
      if (ld) break;
    } catch {
      null;
    }
  }

  const addressObj = ld?.address && typeof ld.address === "object" ? ld.address : null;
  const addressFromLd = addressObj ? [addressObj.streetAddress, addressObj.addressLocality, addressObj.addressRegion, addressObj.postalCode].filter(Boolean).join(", ") : null;
  const addressFromTitle = !isGenericTitle(ogTitle) && /\d{1,6}\s+/.test(ogTitle ?? "") ? (ogTitle ?? "").split(/\s+[|–—-]\s+/)[0] : null;
  const addressRegex = searchable.match(/\b\d{1,6}\s+[A-Z0-9][A-Za-z0-9 .#'-]{4,90}\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Court|Ct|Crescent|Cres|Place|Pl|Lane|Ln|Way|Boulevard|Blvd|Highway|Hwy|Trail|Terrace|Terr|Close|Circle|Cir)\b[^\n,]*/i)?.[0] ?? null;
  const address = findFact(facts, [/^(full\s*)?address$/i, /property address/i, /civic address/i, /street address/i]) ?? structuredString(firecrawlJson, ["address", "full_address", "street_address"]) ?? addressFromLd ?? addressFromTitle ?? addressRegex;

  const cityFact = findStructured(facts, [/^city$/i, /^city\/town$/i, /^city\s*\/\s*municipality$/i], (v) => isPlausibleCity(v));
  const cityCandidate = sanitizeCity(cityFact)
    ?? sanitizeCity(structuredString(firecrawlJson, ["city", "municipality", "community"]))
    ?? sanitizeCity(addressObj?.addressLocality);
  const city = cityCandidate
    ?? sanitizeCity(findStructured(facts, [/^community$/i, /^municipality$/i], (v) => isPlausibleCity(v)));

  const province = findStructured(facts, [/^province$/i, /address region/i, /^state$/i], (v) => /^[A-Za-z .]{2,40}$/.test(v))
    ?? structuredString(firecrawlJson, ["province", "state", "region"])
    ?? addressObj?.addressRegion
    ?? searchable.match(/\b(BC|British Columbia|AB|Alberta|ON|Ontario|MB|Manitoba|QC|Quebec|SK|Saskatchewan|NB|New Brunswick|NS|Nova Scotia|NL|Newfoundland|PE|Prince Edward Island|YT|Yukon|NT|Northwest Territories|NU|Nunavut)\b/i)?.[1]
    ?? null;

  const postal_code = findStructured(facts, [/postal/i, /zip/i], (v) => /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b|\b\d{5}(?:-\d{4})?\b/i.test(v))
    ?? structuredString(firecrawlJson, ["postal_code", "postalCode", "zip"])
    ?? addressObj?.postalCode
    ?? searchable.match(/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i)?.[0]
    ?? null;

  const priceSource =
    findFact(facts, [/list price/i, /^price$/i, /asking/i, /sale price/i]) ??
    structuredString(firecrawlJson, ["price", "list_price", "asking_price"]) ??
    (ld?.offers?.price != null ? String(ld.offers.price) : null) ??
    searchable.match(/\$\s?[\d,]{4,}/)?.[0];
  const price = parseMoney(priceSource);
  const beds = parseNumber(findFact(facts, [/bed(room)?s?/i, /beds total/i]) ?? structuredString(firecrawlJson, ["bedrooms", "beds"] ) ?? searchable.match(/(\d+(?:\.\d+)?)\s*(?:bed|bd|bedroom)/i)?.[0]);
  const baths = parseNumber(findFact(facts, [/bath(room)?s?/i, /baths total/i]) ?? structuredString(firecrawlJson, ["bathrooms", "baths"] ) ?? searchable.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i)?.[0]);
  const sqft = parseInteger(findFact(facts, [/floor area/i, /square feet/i, /sq\.?\s*ft/i, /^sqft$/i, /living area/i]) ?? structuredString(firecrawlJson, ["sqft", "square_feet", "floor_area"] ) ?? searchable.match(/[\d,]{3,}\s*(?:sq\.?\s*ft|sqft|square feet)/i)?.[0]);
  const lot_size = findFact(facts, [/lot size/i, /land size/i, /lot area/i]) ?? structuredString(firecrawlJson, ["lot_size", "land_size"] ) ?? searchable.match(/lot\s*size\s*[:\-]?\s*([\d.,]+\s*(?:sq\s*ft|sqft|acres?|ac|ha))/i)?.[1] ?? null;
  const mls_number = findFact(facts, [/^mls/i, /listing id/i, /listing number/i]) ?? structuredString(firecrawlJson, ["mls_number", "mls", "listing_id"]) ?? searchable.match(/MLS\s*#?\s*[:\-]?\s*([A-Z0-9-]{4,})/i)?.[1] ?? null;
  const property_type = findFact(facts, [/property type/i, /dwelling type/i]) ?? structuredString(firecrawlJson, ["property_type", "dwelling_type"]) ?? (/(condo|townhouse|townhome|detached|semi-detached|apartment|duplex|land|lot|commercial|office|retail|industrial|warehouse)/i.exec(searchable)?.[1] ?? null);
  const building_type = findFact(facts, [/building type/i]) ?? structuredString(firecrawlJson, ["building_type"]);
  const transaction_type = /for\s+lease|lease rate|for\s+rent|rental/i.test(searchable) ? "lease" : "sale";
  const category = /commercial|office|retail|industrial|warehouse|business with property|multi-family/i.test(searchable) ? "commercial" : "residential";
  const statusFact = findFact(facts, [/status/i]) ?? structuredString(firecrawlJson, ["status", "listing_status"]);
  const status = /sold|closed|completed/i.test(statusFact ?? searchable) ? "sold" : "active";

  const description = findFact(facts, [/public remarks/i, /^remarks$/i, /property description/i, /^description$/i, /marketing/i]) ?? structuredString(firecrawlJson, ["description", "public_remarks", "marketing_description", "remarks"]) ?? (ogDesc && !/view listings/i.test(ogDesc) ? ogDesc : null);
  const featureList = [
    ...splitList(findFact(facts, [/^features$/i, /property features/i])),
    ...splitList(structuredString(firecrawlJson, ["features", "feature_list"])),
  ];

  const rawTitle = structuredString(firecrawlJson, ["title", "listing_title"]) ?? findFact(facts, [/^title$/i, /listing title/i]) ?? ogTitle ?? titleTag;
  const title = !isGenericTitle(rawTitle) ? rawTitle : address ? address : null;

  const features: StructuredFeatures = {
    brokerage: findFact(facts, [/brokerage/i, /listing company/i, /company name/i]) ?? structuredString(firecrawlJson, ["brokerage", "listing_brokerage", "company"]),
    listing_agent: findFact(facts, [/listing agent/i, /^agent$/i, /sales representative/i]) ?? structuredString(firecrawlJson, ["listing_agent", "agent"]),
    co_listing_agent: findFact(facts, [/co[-\s]?listing agent/i, /co agent/i]) ?? structuredString(firecrawlJson, ["co_listing_agent", "co_agent"]),
    office_name: findFact(facts, [/office/i]) ?? structuredString(firecrawlJson, ["office", "office_name"]),
    province,
    postal_code,
    neighborhood: findFact(facts, [/neighbou?rhood/i, /subarea/i, /area/i]) ?? structuredString(firecrawlJson, ["neighborhood", "area"]),
    subdivision: findFact(facts, [/subdivision/i]) ?? structuredString(firecrawlJson, ["subdivision"]),
    region: findFact(facts, [/region/i, /district/i]) ?? structuredString(firecrawlJson, ["region", "district"]),
    municipality: findFact(facts, [/municipality/i]) ?? structuredString(firecrawlJson, ["municipality"]),
    latitude: structuredString(firecrawlJson, ["latitude", "lat"]) ?? searchable.match(/"lat(?:itude)?"\s*:\s*([\-\d.]+)/i)?.[1] ?? null,
    longitude: structuredString(firecrawlJson, ["longitude", "lng", "lon"]) ?? searchable.match(/"l(?:o)?ng(?:itude)?"\s*:\s*([\-\d.]+)/i)?.[1] ?? null,
    year_built: findFact(facts, [/year built/i, /built in/i]) ?? structuredString(firecrawlJson, ["year_built"]),
    strata_fee: findFact(facts, [/strata/i, /maint(enance)? fee/i]) ?? structuredString(firecrawlJson, ["strata_fee", "maintenance_fee"]),
    taxes: findFact(facts, [/tax(es)?/i, /property tax/i]) ?? structuredString(firecrawlJson, ["taxes", "property_taxes"]),
    zoning: findFact(facts, [/zoning/i]) ?? structuredString(firecrawlJson, ["zoning"]),
    parking: findFact(facts, [/parking/i]) ?? structuredString(firecrawlJson, ["parking"]),
    garage: findFact(facts, [/garage/i, /carport/i]) ?? structuredString(firecrawlJson, ["garage", "carport"]),
    property_style: findFact(facts, [/style/i]) ?? structuredString(firecrawlJson, ["property_style", "style"]),
    building_type,
    land_size: findFact(facts, [/land size/i]) ?? structuredString(firecrawlJson, ["land_size"]),
    floor_area: findFact(facts, [/floor area/i]) ?? structuredString(firecrawlJson, ["floor_area"]),
    units: findFact(facts, [/units/i, /number of units/i]) ?? structuredString(firecrawlJson, ["units"]),
    lease_sale_information: findFact(facts, [/lease/i, /sale information/i, /lease\/sale/i]) ?? structuredString(firecrawlJson, ["lease_sale_information", "lease_information"]),
    heating: findFact(facts, [/heating/i]) ?? structuredString(firecrawlJson, ["heating"]),
    cooling: findFact(facts, [/cooling/i, /air conditioning/i]) ?? structuredString(firecrawlJson, ["cooling"]),
    fireplace: findFact(facts, [/fireplace/i]) ?? structuredString(firecrawlJson, ["fireplace"]),
    basement: findFact(facts, [/basement/i]) ?? structuredString(firecrawlJson, ["basement"]),
    view: findFact(facts, [/^view$/i, /views/i]) ?? structuredString(firecrawlJson, ["view"]),
    site_influences: splitList(findFact(facts, [/site influences/i]) ?? structuredString(firecrawlJson, ["site_influences"])),
    nearby_amenities: splitList(findFact(facts, [/nearby amenities/i, /nearby/i]) ?? structuredString(firecrawlJson, ["nearby_amenities"])),
    public_transportation: findFact(facts, [/public transportation/i, /transit/i]) ?? structuredString(firecrawlJson, ["public_transportation", "transit"]),
    interior_features: splitList(findFact(facts, [/interior features/i, /interior/i]) ?? structuredString(firecrawlJson, ["interior_features"])),
    exterior_features: splitList(findFact(facts, [/exterior features/i, /exterior/i]) ?? structuredString(firecrawlJson, ["exterior_features"])),
    amenities: splitList(findFact(facts, [/amenities/i]) ?? structuredString(firecrawlJson, ["amenities"])),
    appliances: splitList(findFact(facts, [/appliances/i]) ?? structuredString(firecrawlJson, ["appliances"])),
    utilities: splitList(findFact(facts, [/utilities/i]) ?? structuredString(firecrawlJson, ["utilities"])),
    feature_list: featureList.filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i),
    raw_facts: facts,
  };

  const metaImages = [...getAllMeta(html, "og:image"), ...getAllMeta(html, "og:image:secure_url"), ...getAllMeta(html, "twitter:image")];
  const candidates = collectImageCandidates(html, sourceUrl, metaImages, firecrawlLinks, structuredImages(firecrawlJson));
  const candidateMap = new Map<string, ImageCandidate>();
  for (const c of candidates) candidateMap.set(`${c.url}|${c.source}|${c.context}`, c);
  const uniqueCandidates = Array.from(candidateMap.values());
  const { kept, rejected } = filterPropertyImages(uniqueCandidates);
  const allImageUrls = Array.from(new Set(uniqueCandidates.map((c) => c.url)));
  const pdfUrl = extractPdf(html, firecrawlLinks, sourceUrl);

  const matched_selectors: Record<string, boolean> = {
    "json-ld": !!ld,
    "firecrawl-json": !!firecrawlJson,
    "title-not-generic": !!title && !isGenericTitle(title),
    "address": !!address,
    "city": !!city,
    "price": !!price,
    "mls-number": !!mls_number,
    "beds": !!beds,
    "baths": !!baths,
    "sqft": !!sqft,
    "description": !!description,
    "key-value-facts": facts.length > 0,
    "gallery-images": kept.length > 0,
    "pdf-link": !!pdfUrl,
  };
  const failed_selectors = Object.entries(matched_selectors).filter(([, v]) => !v).map(([k]) => k);

  if (isGenericTitle(ogTitle ?? titleTag)) warnings.push("Generic Paragon page title ignored.");
  if (!address) warnings.push("Could not detect address.");
  if (!price) warnings.push("Could not detect price.");
  if (kept.length === 0) warnings.push("No property gallery images were detected. Please upload photos manually.");
  if (html.length > 0 && html.length < 5000 && !ld && !firecrawlJson) warnings.push("Page HTML is very small — likely client-side rendered.");

  diagnostics.gallery_images_detected = kept.length > 0;
  diagnostics.page_title = titleTag;
  diagnostics.text_blocks_found = blocks.length;
  diagnostics.key_value_rows_found = facts.length;
  diagnostics.image_urls_found = allImageUrls.length;
  diagnostics.gallery_images_kept = kept.length;
  diagnostics.images_rejected = rejected.length;
  diagnostics.rejected_images = rejected;
  diagnostics.selectors_used = Object.entries(matched_selectors).filter(([, v]) => v).map(([k]) => k);
  diagnostics.selectors_failed = failed_selectors;
  diagnostics.appears_client_side_rendered = diagnostics.rendering_type === "client-side";

  return {
    title,
    address,
    city,
    province,
    postal_code,
    price,
    status,
    category,
    transaction_type,
    property_type,
    beds,
    baths,
    sqft,
    lot_size,
    mls_number,
    description,
    features,
    image_urls: kept,
    rejected_images: rejected,
    all_image_urls: allImageUrls,
    pdf_url: pdfUrl,
    source_url: sourceUrl,
    parse_warnings: warnings,
    diagnostics,
    html_preview: html.slice(0, 3000),
    detected_text_blocks: blocks.slice(0, 60),
    raw_facts: facts,
    matched_selectors,
    failed_selectors,
    markdown_preview: markdown ? markdown.slice(0, 3000) : null,
  };
}

type FirecrawlResult = {
  html: string;
  rawHtml: string;
  markdown: string | null;
  links: string[];
  screenshot: string | null;
  json: any;
  finalUrl: string | null;
};

async function firecrawlScrape(url: string): Promise<FirecrawlResult> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [
        "markdown",
        "html",
        "rawHtml",
        "links",
        "screenshot",
        {
          type: "json",
          prompt:
            "Extract the real estate listing details from this Paragon public listing page. Return only facts found on the page. Include title, address, city, province, postal_code, price, mls_number, status, property_type, transaction_type, category, bedrooms, bathrooms, sqft, lot_size, year_built, strata_fee, taxes, zoning, parking, garage, property_style, building_type, land_size, floor_area, units, lease_sale_information, public_remarks, description, brokerage, listing_agent, co_listing_agent, office_name, neighborhood, subdivision, region, municipality, coordinates, interior_features, exterior_features, amenities, appliances, utilities, heating, cooling, fireplace, basement, view, site_influences, nearby_amenities, public_transportation, pdf_url, raw_facts, and all property gallery photo URLs. Exclude realtor headshots, logos, icons, avatars, map markers, and UI images.",
        },
      ],
      onlyMainContent: false,
      waitFor: 5500,
      timeout: 60000,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${res.status}: ${t.slice(0, 300)}`);
  }
  const json: any = await res.json();
  const d = json?.data ?? json;
  return {
    html: d?.html ?? "",
    rawHtml: d?.rawHtml ?? "",
    markdown: d?.markdown ?? null,
    links: Array.isArray(d?.links) ? d.links : [],
    screenshot: d?.screenshot ?? null,
    json: d?.json ?? null,
    finalUrl: d?.metadata?.sourceURL ?? d?.metadata?.url ?? null,
  };
}

export const paragonParseUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    const url = data.url.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("Invalid URL. Must start with http(s)://");

    const diagnostics: Diagnostics = {
      fetch_success: false,
      html_returned: false,
      html_length: 0,
      page_blocked: false,
      rendering_type: "unknown",
      gallery_images_detected: false,
      firecrawl_used: false,
      firecrawl_error: null,
      plain_fetch_status: null,
      screenshot_url: null,
      final_url: null,
      page_title: null,
      text_blocks_found: 0,
      key_value_rows_found: 0,
      image_urls_found: 0,
      gallery_images_kept: 0,
      images_rejected: 0,
      rejected_images: [],
      selectors_used: [],
      selectors_failed: [],
      appears_client_side_rendered: false,
    };

    let plainHtml = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-CA,en;q=0.9",
        },
        redirect: "follow",
      });
      diagnostics.plain_fetch_status = res.status;
      diagnostics.fetch_success = res.ok;
      diagnostics.final_url = res.url || url;
      if (res.ok) {
        plainHtml = await res.text();
        diagnostics.html_returned = plainHtml.length > 0;
        diagnostics.html_length = plainHtml.length;
      }
      if (res.status === 401 || res.status === 403 || res.status === 429) diagnostics.page_blocked = true;
    } catch (e: any) {
      diagnostics.firecrawl_error = `plain fetch: ${e?.message ?? String(e)}`;
    }

    const plainTitle = compact(plainHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "") || null;
    const plainSignals = [
      /MLS\s*#?/i.test(plainHtml),
      /\$\s?[\d,]{4,}/.test(plainHtml),
      /bed(room)?s?/i.test(plainHtml),
      /bath(room)?s?/i.test(plainHtml),
      /gallery|carousel|property-photo|listing-photo|photo viewer|data-src|srcset/i.test(plainHtml),
    ].filter(Boolean).length;
    const needsRender = plainSignals < 3 || isGenericTitle(plainTitle);
    diagnostics.rendering_type = needsRender ? "client-side" : "server-side";
    diagnostics.appears_client_side_rendered = needsRender;

    let html = plainHtml;
    let markdown: string | null = null;
    let links: string[] = [];
    let structured: any = null;

    if (needsRender || process.env.FIRECRAWL_API_KEY) {
      try {
        const fc = await firecrawlScrape(url);
        diagnostics.firecrawl_used = true;
        const renderedHtml = [fc.html, fc.rawHtml].filter(Boolean).join("\n");
        if (renderedHtml.length > html.length) html = renderedHtml;
        markdown = fc.markdown;
        links = fc.links;
        structured = fc.json;
        diagnostics.html_returned = html.length > 0;
        diagnostics.html_length = html.length;
        diagnostics.screenshot_url = fc.screenshot;
        diagnostics.final_url = fc.finalUrl ?? diagnostics.final_url ?? url;
        const renderedSignals = [/MLS\s*#?/i, /\$\s?[\d,]{4,}/, /bed(room)?s?/i, /gallery|carousel|photo|srcset|data-src/i].filter((r) => r.test(`${html}\n${markdown ?? ""}`)).length;
        if (renderedSignals >= 3) diagnostics.rendering_type = "server-side";
      } catch (e: any) {
        diagnostics.firecrawl_error = e?.message ?? String(e);
      }
    }

    if (!html) throw new Error(`Could not retrieve page content. ${diagnostics.firecrawl_error ?? "Plain fetch failed."}`);
    return parseFromContent(html, markdown, diagnostics.final_url ?? url, diagnostics, links, structured);
  });

type ImportPayload = {
  realtorId: string;
  destination: "active" | "sold" | "commercial";
  paragonUrl: string;
  listing: Partial<Listing>;
  imageUrls: string[];
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function downloadAndStore(sb: ReturnType<typeof getAdminClient>, url: string, basePath: string, index: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 ParagonImportBot/1.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: new URL(url).origin,
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(ct) || /svg|gif|icon/i.test(ct)) return null;
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 12000) return null;
    const path = `${basePath}/${Date.now()}-${index}.${ext}`;
    const { error } = await sb.storage.from("listing-photos").upload(path, buf, { contentType: ct, upsert: true });
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
    const safeImageUrls = data.imageUrls
      .filter((url, index, arr) => /^https?:\/\//i.test(url) && arr.indexOf(url) === index)
      .filter((url) => !rejectReason({ url, source: "save", context: url, score: 20 }))
      .slice(0, 80);

    const baseListing: any = { ...data.listing };
    baseListing.realtor_id = data.realtorId;
    baseListing.listing_type = "paragon";
    baseListing.paragon_url = data.paragonUrl;
    baseListing.primary_image_url = null;

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

    const { data: inserted, error: insertErr } = await sb.from("listings").insert({ ...baseListing, updated_at: new Date().toISOString() }).select("*").single();
    if (insertErr) throw insertErr;

    const listing = inserted as Listing;
    const basePath = `${data.realtorId}/${listing.id}`;
    const storedUrls: string[] = [];
    const failedUrls: string[] = [];

    for (let i = 0; i < safeImageUrls.length; i++) {
      const src = safeImageUrls[i];
      const stored = await downloadAndStore(sb, src, basePath, i);
      if (stored) storedUrls.push(stored);
      else failedUrls.push(src);
    }

    const primary = storedUrls[0] ?? null;
    if (storedUrls.length > 0) {
      const rows = storedUrls.map((u, idx) => ({ listing_id: listing.id, image_url: u, sort_order: idx }));
      await sb.from("listing_photos").insert(rows);
      await sb.from("listings").update({ primary_image_url: primary }).eq("id", listing.id);
    }

    return {
      listing_id: listing.id,
      slug: listing.slug,
      images_stored: storedUrls.length,
      images_failed: failedUrls.length,
      failed_urls: failedUrls,
      primary_image_url: primary,
      warning: storedUrls.length === 0 ? "No property gallery images were detected. Please upload photos manually." : null,
    };
  });
