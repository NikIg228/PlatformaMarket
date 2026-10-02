import { describe, expect, it } from "vitest";
import { commerceAnalyticsQuerySchema } from "./commerce-analytics";
describe("commerce analytics period contract", () => {
  const period = { from: "2026-10-01T00:00:00+05:00", to: "2026-11-01T00:00:00+05:00" };
  it("requires explicit instants and a bounded half-open period", () => {
    expect(commerceAnalyticsQuerySchema.parse(period)).toMatchObject({ dataset: "BUSINESS", timezone: "Asia/Qyzylorda", page: 1, pageSize: 25, currency: "KZT" });
    for (const change of [{ from: "2026-10-01" }, { to: period.from }, { to: "2027-01-03T00:00:01+05:00" }, { timezone: "unknown" }, { pageSize: "101" }, { dataset: "ALL" }, { organizationId: "wrong" }]) expect(commerceAnalyticsQuerySchema.safeParse({ ...period, ...change }).success).toBe(false);
  });
});
