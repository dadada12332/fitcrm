import { describe, expect, it } from "vitest"
import {
  dateKeyInTimeZone,
  dateTimeLocalToUtcIso,
  dateTimeLocalValueInTimeZone,
  hourInTimeZone,
  rangeForDateKey,
  zonedDayRange,
} from "../../src/lib/timezone"

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

  it("round-trips datetime-local values in the club timezone", () => {
    const instant = new Date("2026-08-05T09:30:00.000Z")
    expect(dateTimeLocalValueInTimeZone(instant, "Asia/Tashkent")).toBe("2026-08-05T14:30")
    expect(dateTimeLocalToUtcIso("2026-08-05T14:30", "Asia/Tashkent")).toBe(instant.toISOString())
  })

  it("rejects invalid wall-clock values", () => {
    expect(dateTimeLocalToUtcIso("2026-02-30T10:00", "Asia/Tashkent")).toBeNull()
    expect(dateTimeLocalToUtcIso("not-a-date", "Asia/Tashkent")).toBeNull()
  })
})
