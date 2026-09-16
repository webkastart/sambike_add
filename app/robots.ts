import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL?.trim();
  let origin: URL | null = null;
  try { if (base) origin = new URL(base); } catch { origin = null; }
  return {
    rules: { userAgent: "*", allow: ["/kampan/", "/ochrana-osobnych-udajov"], disallow: ["/admin/", "/prihlasenie", "/api/", "/*?preview="] },
    ...(origin ? { sitemap: new URL("/sitemap.xml", origin).toString(), host: origin.origin } : {}),
  };
}
