import { NextResponse } from "next/server"
import { cookies } from "next/headers"

/** Called by the accept-invite page client-side to remember which invite the user is viewing.
 *  This lets the app layout redirect them back here if they log in / register and land at /dashboard. */
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({ token: null }))
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const cookieStore = await cookies()
    cookieStore.set("pending_invite", token, { path: "/", maxAge: 60 * 60 * 24, httpOnly: true, sameSite: "lax" })
  }
  return NextResponse.json({ ok: true })
}
