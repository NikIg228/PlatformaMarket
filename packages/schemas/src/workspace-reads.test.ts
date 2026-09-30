import { describe, expect, it } from "vitest";
import { workspaceOrderQuerySchema, workspacePageQuerySchema } from "./workspace-reads";

describe("workspace reads", () => {
  it("bounds pages and normalizes filters", () => {
    expect(workspacePageQuerySchema.parse({ q: " term " })).toEqual({ q: "term", limit: 50 });
    expect(workspacePageQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    for (const limit of [0, 101, 1.5, "all"]) expect(workspacePageQuerySchema.safeParse({ limit }).success).toBe(false);
    expect(workspaceOrderQuerySchema.safeParse({ status: "NOT_A_STATUS" }).success).toBe(false);
    expect(workspacePageQuerySchema.safeParse({ cursor: "x".repeat(1501) }).success).toBe(false);
  });
});
