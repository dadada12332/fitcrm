import type { NextRequest } from "next/server"
import {
  authenticateAccessControlIntegration,
  processNormalizedAccessEvent,
} from "@/lib/access-control/service"
import {
  accessControlErrorResponse,
  accessControlRequestKey,
  parseNormalizedAccessEvent,
} from "@/lib/access-control/http"
import { allowAccessControlRequest } from "@/lib/access-control/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await context.params
  if (!allowAccessControlRequest(request, `access-events:${integrationId}`)) {
    return Response.json({ ok: false, error: "rate_limited" }, {
      status: 429,
      headers: { "Retry-After": "60" },
    })
  }
  const integration = await authenticateAccessControlIntegration(integrationId, accessControlRequestKey(request))
  if (!integration) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })

  try {
    const event = await parseNormalizedAccessEvent(request)
    const decision = await processNormalizedAccessEvent(integration, event)
    return Response.json({
      ok: true,
      allowed: decision.allowed,
      reasonCode: decision.reasonCode,
      duplicate: decision.duplicate === true,
    })
  } catch (error) {
    return accessControlErrorResponse(error)
  }
}
