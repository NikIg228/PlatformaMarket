import { describe, expect, it } from "vitest";
import { documentArchiveQuerySchema } from "./core-api";
describe("document archive state groups", () => {
  it.each(["AWAITING_SIGNATURE", "ATTENTION", "ARCHIVED"])("accepts %s with a bounded page", view => {
    expect(documentArchiveQuerySchema.parse({ view, q: " invoice " })).toMatchObject({ view, q: "invoice", limit: 25 });
  });
  it("rejects unknown groups and invalid periods", () => {
    expect(documentArchiveQuerySchema.safeParse({ view: "ALL_TENANTS" }).success).toBe(false);
    expect(documentArchiveQuerySchema.safeParse({ view: "ATTENTION", dateFrom: "2026-10-09T00:00:00Z", dateTo: "2026-10-08T00:00:00Z" }).success).toBe(false);
  });
});
