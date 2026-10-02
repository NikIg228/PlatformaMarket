import { describe, expect, it } from "vitest";
import { analyticsDateRange } from "./commerce-analytics-date";
describe("analytics calendar filters", () => {
  it("uses the selected timezone and includes the whole final day", () => {
    expect(analyticsDateRange("2026-10-01", "2026-10-01", "Asia/Qyzylorda")).toEqual({ from: "2026-09-30T19:00:00.000Z", to: "2026-10-01T19:00:00.000Z" });
    expect(analyticsDateRange("2026-10-31", "2026-10-31", "UTC")).toEqual({ from: "2026-10-31T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" });
    expect(analyticsDateRange("", "2026-10-01", "UTC")).toBeNull();
  });
});
