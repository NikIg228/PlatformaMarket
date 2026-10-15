import { describe, expect, it } from "vitest";
import { operatorCountSchema, operatorDashboardQuerySchema, operatorDashboardSchema } from "./operator-dashboard";

describe("operator dashboard read contract", () => {
  it("distinguishes known zero from unavailable and rejects contradictory values", () => {
    expect(operatorCountSchema.parse({ status: "AVAILABLE", value: 0 }).value).toBe(0);
    expect(operatorCountSchema.parse({ status: "UNAVAILABLE", value: null, reason: "SOURCE_UNAVAILABLE" }).value).toBeNull();
    for (const value of [
      { status: "AVAILABLE", value: null }, { status: "AVAILABLE", value: -1 },
      { status: "AVAILABLE", value: 1.5 }, { status: "UNAVAILABLE", value: 0, reason: "SOURCE_UNAVAILABLE" },
      { status: "UNAVAILABLE", value: null, reason: "postgres://secret" },
    ]) expect(operatorCountSchema.safeParse(value).success).toBe(false);
  });
  it("accepts complete current totals beyond page limits without raw source details", () => {
    const response = { observedAt: "2026-10-14T00:00:00.000Z", scope: "PLATFORM_CURRENT_ALL_STATUSES", organizations: { status: "AVAILABLE", value: 151 }, masterProducts: { status: "AVAILABLE", value: 12001 }, effectivePermissions: { status: "AVAILABLE", value: 4 } };
    expect(operatorDashboardSchema.parse(response).masterProducts.value).toBe(12001);
    expect(operatorDashboardSchema.safeParse({ ...response, credentials: "secret" }).success).toBe(false);
  });
  it("rejects selectors and authority in the request", () => {
    expect(operatorDashboardQuerySchema.parse({})).toEqual({});
    for (const query of [{ organizationId: "foreign" }, { actorId: "other" }, { offset: "100" }, { status: "ACTIVE" }]) expect(operatorDashboardQuerySchema.safeParse(query).success).toBe(false);
  });
});
