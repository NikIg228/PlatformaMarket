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
it("keeps legacy development origins and login fallback", async () => {
  vi.stubEnv("NODE_ENV", "development");
  for (const key of ["NEXT_PUBLIC_LANDING_APP_URL", "NEXT_PUBLIC_BUYER_APP_URL", "NEXT_PUBLIC_SUPPLIER_APP_URL", "NEXT_PUBLIC_LOGIN_URL"]) vi.stubEnv(key, undefined);
  const { publicFrontendUrls, publicLoginUrl } = await import("./frontend-routes");
  expect(publicFrontendUrls).toEqual({landing:"http://127.0.0.1:3003",buyer:"http://127.0.0.1:3001",supplier:"http://127.0.0.1:3002"});
  expect(publicLoginUrl).toBe("http://127.0.0.1:3003/login");
});
it("preserves empty unified landing and explicit same-origin overrides", async () => {
  vi.stubEnv("NEXT_PUBLIC_LANDING_APP_URL", "");vi.stubEnv("NEXT_PUBLIC_BUYER_APP_URL", "/");vi.stubEnv("NEXT_PUBLIC_SUPPLIER_APP_URL", "/supplier");vi.stubEnv("NEXT_PUBLIC_LOGIN_URL", "/login");
  const { publicFrontendUrls, publicLoginUrl } = await import("./frontend-routes");
  expect(publicFrontendUrls).toEqual({landing:"",buyer:"/",supplier:"/supplier"});expect(publicLoginUrl).toBe("/login");
});
it("retains legacy production defaults without inventing a deployment origin", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const key of ["NEXT_PUBLIC_LANDING_APP_URL", "NEXT_PUBLIC_BUYER_APP_URL", "NEXT_PUBLIC_SUPPLIER_APP_URL", "NEXT_PUBLIC_LOGIN_URL"]) vi.stubEnv(key, undefined);
  const { publicFrontendUrls, legacyFrontendOrigins, publicLoginUrl } = await import("./frontend-routes");
  expect(publicFrontendUrls).toEqual({landing:legacyFrontendOrigins.landing,buyer:legacyFrontendOrigins.buyer,supplier:legacyFrontendOrigins.supplier});expect(publicLoginUrl).toBe(legacyFrontendOrigins.landing+"/login");
});
