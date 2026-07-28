import { createServiceClient } from "@/lib/supabase/service"
import { withPlatformCronRun } from "@/lib/platform-cron"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return withPlatformCronRun("platform_metrics", async () => {
    const db = createServiceClient()
    const { data, error } = await db.rpc("platform_capture_daily_metrics", {
      p_date: new Date().toISOString().slice(0, 10),
    })
    if (error) return Response.json({ error: "Snapshot failed" }, { status: 500 })
    return Response.json({ ok: true, metric: data })
  })
}
