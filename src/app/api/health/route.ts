import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

export async function GET() {
  const startedAt = performance.now()

  try {
    const { error } = await createServiceClient()
      .from("clubs")
      .select("id")
      .limit(1)

    if (error) throw error

    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        latencyMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "health_check_failed",
      message: error instanceof Error ? error.message : "Unknown health check error",
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json(
      { status: "degraded", database: "unreachable", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
