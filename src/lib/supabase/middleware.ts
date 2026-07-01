import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/** Refreshes the Supabase session on every request and enforces route protection. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public paths — everything else requires auth
  const publicPaths = ["/", "/v2", "/v3", "/login", "/register", "/auth", "/api/auth", "/api/telegram"]
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))
    || pathname.startsWith("/_next")
    || /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  const isProtected = !isPublic
  // Auth pages — redirect away if already signed in.
  const isAuthPage = pathname === "/login" || pathname === "/register"

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
