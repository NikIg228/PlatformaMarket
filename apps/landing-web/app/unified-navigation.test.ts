import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it("keeps handoff and return paths on the unified origin without duplicating prefixes", async () => {
  vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", "true");
  vi.stubEnv("NEXT_PUBLIC_BUYER_APP_URL", "/");
  vi.stubEnv("NEXT_PUBLIC_SUPPLIER_APP_URL", "/supplier"); vi.resetModules();
  const { workspaceHandoffUrl } = await import("./auth-client");
  const input = { displayName: "Fixture", organizationId: "fixture", handoffCode: "one-use-code" };
  expect(workspaceHandoffUrl({ ...input, capability: "BUYER", returnTo: "/clinic?count=48" }).split("#")[0]).toBe("/clinic?count=48");
  expect(workspaceHandoffUrl({ ...input, capability: "SUPPLIER", returnTo: "/supplier/documents" }).split("#")[0]).toBe("/supplier/documents");
  expect(workspaceHandoffUrl({ ...input, capability: "SUPPLIER", returnTo: "/catalog?q=test" })).toBe("/catalog?q=test");
});
