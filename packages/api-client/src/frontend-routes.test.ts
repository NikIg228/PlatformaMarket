import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it("preserves legacy links until the unified build is selected", async () => {
  vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", "false"); vi.resetModules();
  const { workspacePath } = await import("./frontend-routes");
  expect(workspacePath("BUYER", "/documents")).toBe("/documents");
});
it("scopes each workspace exactly once, including filtered clinic roots", async () => {
  vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", "true"); vi.resetModules();
  const { workspacePath } = await import("./frontend-routes");
  expect(workspacePath("BUYER")).toBe("/clinic");
  expect(workspacePath("BUYER", "/clinic?count=48")).toBe("/clinic?count=48");
  expect(workspacePath("SUPPLIER", "/documents")).toBe("/supplier/documents");
  expect(workspacePath("ADMIN", "/login")).toBe("/admin/login");
});
