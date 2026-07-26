type ZonedDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  }
}

function zonedDateTimeToUtc(parts: ZonedDateParts, timeZone: string): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  let utc = target

  // Intl exposes the wall-clock time, so converge on the UTC instant that renders
  // as that same wall-clock time in the club timezone. Two passes cover DST jumps.
  for (let index = 0; index < 3; index += 1) {
    const rendered = zonedParts(new Date(utc), timeZone)
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    )
    utc += target - renderedAsUtc
  }

  return new Date(utc)
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone)
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-")
}

export function hourInTimeZone(date: Date, timeZone: string): number {
  return zonedParts(date, timeZone).hour
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10)
}

export function rangeForDateKey(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const nextKey = shiftDateKey(dateKey, 1)
  const [nextYear, nextMonth, nextDay] = nextKey.split("-").map(Number)

  return {
    from: zonedDateTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone).toISOString(),
    to: zonedDateTimeToUtc({
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      hour: 0,
      minute: 0,
      second: 0,
    }, timeZone).toISOString(),
  }
}

export function zonedDayRange(date: Date, timeZone: string, offsetDays = 0) {
  const dateKey = shiftDateKey(dateKeyInTimeZone(date, timeZone), offsetDays)
  return { dateKey, ...rangeForDateKey(dateKey, timeZone) }
}
