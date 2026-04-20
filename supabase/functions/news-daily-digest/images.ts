// Plan A → B → C bildehenting + mirror til Supabase Storage
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const UA = "Mozilla/5.0 (compatible; STACQ-Daily/1.0; +https://crm.stacq.no)";
const TIMEOUT_MS = 5000;

export type ImageSource = "og" | "company_logo" | "placeholder";

export interface ResolvedImage {
  url: string | null;
  source: ImageSource;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export interface PageMeta {
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
}

export async function extractPageMeta(pageUrl: string): Promise<PageMeta> {
  try {
    const res = await fetchWithTimeout(pageUrl);
    if (!res.ok) return { ogImage: null, ogTitle: null, ogDescription: null };
    const html = (await res.text()).slice(0, 200_000); // første 200KB holder for <head>

    const imgMatch =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    let imgUrl = imgMatch ? imgMatch[1] : null;
    if (imgUrl) {
      if (imgUrl.startsWith("//")) imgUrl = `https:${imgUrl}`;
      if (imgUrl.startsWith("/")) {
        const base = new URL(pageUrl);
        imgUrl = `${base.origin}${imgUrl}`;
      }
    }

    const titleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;

    const descMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
    const ogDescription = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : null;

    return { ogImage: imgUrl, ogTitle, ogDescription };
  } catch {
    return { ogImage: null, ogTitle: null, ogDescription: null };
  }
}

// Bevart for bakoverkompatibilitet
export async function extractOgImage(pageUrl: string): Promise<string | null> {
  return (await extractPageMeta(pageUrl)).ogImage;
}

export function placeholderSvg(label: string): { bytes: Uint8Array; ext: string; contentType: string } {
  const safe = label.replace(/[<>&]/g, "").slice(0, 40);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#FCFCFD"/>
  <rect x="0.5" y="0.5" width="1199" height="674" fill="none" stroke="#E8EAEE"/>
  <text x="600" y="345" text-anchor="middle" font-family="Inter, sans-serif" font-size="42" font-weight="600" fill="#1A1C1F">${safe}</text>
  <text x="600" y="395" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#8C929C" letter-spacing="2">STACQ DAILY</text>
</svg>`;
  return { bytes: new TextEncoder().encode(svg), ext: "svg", contentType: "image/svg+xml" };
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 2000) return null; // for liten
    return { bytes: buf, contentType: ct };
  } catch {
    return null;
  }
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

interface MirrorOptions {
  supabase: ReturnType<typeof createClient>;
  itemId: string;
  date: string; // YYYY-MM-DD
  pageUrl: string;
  companyWebsite: string | null;
  companyName: string;
}

export interface ResolvedImageWithMeta extends ResolvedImage {
  ogTitle: string | null;
  ogDescription: string | null;
}

export async function resolveAndMirrorImage(opts: MirrorOptions): Promise<ResolvedImageWithMeta> {
  const { supabase, itemId, date, pageUrl, companyWebsite, companyName } = opts;

  // Plan A: hent OG-meta (image + title + description) fra artikkel i ÉN HTTP-runde
  const meta = await extractPageMeta(pageUrl);
  let imgUrl = meta.ogImage;
  let source: ImageSource = "og";

  let downloaded = imgUrl ? await downloadImage(imgUrl) : null;

  // Plan B: OG / favicon fra selskapets nettside
  if (!downloaded && companyWebsite) {
    const siteUrl = companyWebsite.startsWith("http") ? companyWebsite : `https://${companyWebsite}`;
    const siteMeta = await extractPageMeta(siteUrl);
    if (siteMeta.ogImage) {
      downloaded = await downloadImage(siteMeta.ogImage);
      source = "company_logo";
    }
  }

  // Plan C: SVG-fallback
  if (!downloaded) {
    const svg = placeholderSvg(companyName);
    downloaded = { bytes: svg.bytes, contentType: svg.contentType };
    source = "placeholder";
  }

  const ext = extForContentType(downloaded.contentType);
  const path = `news/${date}/${itemId}.${ext}`;

  const { error } = await supabase.storage
    .from("news-images")
    .upload(path, downloaded.bytes, {
      contentType: downloaded.contentType,
      upsert: true,
    });

  if (error) {
    console.error(`[images] upload failed for ${path}:`, error.message);
    return { url: null, source: "placeholder", ogTitle: meta.ogTitle, ogDescription: meta.ogDescription };
  }

  const { data: pub } = supabase.storage.from("news-images").getPublicUrl(path);
  return { url: pub.publicUrl, source, ogTitle: meta.ogTitle, ogDescription: meta.ogDescription };
}
