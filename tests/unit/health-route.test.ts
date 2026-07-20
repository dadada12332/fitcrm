import { describe, expect, it, vi } from "vitest"

const select = vi.fn()
const from = vi.fn(() => ({ select }))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from }),
}))

describe("health route", () => {
  it("returns an operational response when the database is reachable", async () => {
    select.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ error: null }),
    })
    const { GET } = await import("../../src/app/api/health/route")

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("ok")
    expect(body.database).toBe("reachable")
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("returns 503 without leaking the database error", async () => {
    select.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ error: new Error("secret connection details") }),
    })
    const { GET } = await import("../../src/app/api/health/route")

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual(expect.objectContaining({ status: "degraded", database: "unreachable" }))
    expect(JSON.stringify(body)).not.toContain("secret connection details")
  })
})
