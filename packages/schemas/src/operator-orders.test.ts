import { describe, expect, it } from "vitest";
import { operatorOrdersQuerySchema, operatorOrderSchema } from "./operator-orders";
describe("operator order contract", () => {
  it("defaults bounded paging and validates filters without accepting tenant identity", () => {
    expect(operatorOrdersQuerySchema.parse({ q: "  ORD-31  ", offset: "25", dateFrom: "2026-10-01", dateTo: "2026-10-16" })).toMatchObject({ q: "ORD-31", offset: 25, limit: 25 });
    for (const input of [{ organizationId: "foreign" }, { limit: "101" }, { offset: "-1" }, { status: "UNKNOWN" }, { paymentStatus: ["PAID", "UNPAID"] }, { dateFrom: "2026-02-30" }, { dateFrom: "2026-10-17", dateTo: "2026-10-16" }, { q: "bad\u0000query" }]) expect(operatorOrdersQuerySchema.safeParse(input).success).toBe(false);
  });
  it("keeps large money as exact strings", () => {
    expect(operatorOrderSchema.shape.subtotalAmountMinor.parse("90071992547409931234")).toBe("90071992547409931234");
    expect(operatorOrderSchema.shape.subtotalAmountMinor.safeParse(9007199254740993).success).toBe(false);
  });
});
