import { timingSafeEqual } from "node:crypto"
import { retryPendingClientMessages } from "@/lib/client-inbox"

export const dynamic = "force-dynamic"

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
  if (!secret || !received) return false
  const expectedBuffer = Buffer.from(secret)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const result = await retryPendingClientMessages(50)
  return Response.json(result, { headers: { "Cache-Control": "no-store" } })
}

