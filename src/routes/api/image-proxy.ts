import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const u = new URL(request.url);
  const target = u.searchParams.get("url");
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response("Bad target", { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlulumaImporter/1.0)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        Referer: parsed.origin + "/",
      },
      redirect: "follow",
    });
    if (!res.ok || !res.body) {
      return new Response(`Upstream ${res.status}`, { status: res.status || 502 });
    }
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(ct)) return new Response("Not an image", { status: 415 });
    const headers = new Headers({
      "Content-Type": ct,
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    });
    const len = res.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    return new Response(res.body, { status: 200, headers });
  } catch (e: any) {
    return new Response(`Proxy error: ${e?.message ?? "unknown"}`, { status: 502 });
  }
}

export const Route = createFileRoute("/api/image-proxy")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
