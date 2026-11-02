import type { SupplierCalendarFields } from "@marketplace/schemas";

const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Count elapsed time inside local working intervals, including repeated DST minutes.
 * Date exceptions replace the weekly intervals; holiday labels never enter this calculation. */
export function supplierResponseDeadline(start: Date, calendar: SupplierCalendarFields, workingMinutes = 60): Date {
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(workingMinutes) || workingMinutes < 1 || workingMinutes > 120)
    throw new RangeError("Expected a valid start and 1–120 working minutes");
  const format = new Intl.DateTimeFormat("en-GB", { timeZone: calendar.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const local = (timestamp: number) => {
    const parts = Object.fromEntries(format.formatToParts(timestamp).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, day: weekdays[parts.weekday!]!, minute: Number(parts.hour) * 60 + Number(parts.minute) };
  };
  const week = new Map(calendar.week.map(day => [day.day, day.intervals]));
  const exceptions = new Map(calendar.exceptions.map(day => [day.date, day.intervals]));
  let cursor = start.getTime(), remaining = workingMinutes * 60_000;
  // At least one weekly minute is required by the schema. Each exception can
  // remove at most one working date; include a day for a timezone transition.
  const limit = cursor + (calendar.exceptions.length + workingMinutes * 7 + 2) * 26 * 3600_000;
  while (cursor < limit) {
    const current = local(cursor);
    const intervals = exceptions.get(current.date) ?? week.get(current.day) ?? [];
    if (!intervals.length) {
      // Skip a closed local date without assuming every day is 24 hours long.
      let low = cursor, high = cursor + 26 * 3600_000;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (local(middle).date === current.date) low = middle; else high = middle;
      }
      cursor = high;
      continue;
    }
    const next = Math.floor(cursor / 60_000) * 60_000 + 60_000;
    if (intervals.some(interval => current.minute >= interval.fromMinute && current.minute < interval.toMinute)) {
      const elapsed = next - cursor;
      if (remaining <= elapsed) return new Date(cursor + remaining);
      remaining -= elapsed;
    }
    cursor = next;
  }
  throw new RangeError("Calendar has no reachable response deadline");
}
