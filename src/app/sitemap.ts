import type { MetadataRoute } from "next"

const SITE_URL = "https://fitcrm-three.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = ["", "/about", "/contacts", "/docs", "/blog", "/terms", "/privacy"]
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }))
}
