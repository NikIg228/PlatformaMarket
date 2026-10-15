import { describe, expect, it } from "vitest";
import { operatorOrganizationsQuerySchema } from "./operator-organizations";

describe("operator organization query", () => {
  it("defaults bounds and accepts trimmed search and every actual status/capability", () => {
    expect(operatorOrganizationsQuerySchema.parse({})).toEqual({ offset: 0, limit: 25 });
    expect(operatorOrganizationsQuerySchema.parse({ q: "  clinic  ", offset: "25", limit: "50", status: "ARCHIVED", capability: "IMPORTER" }))
      .toEqual({ q: "clinic", offset: 25, limit: 50, status: "ARCHIVED", capability: "IMPORTER" });
    expect(operatorOrganizationsQuerySchema.parse({ q: "A#B\\C" }).q).toBe("A#B\\C");
  });
  it.each(["\u0000", "\n", "\u007f"])("rejects control characters even at the ends", q => {
    expect(operatorOrganizationsQuerySchema.safeParse({ q }).success).toBe(false);
  });
  it.each([{ limit: "0" }, { limit: "101" }, { offset: "1000001" }, { offset: "-1" }, { offset: "1.2" }, { offset: "1e2" }, { limit: "" }, { limit: true }, { q: ["one", "two"] }, { q: "a".repeat(201) }, { status: "DELETED" }, { capability: "ADMIN" }, { organizationId: "tenant" }, { actorId: "actor" }])("rejects ambiguous, unbounded or unrecognized values: %j", query => {
    expect(operatorOrganizationsQuerySchema.safeParse(query).success).toBe(false);
  });
});
