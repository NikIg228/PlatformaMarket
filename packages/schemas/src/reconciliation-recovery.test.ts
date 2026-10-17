import { describe, expect, it } from "vitest";
import { resolvedReconciliationSchema, resolveReconciliationSchema } from "./index";
describe("reconciliation recovery contract", () => {
  it("validates decision and optional optimistic version without breaking legacy callers", () => {
    expect(resolveReconciliationSchema.parse({ resolution: "  Проверено  " })).toEqual({ resolution: "Проверено" });
    expect(resolveReconciliationSchema.safeParse({ resolution: "ok" }).success).toBe(false);
    expect(resolveReconciliationSchema.safeParse({ resolution: "Проверено", expectedUpdatedAt: "yesterday" }).success).toBe(false);
  });
  it("projects only the saved decision, with no source payload", () => {
    const value = resolvedReconciliationSchema.parse({ id: "00000000-0000-4000-8000-000000000001", status: "RESOLVED", resolution: "Проверено", resolvedAt: "2026-10-17T00:00:00.000Z", actual: { token: "secret" }, expected: { password: "secret" } });
    expect(JSON.stringify(value)).not.toContain("secret");
    expect(Object.keys(value)).toEqual(["id", "status", "resolution", "resolvedAt"]);
  });
});
