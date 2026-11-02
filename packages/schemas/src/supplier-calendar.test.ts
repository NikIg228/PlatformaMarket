import { describe, expect, it } from "vitest";
import { defaultSupplierCalendar, saveSupplierCalendarSchema, supplierCalendarFieldsSchema } from "./supplier-calendar";

describe("supplier calendar contract", () => {
  it("provides the owner-selected fallback and independent values", () => {
    const first = defaultSupplierCalendar(); first.week[0]!.intervals.length = 0;
    expect(defaultSupplierCalendar().week[0]!.intervals).toEqual([{ fromMinute: 540, toMinute: 1080 }]);
    expect(supplierCalendarFieldsSchema.parse(defaultSupplierCalendar()).timezone).toBe("Asia/Almaty");
  });
  it("accepts breaks, midnight boundaries and a closed exception", () => {
    const calendar = defaultSupplierCalendar();
    calendar.week[0]!.intervals = [{ fromMinute: 0, toMinute: 120 }, { fromMinute: 1320, toMinute: 1440 }];
    calendar.exceptions = [{ date: "2028-02-29", intervals: [] }];
    expect(supplierCalendarFieldsSchema.safeParse(calendar).success).toBe(true);
  });
  it.each([
    { fromMinute: 600, toMinute: 600 }, { fromMinute: 1320, toMinute: 120 },
    { fromMinute: -1, toMinute: 60 }, { fromMinute: 0, toMinute: 1441 },
  ])("rejects invalid interval %j", interval => {
    const calendar = defaultSupplierCalendar(); calendar.week[0]!.intervals = [interval];
    expect(supplierCalendarFieldsSchema.safeParse(calendar).success).toBe(false);
  });
  it("rejects overlap, duplicate weekdays/dates, nonexistent dates and unknown zones", () => {
    const calendar = defaultSupplierCalendar();
    for (const override of [
      { timezone: "unknown/zone" }, { week: calendar.week.map(day => ({ ...day, day: 1 })) },
      { week: calendar.week.map(day => ({ ...day, intervals: [] })) },
      { exceptions: [{ date: "2027-02-29", intervals: [] }] },
      { exceptions: [{ date: "2026-11-02", intervals: [] }, { date: "2026-11-02", intervals: [] }] },
      { exceptions: [{ date: "2026-11-02", intervals: [{ fromMinute: 10, toMinute: 30 }, { fromMinute: 20, toMinute: 40 }] }] },
    ]) expect(supplierCalendarFieldsSchema.safeParse({ ...calendar, ...override }).success).toBe(false);
  });
  it("requires a version and replay key for save and rejects extra fields", () => {
    const fields = defaultSupplierCalendar();
    expect(saveSupplierCalendarSchema.safeParse(fields).success).toBe(false);
    expect(saveSupplierCalendarSchema.safeParse({ ...fields, expectedVersion: 0, idempotencyKey: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(supplierCalendarFieldsSchema.safeParse({ ...fields, organizationId: "forged" }).success).toBe(false);
  });
});
