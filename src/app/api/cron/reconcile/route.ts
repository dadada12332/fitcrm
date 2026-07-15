import { createServiceClient } from "@/lib/supabase/service"
import { fetchStatement } from "@/lib/acquiring/fetchers"
import { ingestTransactions, runMatching } from "@/lib/reconcile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Сверка эквайринга: раз в сутки тянем выписку у подключённых клубов и пересопоставляем.
// vercel.json: { "path": "/api/cron/reconcile", "schedule": "0 2 * * *" }  (02:00 UTC = 07:00 Tashkent)
export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const s = createServiceClient()
  const { data: creds } = await s.from("club_payment_credentials")
    .select("club_id, provider").eq("enabled", true)
  if (!creds?.length) return Response.json({ ok: true, clubs: 0, ingested: 0 })

  const to = new Date()
  const from = new Date(to.getTime() - 2 * 86_400_000) // с запасом за 2 суток
  let ingested = 0
  const clubs = new Set<string>()

  for (const c of creds) {
    const provider = c.provider as "click" | "payme"
    if (provider !== "click" && provider !== "payme") continue
    try {
      const rows = await fetchStatement(c.club_id, provider, from, to)
      ingested += await ingestTransactions(c.club_id, provider, rows)
      clubs.add(c.club_id)
    } catch { /* один провайдер не должен ронять весь прогон */ }
  }
  for (const clubId of clubs) {
    try { await runMatching(clubId) } catch { /* skip */ }
  }

  return Response.json({ ok: true, clubs: clubs.size, ingested })
}
