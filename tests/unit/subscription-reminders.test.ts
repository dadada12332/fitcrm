import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildSubscriptionReminderIdempotencyKey,
  canReclaimSubscriptionReminder,
  renderSubscriptionReminder,
  resolveReminderClubSubscription,
  resolveSubscriptionReminderMilestone,
  safeSubscriptionTimeZone,
  subscriptionReminderLeaseCutoff,
} from "../../src/app/api/cron/subscription-reminders/helpers"

const originalCronSecret = process.env.CRON_SECRET

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}))
vi.mock("@/lib/platform-cron", () => ({
  withPlatformCronRun: vi.fn(),
}))

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalCronSecret
})

describe("platform subscription reminder milestones", () => {
  const now = new Date("2026-08-04T00:30:00.000Z")

  it.each([
    ["2026-08-11T10:00:00.000Z", 7],
    ["2026-08-07T10:00:00.000Z", 3],
    ["2026-08-05T10:00:00.000Z", 1],
    ["2026-08-04T10:00:00.000Z", 0],
    ["2026-08-03T10:00:00.000Z", "overdue"],
  ])("maps %s to the %s milestone in the club timezone", (expiresAt, expected) => {
    expect(resolveSubscriptionReminderMilestone(expiresAt, now, "Asia/Tashkent")).toBe(expected)
  })

  it("does not notify between configured milestones", () => {
    expect(resolveSubscriptionReminderMilestone("2026-08-09T10:00:00.000Z", now, "Asia/Tashkent"))
      .toBeNull()
  })

  it("falls back to Tashkent for an invalid club timezone", () => {
    expect(safeSubscriptionTimeZone("Not/A_Timezone")).toBe("Asia/Tashkent")
  })

  it("keys each recipient and milestone to the normalized expiry", () => {
    expect(buildSubscriptionReminderIdempotencyKey("2026-08-11T10:00:00+00:00", 7, 12345))
      .toBe("platform_subscription:2026-08-11T10:00:00.000Z:7:12345")
  })
})

describe("subscription reminder plan identity", () => {
  it("uses the authoritative related custom paid plan instead of the legacy trial enum", () => {
    expect(resolveReminderClubSubscription({
      legacyPlan: "trial",
      trialExpiresAt: "2026-01-01T00:00:00.000Z",
      planExpiresAt: "2026-09-01T00:00:00.000Z",
      relatedPlan: { code: "custom_pro", is_trial: false },
    })).toEqual({
      plan: "custom_pro",
      isTrial: false,
      expiresAt: "2026-09-01T00:00:00.000Z",
    })
  })
})

describe("subscription reminder localization", () => {
  const base = {
    clubName: "Atlas",
    expiresAt: "2026-08-11T10:00:00.000Z",
    timeZone: "Asia/Tashkent",
    pendingRequest: false,
    now: new Date("2026-08-04T00:30:00.000Z"),
  }

  it.each([
    [7, "7 дней"],
    [3, "3 дня"],
    [1, "1 день"],
  ] as const)("uses the correct Russian form for %i days", (milestone, expected) => {
    const reminder = renderSubscriptionReminder({ ...base, milestone, locale: "ru" })
    expect(reminder.message).toContain(expected)
    expect(reminder.cta).toBe("Продлить подписку")
  })

  it("renders the pending status and CTA in English", () => {
    const reminder = renderSubscriptionReminder({
      ...base,
      milestone: 3,
      locale: "en",
      pendingRequest: true,
    })
    expect(reminder.message).toContain("already being processed")
    expect(reminder.message).toContain("expires in 3 days")
    expect(reminder.cta).toBe("Request status")
  })

  it("renders expiry copy and CTA in Uzbek", () => {
    const reminder = renderSubscriptionReminder({
      ...base,
      milestone: "overdue",
      locale: "uz",
    })
    expect(reminder.message).toContain("obunasi")
    expect(reminder.message).toContain("tugagan")
    expect(reminder.cta).toBe("Obunani uzaytirish")
  })

  it("falls back to Russian for an unsupported communication language", () => {
    const reminder = renderSubscriptionReminder({ ...base, milestone: 1, locale: "de" })
    expect(reminder.locale).toBe("ru")
    expect(reminder.message).toContain("1 день")
  })
})

describe("subscription reminder processing lease", () => {
  const now = new Date("2026-08-04T12:00:00.000Z")

  it("keeps a normal retry inside the lease idempotent", () => {
    expect(canReclaimSubscriptionReminder("processing", "2026-08-04T11:50:00.000Z", now)).toBe(false)
    expect(canReclaimSubscriptionReminder("sent", "2026-08-04T01:00:00.000Z", now)).toBe(false)
  })

  it("allows stale processing and failed events to be reclaimed", () => {
    expect(canReclaimSubscriptionReminder("processing", "2026-08-04T11:44:59.999Z", now)).toBe(true)
    expect(canReclaimSubscriptionReminder("failed", "2026-08-04T11:59:59.000Z", now)).toBe(true)
    expect(subscriptionReminderLeaseCutoff(now)).toBe("2026-08-04T11:45:00.000Z")
  })

  it("does not reclaim processing with an invalid timestamp", () => {
    expect(canReclaimSubscriptionReminder("processing", "invalid", now)).toBe(false)
  })

  it("atomically reclaims only processing rows older than the cutoff", async () => {
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "event-1",
          status: "processing",
          created_at: "2026-08-04T11:44:59.999Z",
        },
        error: null,
      }),
    }
    existingQuery.select.mockReturnValue(existingQuery)
    existingQuery.eq.mockReturnValue(existingQuery)

    const reclaimQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      lt: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "event-1" }, error: null }),
    }
    reclaimQuery.update.mockReturnValue(reclaimQuery)
    reclaimQuery.eq.mockReturnValue(reclaimQuery)
    reclaimQuery.lt.mockReturnValue(reclaimQuery)
    reclaimQuery.select.mockReturnValue(reclaimQuery)

    const db = {
      from: vi.fn()
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(reclaimQuery),
    }
    const { claimReminderEvent } = await import(
      "../../src/app/api/cron/subscription-reminders/route"
    )
    const eventId = await claimReminderEvent({
      db: db as unknown as Parameters<typeof claimReminderEvent>[0]["db"],
      clubId: "club-1",
      telegramId: 123,
      idempotencyKey: "key-1",
      metadata: {},
      now,
    })

    expect(eventId).toBe("event-1")
    expect(reclaimQuery.update).toHaveBeenCalledWith({
      status: "processing",
      error_message: null,
      created_at: "2026-08-04T12:00:00.000Z",
    })
    expect(reclaimQuery.lt).toHaveBeenCalledWith("created_at", "2026-08-04T11:45:00.000Z")
  })

  it("does not issue an update for a processing row inside the lease", async () => {
    const existingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "event-1",
          status: "processing",
          created_at: "2026-08-04T11:50:00.000Z",
        },
        error: null,
      }),
    }
    existingQuery.select.mockReturnValue(existingQuery)
    existingQuery.eq.mockReturnValue(existingQuery)
    const db = { from: vi.fn().mockReturnValue(existingQuery) }
    const { claimReminderEvent } = await import(
      "../../src/app/api/cron/subscription-reminders/route"
    )

    await expect(claimReminderEvent({
      db: db as unknown as Parameters<typeof claimReminderEvent>[0]["db"],
      clubId: "club-1",
      telegramId: 123,
      idempotencyKey: "key-1",
      metadata: {},
      now,
    })).resolves.toBeNull()
    expect(db.from).toHaveBeenCalledTimes(1)
  })
})

describe("subscription reminder cron authorization", () => {
  it("rejects an unauthorized request before any service-role work", async () => {
    process.env.CRON_SECRET = "expected-secret"
    const { GET } = await import("../../src/app/api/cron/subscription-reminders/route")

    const response = await GET(new Request("https://example.test/api/cron/subscription-reminders", {
      headers: { Authorization: "Bearer wrong-secret" },
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })
})
