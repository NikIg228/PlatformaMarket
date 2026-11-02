import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
import { createPersonalSession } from "./personal-session";
const id = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const session = { user: { id, displayName: "Synthetic" }, sessionId: id, mode: "PERSONAL", accessToken: "personal-token", accessTokenExpiresIn: 900 };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());
describe("personal session and cart client", () => {
  it("uses cookie restoration and no caller supplied organization context", async () => {
    const fetcher = vi.fn().mockImplementation(async () => json(session)); vi.stubGlobal("fetch", fetcher);
    const store = createPersonalSession("/api"); await store.start();
    expect(fetcher).toHaveBeenCalledWith("/api/auth/personal-current", expect.objectContaining({ credentials: "include", cache: "no-store" }));
    expect(await store.getAccessToken(id)).toBe("personal-token");
  });
  it("does not send a cart request after the cookie changes to a different account", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(session)).mockResolvedValueOnce(json({ ...session, sessionId: otherId, user: { ...session.user, id: otherId } }));
    vi.stubGlobal("fetch", fetcher);
    const store = createPersonalSession("/api"); await store.start();
    const api = new MarketplaceApiClient("/api", { getAccessToken: () => store.getAccessToken(id) });
    await expect(api.personalCreateCart()).rejects.toThrow("Аккаунт изменился");
    expect(fetcher.mock.calls.every(([url]) => url === "/api/auth/personal-current")).toBe(true);
    expect(store.getSnapshot().session?.sessionId).toBe(otherId);
  });
  it("does not resurrect a delayed identity response after invalidation", async () => {
    let done!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(resolve => { done = resolve; })));
    const store = createPersonalSession("/api"); const pending = store.start(); store.invalidate(); done(json(session)); await pending;
    expect(store.getSnapshot().session).toBeNull();
  });
  it("sends versioned personal operations without tenant headers or write replay", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({})); vi.stubGlobal("fetch", fetcher);
    const api = new MarketplaceApiClient("/api", { getAccessToken: async () => "personal-token" });
    await api.personalAddItem(id, { expectedVersion: 4, offerId: otherId, quantity: 2.5 });
    expect(fetcher).toHaveBeenCalledWith(`/api/personal/carts/${id}/items`, expect.objectContaining({ method: "POST",
      body: JSON.stringify({ expectedVersion: 4, offerId: otherId, quantity: 2.5 }), headers: { "content-type": "application/json", authorization: "Bearer personal-token" } }));
    fetcher.mockResolvedValue(json({ code: "UNAUTHORIZED" }, 401));
    await expect(api.personalRemoveItem(id, otherId, { expectedVersion: 5 })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
