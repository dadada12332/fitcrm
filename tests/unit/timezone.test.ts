import { describe, expect, it } from "vitest"
import { dateKeyInTimeZone, hourInTimeZone, rangeForDateKey, zonedDayRange } from "../../src/lib/timezone"

describe("club timezone helpers", () => {
  it("builds Tashkent calendar-day boundaries in UTC", () => {
    expect(rangeForDateKey("2026-07-27", "Asia/Tashkent")).toEqual({
      from: "2026-07-26T19:00:00.000Z",
      to: "2026-07-27T19:00:00.000Z",
    })
  })

  it("uses the club date and hour instead of server UTC", () => {
    const instant = new Date("2026-07-27T04:15:00.000Z")
    expect(dateKeyInTimeZone(instant, "Asia/Tashkent")).toBe("2026-07-27")
    expect(hourInTimeZone(instant, "Asia/Tashkent")).toBe(9)
    expect(zonedDayRange(instant, "Asia/Tashkent", -1)).toEqual({
      dateKey: "2026-07-26",
      from: "2026-07-25T19:00:00.000Z",
      to: "2026-07-26T19:00:00.000Z",
    })
  })

  it("supports other configured club timezones", () => {
    expect(rangeForDateKey("2026-07-27", "Europe/Moscow")).toEqual({
      from: "2026-07-26T21:00:00.000Z",
      to: "2026-07-27T21:00:00.000Z",
    })
  })
})
