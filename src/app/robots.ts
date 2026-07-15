import type { MetadataRoute } from "next"

const SITE_URL = "https://fitcrm-three.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Закрываем от индексации приватные и служебные разделы
        disallow: ["/app", "/dashboard", "/platform", "/login", "/register", "/api", "/accept-invite"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
