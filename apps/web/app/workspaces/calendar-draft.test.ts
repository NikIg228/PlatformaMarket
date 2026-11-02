import { describe, expect, it } from "vitest";
import { defaultSupplierCalendar } from "@marketplace/schemas";
import { calendarDraft, parseCalendarDraft } from "./calendar-draft";

describe("calendar editor payload", () => {
  it("round trips the default, a break, midnight and a closed exception", () => {
    const value = defaultSupplierCalendar();
    value.week[0]!.intervals = [{ fromMinute: 0, toMinute: 720 }, { fromMinute: 780, toMinute: 1440 }];
    value.exceptions = [{ date: "2026-12-16", intervals: [] }];
    expect(parseCalendarDraft(calendarDraft(value))).toEqual({ success: true, data: value });
  });
  it.each(["", "9:00", "24:01", "10:60", "ab:cd"])("preserves invalid draft %s instead of silently coercing it", time => {
    const draft = calendarDraft(defaultSupplierCalendar());
    draft.week[0]!.intervals[0]!.from = time;
    expect(parseCalendarDraft(draft).success).toBe(false);
    expect(draft.week[0]!.intervals[0]!.from).toBe(time);
  });
  it("rejects overlapping intervals and duplicate dates", () => {
    const draft = calendarDraft(defaultSupplierCalendar());
    draft.week[0]!.intervals.push({ from: "17:00", to: "19:00" });
    expect(parseCalendarDraft(draft).success).toBe(false);
    draft.week[0]!.intervals.pop();
    draft.exceptions = [{ date: "2026-12-16", intervals: [] }, { date: "2026-12-16", intervals: [] }];
    expect(parseCalendarDraft(draft).success).toBe(false);
  });
  it("does not turn holidays into automatic days off", () => {
    expect(parseCalendarDraft(calendarDraft(defaultSupplierCalendar())).data?.exceptions).toEqual([]);
  });
});
