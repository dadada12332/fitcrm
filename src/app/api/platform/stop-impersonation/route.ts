import { NextResponse, type NextRequest } from "next/server"

function cookieDomain(host: string): string | undefined {
  const h = host.split(":")[0]
  if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return undefined
  if (h.endsWith(".vercel.app")) return undefined
  const parts = h.split(".")
  if (parts.length >= 2) return "." + parts.slice(-2).join(".")
  return undefined
}

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? ""
  const domain = cookieDomain(host)

  // Куда вернуться в Platform.
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL
    || (domain ? `https://admin${domain}` : "/platform")

  const res = NextResponse.redirect(adminUrl.startsWith("http") ? adminUrl : new URL(adminUrl, request.url))
  const opts = { path: "/", domain }
  res.cookies.set("pa_impersonate", "", { ...opts, maxAge: 0 })
  res.cookies.set("selected_club_id", "", { ...opts, maxAge: 0 })
  return res
}
