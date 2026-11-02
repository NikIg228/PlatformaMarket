import { supplierCalendarFieldsSchema, type SupplierCalendarFields } from "@marketplace/schemas";

export type IntervalDraft = { from: string; to: string };
export type CalendarDraft = {
  timezone: string;
  week: Array<{ day: number; intervals: IntervalDraft[] }>;
  exceptions: Array<{ date: string; intervals: IntervalDraft[] }>;
};
export function minuteText(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
function minutes(text: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(text)) return -1;
  const [hour, minute] = text.split(":").map(Number);
  return hour! * 60 + minute!;
}
export function calendarDraft(value: SupplierCalendarFields): CalendarDraft {
  const intervals = (rows: SupplierCalendarFields["week"][number]["intervals"]) => rows.map(row => ({ from: minuteText(row.fromMinute), to: minuteText(row.toMinute) }));
  return { timezone: value.timezone, week: value.week.map(row => ({ ...row, intervals: intervals(row.intervals) })),
    exceptions: value.exceptions.map(row => ({ ...row, intervals: intervals(row.intervals) })) };
}
export function parseCalendarDraft(value: CalendarDraft) {
  const intervals = (rows: IntervalDraft[]) => rows.map(row => ({ fromMinute: minutes(row.from), toMinute: minutes(row.to) }));
  return supplierCalendarFieldsSchema.safeParse({ timezone: value.timezone,
    week: value.week.map(row => ({ ...row, intervals: intervals(row.intervals) })),
    exceptions: value.exceptions.map(row => ({ ...row, intervals: intervals(row.intervals) })) });
}
