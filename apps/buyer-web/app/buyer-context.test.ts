import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buyerMode, requireOrganizationMode, setBuyerMode } from "./buyer-context";
import { switchBuyerOrganization } from "./switch-buyer-context";

const state = vi.hoisted(() => ({ session: { sessionId: "session", organizationId: "old", accessToken: "old-token" }, invalidate: vi.fn(), retry: vi.fn(), token: vi.fn() }));
vi.mock("./workspace-session", () => ({ sessionStore: { getSnapshot: () => ({ session: state.session }), getAccessToken: state.token, invalidate: state.invalidate, retry: state.retry } }));
beforeEach(() => {
  vi.clearAllMocks(); state.token.mockResolvedValue("old-token"); state.retry.mockResolvedValue(undefined);
  const data = new Map<string, string>(); const events = new EventTarget();
  vi.stubGlobal("window", { sessionStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }, dispatchEvent: events.dispatchEvent.bind(events) });
  setBuyerMode("organization");
});
afterEach(() => vi.unstubAllGlobals());
describe("buyer context boundary", () => {
  it("blocks organization API calls in personal and switching modes", () => {
    expect(() => requireOrganizationMode()).not.toThrow();
    setBuyerMode("personal"); expect(buyerMode()).toBe("personal"); expect(() => requireOrganizationMode()).toThrow("Оформление личных покупок пока недоступно");
    setBuyerMode("switching"); expect(() => requireOrganizationMode()).toThrow("Дождитесь");
  });
  it("verifies the switched capability and discards the old workspace before navigation", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ activeOrganizationId: id, accessToken: "new-token" }))
      .mockResolvedValueOnce(Response.json({ organizationId: id, organizationDisplayName: "Second buyer", capabilities: ["BUYER"] }));
    vi.stubGlobal("fetch", fetcher); setBuyerMode("personal");
    await switchBuyerOrganization(id);
    expect(state.token).toHaveBeenCalledWith(true);
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({ organizationId: id }));
    expect(fetcher.mock.calls[1][1].headers.authorization).toBe("Bearer new-token");
    expect(state.invalidate).toHaveBeenCalledOnce(); expect(buyerMode()).toBe("organization");
  });
  it.each(["timeout", "denied", "wrong-context"])("fails closed after %s without restoring stale shopping authority", async kind => {
    const fetcher = vi.fn();
    if (kind === "timeout") fetcher.mockRejectedValue(new Error("timeout"));
    else if (kind === "denied") fetcher.mockResolvedValue(new Response(null, { status: 403 }));
    else fetcher.mockResolvedValue(Response.json({ activeOrganizationId: "foreign", accessToken: "token" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(switchBuyerOrganization("new")).rejects.toThrow();
    expect(state.invalidate).toHaveBeenCalledOnce(); expect(state.retry).toHaveBeenCalledOnce();
    expect(buyerMode()).toBe("personal"); expect(() => requireOrganizationMode()).toThrow();
  });
  it("blocks purchases while the membership refresh is pending and recovers from its failure", async () => {
    let rejectRefresh!: (error: Error) => void;
    state.token.mockReturnValue(new Promise((_, reject) => { rejectRefresh = reject; }));
    const changing = switchBuyerOrganization("new");
    expect(buyerMode()).toBe("switching"); expect(() => requireOrganizationMode()).toThrow("Дождитесь");
    const rejected = expect(changing).rejects.toThrow("refresh unavailable");
    rejectRefresh(new Error("refresh unavailable")); await rejected;
    expect(buyerMode()).toBe("personal"); expect(state.retry).toHaveBeenCalledOnce();
  });
});
