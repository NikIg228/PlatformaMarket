import { afterEach, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@marketplace/schemas";

const sessionA: OperatorSession = {
  sessionId: "10000000-0000-4000-8000-000000000001", accessToken: "synthetic-token-for-operator-a", accessTokenExpiresIn: 600,
  activeOrganizationId: "20000000-0000-4000-8000-000000000001", organizationIds: ["20000000-0000-4000-8000-000000000001"],
  csrfToken: "synthetic-csrf-for-operator-a", refreshTokenExpiresAt: "2099-01-01T00:00:00.000Z",
  user: { id: "30000000-0000-4000-8000-000000000001", email: "operator-a@example.invalid", displayName: "Operator A" },
};
const sessionB = { ...sessionA, sessionId: "10000000-0000-4000-8000-000000000002", accessToken: "synthetic-token-for-operator-b" };

async function setup() {
  vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", "true"); vi.resetModules();
  const storage = new Map<string, string>();
  const location = { hash: "", pathname: "/admin", search: "?section=settings", origin: "https://local.invalid", assign: vi.fn(), replace: vi.fn() };
  vi.stubGlobal("window", { location, dispatchEvent: vi.fn(), sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  const { MarketplaceApiClient } = await import("@marketplace/api-client");
  const current = vi.spyOn(MarketplaceApiClient.prototype, "currentOperatorSession");
  return { ...await import("./admin-auth"), current, location };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("admin restore keeps the selected identity", () => {
  it("preserves a newer login when the old logout receipt arrives", async () => {
    const auth = await setup(); auth.saveAdminSession(sessionA);
    vi.stubGlobal("BroadcastChannel", undefined);
    let complete!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; })));
    const pending = auth.logoutAdmin(); auth.saveAdminSession(sessionB);
    complete(Response.json({ sessionId: sessionA.sessionId, status: "REVOKED", loginStatus: "SAME_SESSION" }));
    await pending;
    expect(auth.readAdminSession()?.sessionId).toBe(sessionB.sessionId);
    expect(auth.location.assign).not.toHaveBeenCalled();
  });
  it("keeps the selected login available after an unconfirmed logout", async () => {
    const auth = await setup(); auth.saveAdminSession(sessionA);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(auth.logoutAdmin()).rejects.toThrow("Выход не подтверждён");
    expect(auth.readAdminSession()?.sessionId).toBe(sessionA.sessionId);
    expect(auth.location.assign).not.toHaveBeenCalled();
  });
  it("restores an empty tab and renews the same identity", async () => {
    const auth = await setup(); auth.current.mockResolvedValue(sessionA);
    await auth.restoreAdminSession();
    expect(auth.readAdminSession()?.sessionId).toBe(sessionA.sessionId);
    auth.current.mockResolvedValue({ ...sessionA, accessToken: "synthetic-renewed-token-for-a" });
    await auth.restoreAdminSession();
    expect(auth.readAdminSession()?.accessToken).toBe("synthetic-renewed-token-for-a");
    expect(auth.location.replace).not.toHaveBeenCalled();
  });
  it.each([
    sessionB,
    { ...sessionA, user: { ...sessionA.user, id: "30000000-0000-4000-8000-000000000002" } },
    { ...sessionA, activeOrganizationId: "20000000-0000-4000-8000-000000000002" },
  ])("blocks a changed session, actor or organization instead of adopting it", async incoming => {
    const auth = await setup(); auth.saveAdminSession(sessionA); auth.current.mockResolvedValue(incoming);
    await expect(auth.restoreAdminSession()).rejects.toThrow("Аккаунт изменён");
    expect(auth.readAdminSession()).toBeNull();
    expect(auth.location.replace).toHaveBeenCalledWith("/admin/login?returnTo=%2Fadmin%3Fsection%3Dsettings&notice=session-changed");
  });
  it("never overwrites a newer login with a delayed restoration", async () => {
    const auth = await setup(); auth.saveAdminSession(sessionA);
    let complete!: (value: OperatorSession) => void;
    auth.current.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const pending = auth.restoreAdminSession(); auth.saveAdminSession(sessionB); complete(sessionA);
    await expect(pending).rejects.toThrow("Состояние входа изменилось");
    expect(auth.readAdminSession()?.sessionId).toBe(sessionB.sessionId);
    expect(auth.location.replace).not.toHaveBeenCalled();
  });
  it("does not resurrect a session cleared during restoration", async () => {
    const auth = await setup(); auth.saveAdminSession(sessionA);
    let complete!: (value: OperatorSession) => void;
    auth.current.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const pending = auth.restoreAdminSession(); auth.clearAdminSession(); complete(sessionA);
    await expect(pending).rejects.toThrow("Состояние входа изменилось");
    expect(auth.readAdminSession()).toBeNull();
  });
  it("binds old API clients to A and ignores A's late unauthorized callback after B logs in", async () => {
    const auth = await setup(); auth.saveAdminSession(sessionA); const context = auth.adminApiContext();
    auth.saveAdminSession(sessionB);
    await expect(context.getAccessToken?.()).rejects.toThrow("Аккаунт изменён");
    context.onUnauthorized?.();
    expect(auth.readAdminSession()?.sessionId).toBe(sessionB.sessionId);
    expect(auth.location.assign).not.toHaveBeenCalled(); expect(auth.location.replace).not.toHaveBeenCalled();
  });
  it("does not clear the selected session on a transient server failure", async () => {
    const auth = await setup(); auth.saveAdminSession(sessionA); auth.current.mockRejectedValue(new Error("offline"));
    await expect(auth.restoreAdminSession()).rejects.toThrow("offline");
    expect(auth.readAdminSession()?.sessionId).toBe(sessionA.sessionId);
  });
});
