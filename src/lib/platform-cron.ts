import { createServiceClient } from "@/lib/supabase/service"

export async function startPlatformCron(jobKey: string) {
  const db = createServiceClient()
  const started = Date.now()
  const { data } = await db.from("platform_cron_runs")
    .insert({ job_key: jobKey, status: "running" })
    .select("id").maybeSingle()

  return async (status: "success" | "failed", result: Record<string, unknown> = {}, error?: unknown) => {
    if (!data?.id) return
    await db.from("platform_cron_runs").update({
      status,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      result,
      error_message: error instanceof Error ? error.message.slice(0, 1000) : error ? String(error).slice(0, 1000) : null,
    }).eq("id", data.id)
  }
}

export async function withPlatformCronRun(jobKey: string, handler: () => Promise<Response>): Promise<Response> {
  const finish = await startPlatformCron(jobKey)
  try {
    const response = await handler()
    await finish(response.ok ? "success" : "failed", { httpStatus: response.status })
    return response
  } catch (error) {
    await finish("failed", {}, error)
    throw error
  }
}
