import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST only — иначе Next.js префетчит GET-ссылку logout и разлогинивает
// пользователя сразу после входа.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const host = request.headers.get("host") ?? ""
  const isAdminHost = host.startsWith("admin.")
  const url = request.nextUrl.clone()
  url.pathname = isAdminHost ? "/login" : "/platform/login"
  url.search = ""
  return NextResponse.redirect(url, { status: 303 })
}
