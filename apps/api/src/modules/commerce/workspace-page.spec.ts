import { describe, expect, it } from "vitest";
import { workspacePage } from "./workspace-page";

describe("workspace cursors", () => {
  const rows = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"].map(id => ({ id, createdAt: new Date("2026-01-01T00:00:00.000Z") }));
  it("keeps a timestamp/id key even when the anchor row is deleted", () => {
    const page = workspacePage(["tenant", "orders", "filter"]);
    const result = page.finish(rows, 1);
    expect(result.items).toEqual(rows.slice(0, 1));
    const next = workspacePage(["tenant", "orders", "filter"], result.nextCursor!);
    expect(next.where.AND[0]).toEqual(page.where.AND[0]);
    expect(next.where.AND[1]).toEqual({ OR: [{ createdAt: { lt: rows[0].createdAt } }, { createdAt: rows[0].createdAt, id: { lt: rows[0].id } }] });
    expect(next.finish([], 1)).toEqual({ items: [], nextCursor: null });
  });
  it("rejects cross-tenant, changed-filter and malformed cursors", () => {
    const cursor = workspacePage(["tenant", "orders", "filter"]).finish(rows, 1).nextCursor!;
    expect(() => workspacePage(["other", "orders", "filter"], cursor)).toThrow();
    expect(() => workspacePage(["tenant", "orders", "different"], cursor)).toThrow();
    expect(() => workspacePage(["tenant"], "malformed")).toThrow();
  });
});
