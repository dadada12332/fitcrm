import type { NextRequest } from "next/server"
import {
  authenticateAccessControlIntegration,
  processNormalizedAccessEvent,
} from "@/lib/access-control/service"
import {
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
  if (!allowAccessControlRequest(request, `access-decision:${integrationId}`)) {
    return Response.json({ allowed: false, reasonCode: "rate_limited" }, {
      status: 429,
      headers: { "Retry-After": "60" },
    })
  }
  const integration = await authenticateAccessControlIntegration(integrationId, accessControlRequestKey(request))
  if (!integration) return Response.json({ allowed: false, reasonCode: "unauthorized" }, { status: 401 })

  try {
    const event = await parseNormalizedAccessEvent(request, "access_request")
    const decision = await processNormalizedAccessEvent(integration, event)
    return Response.json({
      allowed: decision.allowed,
      reasonCode: decision.reasonCode,
      reasonMessage: decision.reasonMessage,
    })
  } catch (error) {
    const reasonCode = error instanceof Error ? error.message : "invalid_request"
    return Response.json({ allowed: false, reasonCode }, {
      status: reasonCode === "payload_too_large" ? 413 : 400,
    })
  }
}
