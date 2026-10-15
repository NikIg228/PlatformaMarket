import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe("admin safe login return", () => {
  it.each([true, false])("retains a protected destination in unified=%s without a login loop", async unified => {
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", String(unified)); vi.resetModules();
    const { adminLoginUrl, adminLoginDestination } = await import("./admin-navigation");
    const root = unified ? "/admin" : "/";
    const login = unified ? "/admin/login" : "/login";
    const url = adminLoginUrl({ pathname: root, search: "?section=settings" });
    expect(url).toBe(`${login}?returnTo=%2Fadmin%3Fsection%3Dsettings`);
    expect(adminLoginDestination(new URL(url, "https://local.invalid").search)).toBe(root + "?section=settings");
    const context = "?section=support&supportQ=test&supportStatus=OPEN&supportOffset=50&queueOffset=100";
    expect(adminLoginDestination(new URL(adminLoginUrl({ pathname: root, search: context }), "https://local.invalid").search)).toBe(root + context);
    expect(adminLoginUrl({ pathname: login, search: "?returnTo=%2Fadmin" })).toBe(login);
    for (const search of ["?returnTo=https://outside.invalid", "?returnTo=%2Fadmin%2Flogin", "?returnTo=%2Fadmin&returnTo=%2Fadmin%3Fsection%3Dorders", "?returnTo=%2Fadmin%3Ftoken%3Dsecret"]) {
      expect(adminLoginDestination(search)).toBe(root);
    }
  });
});
