import { describe, expect, it } from "vitest";
import { operationWorkQueueQuerySchema, operationWorkQueueSchema } from "./operations-workflow";

describe("global operation queue contract", () => {
  it("uses bounded global pages and explicit filtering defaults", () => {
    expect(operationWorkQueueQuerySchema.parse({})).toEqual({ q: "", kind: "ALL", assignment: "ALL", due: "ALL", sort: "queue", offset: 0, limit: 50 });
    expect(operationWorkQueueQuerySchema.parse({ q: "  Поставка  ", kind: "SUPPLIER_CONFIRMATION", priority: "CRITICAL", assignment: "MINE", due: "OVERDUE", sort: "oldest", offset: "50", limit: "25" })).toMatchObject({ q: "Поставка", offset: 50, limit: 25, assignment: "MINE" });
  });
  it.each([{ offset: -1 }, { limit: 101 }, { limit: 0 }, { kind: "SUPPORT" }, { priority: "UNKNOWN" }, { assignment: "other-user" }, { due: "tomorrow" }, { sort: "SQL" }, { q: "a\u0000b" }, { q: "x".repeat(201) }, { organizationId: "spoofed" }, { offset: ["0", "50"] }])("rejects invalid filters or authority overrides %j", value => {
    expect(operationWorkQueueQuerySchema.safeParse(value).success).toBe(false);
  });
  it("keeps unfiltered total and filtered total available even for an empty late page", () => {
    const value = { generatedAt: "2026-10-16T12:00:00.000Z", operatorOrganizationId: "00000000-0000-4000-8000-000000000001", totalOpenItems: 200, total: 51, offset: 100, limit: 50, hasMore: false, items: [] };
    expect(operationWorkQueueSchema.parse(value)).toEqual(value);
  });
});
