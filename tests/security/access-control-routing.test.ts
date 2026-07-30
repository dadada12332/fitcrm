import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8")

describe("access-control callback routing", () => {
  it("lets hardware callbacks reach their API-key authentication", () => {
    const middleware = read("src/lib/supabase/middleware.ts")
    const routes = [
      "src/app/api/access-control/[integrationId]/decision/route.ts",
      "src/app/api/access-control/[integrationId]/events/route.ts",
    ]

    expect(middleware).toContain('"/api/access-control"')
    for (const route of routes) {
      const source = read(route)
      expect(source).toContain("authenticateAccessControlIntegration")
      expect(source).toContain("accessControlRequestKey(request)")
      expect(source).toContain("integrationId")
    }
  })
})
