import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Route protection + domain routing.
 *
 * Два домена, одна кодовая база:
 *   app.fitcrm.uz   → CRM клуба (обычные роуты)
 *   admin.fitcrm.uz → Platform Admin (внутренние роуты /platform/*)
 *
 * На admin-хосте пути переписываются: admin.fitcrm.uz/clubs → /platform/clubs,
 * чтобы префикс /platform не светился в URL. Локально (localhost) Platform
 * доступен напрямую по /platform/*.
 */
export async function updateSession(request: NextRequest) {
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            cookiesToSet.push({ name, value, options: (options ?? {}) as Record<string, unknown> })
          })
        },
      },
    },
  )

  // getSession() — локальный декод JWT из куки (без сети): быстро и надёжно под
  // нагрузкой prefetch. getUser() делал сетевой вызов на каждый запрос и под
  // всплеском параллельных навигаций иногда падал → ложный редирект на логин.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const finalize = (res: NextResponse) => {
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
    return res
  }

  const host = request.headers.get("host") ?? ""
  const isAdminHost = host.startsWith("admin.")
  const { pathname } = request.nextUrl

  // Скоуп Platform: admin-хост ИЛИ прямой путь /platform (на любом домене).
  // На admin-хосте URL чистые (rewrite), иначе — по прямому пути /platform/*.
  const platformScope = isAdminHost || pathname === "/platform" || pathname.startsWith("/platform/")

  if (platformScope) {
    // Внутренний путь под /platform.
    const innerPath = isAdminHost
      ? (pathname === "/" ? "/platform" : `/platform${pathname}`)
      : pathname

    const isLoginPage = innerPath === "/platform/login"
    const isPublic = isLoginPage || innerPath.startsWith("/platform/api")

    if (!user && !isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = isAdminHost ? "/login" : "/platform/login"
      return finalize(NextResponse.redirect(url))
    }
    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = isAdminHost ? "/" : "/platform"
      return finalize(NextResponse.redirect(url))
    }

    if (isAdminHost) {
      const url = request.nextUrl.clone()
      url.pathname = innerPath
      return finalize(NextResponse.rewrite(url))
    }
    return finalize(NextResponse.next({ request }))
  }

  // На обычном (app) хосте /platform всё равно доступен по прямому пути
  // (защищён проверкой platform_role в layout). Чистые URL — только на admin-хосте.
  // Когда admin.fitcrm.uz будет настроен, здесь можно включить редирект на CRM.

  // ── Обычная CRM клуба ──
  const publicPaths = ["/", "/about", "/contacts", "/docs", "/blog", "/terms", "/privacy", "/robots.txt", "/sitemap.xml", "/login", "/register", "/forgot-password", "/reset-password", "/auth", "/api/auth", "/api/telegram", "/api/invite-track", "/api/pay", "/api/cron", "/api/broadcasts", "/accept-invite"]
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))
    || pathname.startsWith("/_next")
    || /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|json)$/.test(pathname)
  const isProtected = !isPublic
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password"

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return finalize(NextResponse.redirect(url))
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return finalize(NextResponse.redirect(url))
  }

  return finalize(NextResponse.next({ request }))
}
