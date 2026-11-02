import { describe, expect, it } from "vitest";
import { defaultSupplierCalendar, type SupplierCalendarFields } from "@marketplace/schemas";
import { supplierResponseDeadline } from "./supplier-calendar-rules";

function deadline(start: string, calendar = defaultSupplierCalendar(), minutes = 60) {
  return supplierResponseDeadline(new Date(start), calendar, minutes).toISOString();
}
describe("supplier response working calendar", () => {
  it("uses Kazakhstan local time and preserves fractional minutes", () => {
    expect(deadline("2026-11-02T04:00:30.123Z")).toBe("2026-11-02T05:00:30.123Z");
    expect(deadline("2026-11-02T03:00:00Z")).toBe("2026-11-02T05:00:00.000Z");
  });
  it("carries the remainder over a break and weekend", () => {
    const calendar = defaultSupplierCalendar();
    calendar.week[0]!.intervals = [{ fromMinute: 540, toMinute: 780 }, { fromMinute: 840, toMinute: 1080 }];
    expect(deadline("2026-11-02T07:30:00Z", calendar)).toBe("2026-11-02T09:30:00.000Z");
    expect(deadline("2026-11-06T12:30:00Z")).toBe("2026-11-09T04:30:00.000Z");
    expect(deadline("2026-11-06T13:00:00Z")).toBe("2026-11-09T05:00:00.000Z");
  });
  it("replaces an entire date, including midnight portions of an overnight schedule", () => {
    const calendar = defaultSupplierCalendar();
    calendar.week[0]!.intervals = [{ fromMinute: 1320, toMinute: 1440 }];
    calendar.week[1]!.intervals = [{ fromMinute: 0, toMinute: 120 }];
    expect(deadline("2026-11-02T18:30:00Z", calendar)).toBe("2026-11-02T19:30:00.000Z");
    calendar.exceptions = [{ date: "2026-11-03", intervals: [] }];
    expect(deadline("2026-11-02T18:30:00Z", calendar)).toBe("2026-11-04T04:30:00.000Z");
  });
  it("allows an exceptional working weekend and does not close a holiday automatically", () => {
    const calendar = defaultSupplierCalendar();
    calendar.exceptions = [{ date: "2026-11-07", intervals: [{ fromMinute: 600, toMinute: 720 }] }];
    expect(deadline("2026-11-07T04:00:00Z", calendar)).toBe("2026-11-07T06:00:00.000Z");
    expect(deadline("2026-12-16T04:00:00Z")).toBe("2026-12-16T05:00:00.000Z");
  });
  it("counts real minutes across daylight saving gaps and repeated hours", () => {
    const calendar: SupplierCalendarFields = { ...defaultSupplierCalendar(), timezone: "Europe/Berlin" };
    calendar.week[6]!.intervals = [{ fromMinute: 60, toMinute: 240 }];
    expect(deadline("2026-03-29T00:30:00Z", calendar)).toBe("2026-03-29T01:30:00.000Z");
    expect(deadline("2026-10-25T00:30:00Z", calendar)).toBe("2026-10-25T01:30:00.000Z");
  });
  it("does not mutate a stored snapshot when settings are later changed", () => {
    const calendar = defaultSupplierCalendar(), snapshot = structuredClone(calendar);
    const saved = deadline("2026-11-02T04:00:00Z", snapshot);
    calendar.week[0]!.intervals = [];
    expect(deadline("2026-11-02T04:00:00Z", snapshot)).toBe(saved);
    expect(deadline("2026-11-02T04:00:00Z", calendar)).not.toBe(saved);
  });
  it("handles long dated closures and bounds invalid calculation requests", () => {
    const calendar = defaultSupplierCalendar();
    calendar.exceptions = Array.from({ length: 30 }, (_, index) => ({ date: new Date(Date.UTC(2026, 10, 2 + index)).toISOString().slice(0, 10), intervals: [] }));
    expect(deadline("2026-11-02T04:00:00Z", calendar)).toBe("2026-12-02T05:00:00.000Z");
    expect(() => deadline("invalid")).toThrow(RangeError);
    expect(() => deadline("2026-11-02T04:00:00Z", calendar, 121)).toThrow(RangeError);
  });
});
