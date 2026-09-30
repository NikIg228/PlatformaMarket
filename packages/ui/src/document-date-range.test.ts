import { describe, expect, it } from "vitest";
import { documentArchiveDateRange } from "./document-date-range";

describe("document business-calendar boundaries", () => {
  it("includes the complete Kazakhstan day using the inclusive API", () => {
    expect(documentArchiveDateRange("2026-09-30", "2026-09-30")).toEqual({ dateFrom: "2026-09-29T19:00:00.000Z", dateTo: "2026-09-30T18:59:59.999Z" });
  });
  it.each(["2026-01-01", "2026-12-31", "2024-02-29"])("round trips day boundaries across month/year/offset changes: %s", day => {
    const range = documentArchiveDateRange(day, day);
    const format = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" });
    expect(format.format(new Date(range.dateFrom!))).toBe(day);
    expect(format.format(new Date(range.dateTo!))).toBe(day);
    expect(format.format(new Date(Date.parse(range.dateFrom!) - 1))).not.toBe(day);
    expect(format.format(new Date(Date.parse(range.dateTo!) + 1))).not.toBe(day);
  });
  it("supports empty and one-sided ranges", () => {
    expect(documentArchiveDateRange("", "")).toEqual({ dateFrom: undefined, dateTo: undefined });
    expect(documentArchiveDateRange("2026-01-01", "").dateTo).toBeUndefined();
    expect(documentArchiveDateRange("", "2026-12-31").dateFrom).toBeUndefined();
  });
  it("rejects invalid or reversed dates before applying the filter", () => {
    expect(() => documentArchiveDateRange("2026-02-30", "")).toThrow("корректные");
    expect(() => documentArchiveDateRange("2026-10-01", "2026-09-30")).toThrow("позже");
  });
  it("uses the specified business zone, independently of host timezone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const first = documentArchiveDateRange("2026-09-30", "2026-09-30");
      process.env.TZ = "UTC";
      expect(documentArchiveDateRange("2026-09-30", "2026-09-30")).toEqual(first);
      expect(documentArchiveDateRange("2026-09-30", "", "UTC").dateFrom).toBe("2026-09-30T00:00:00.000Z");
    } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  });
});
