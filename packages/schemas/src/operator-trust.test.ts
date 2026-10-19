import { describe, expect, it } from "vitest";
import { operatorTrustQuerySchema, operatorTrustResolveSchema, operatorTrustSchema } from "./operator-trust";
import { defaultAdminQuery, parseAdminQuery, serializeAdminQuery } from "./admin-query";
describe("operator trust contracts", () => {
  it("restores trust tabs and bounded pages through browser navigation", () => {
    const state = { ...defaultAdminQuery, section: "security" as const, trustView: "reputation" as const, trustIncidentOffset: 25, trustSupplierOffset: 50 };
    expect(parseAdminQuery(serializeAdminQuery(state))).toEqual(state);
    for (const query of ["trustView=bad", "trustIncidentOffset=1", "trustSupplierOffset=1000025"]) expect(parseAdminQuery(`section=security&${query}`)).toBeUndefined();
  });
  it("bounds pages and rejects extra filters", () => {
    expect(operatorTrustQuerySchema.parse({ incidentOffset: "25" })).toEqual({ incidentOffset: 25, supplierOffset: 0 });
    for (const value of [-1, "x", 1.2, 1000001]) expect(operatorTrustQuerySchema.safeParse({ supplierOffset: value }).success).toBe(false);
    expect(operatorTrustQuerySchema.safeParse({ tenantId: "other" }).success).toBe(false);
  });
  it("requires a real resolution and current version", () => {
    expect(operatorTrustResolveSchema.safeParse({ version: 1, resolution: "   " }).success).toBe(false);
    expect(operatorTrustResolveSchema.safeParse({ version: 0, resolution: "Проверено" }).success).toBe(false);
    expect(operatorTrustResolveSchema.parse({ version: 3, resolution: "  Проверено  " }).resolution).toBe("Проверено");
  });
  it("cannot present missing sources as available data or verified automation", () => {
    const data = { observedAt: new Date().toISOString(), automaticFlow: "NOT_VERIFIED", canResolve: false, incidents: { status: "UNAVAILABLE", data: null }, suppliers: { status: "FORBIDDEN", data: null }, warehouses: { status: "UNAVAILABLE", data: null } };
    expect(operatorTrustSchema.safeParse(data).success).toBe(true);
    expect(operatorTrustSchema.safeParse({ ...data, incidents: { status: "AVAILABLE", data: null } }).success).toBe(false);
    expect(operatorTrustSchema.safeParse({ ...data, automaticFlow: "VERIFIED" }).success).toBe(false);
  });
});
