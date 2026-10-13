import { afterEach, describe, expect, it, vi } from "vitest";
import { revokeWorkspaceSession } from "./index.js";

const session = { sessionId: "00000000-0000-4000-8000-000000000021", accessToken: "synthetic-access-proof" };
const receipt = { sessionId: session.sessionId, status: "REVOKED", loginStatus: "REVOKED" };
afterEach(() => vi.unstubAllGlobals());

describe("workspace logout server confirmation", () => {
  it("renews only an expired proof and keeps the captured target", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ code: "SESSION_LOGOUT_PROOF_EXPIRED" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json(receipt));
    vi.stubGlobal("fetch", fetcher);
    const renew = vi.fn().mockResolvedValue("renewed-proof-for-target");
    await revokeWorkspaceSession("/api", session, renew);
    expect(renew).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ sessionId: session.sessionId, accessToken: "renewed-proof-for-target" });
  });
  it("does not loop on expired proof or refresh unrelated authorization failures", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ code: "SESSION_LOGOUT_PROOF_EXPIRED" }, { status: 401 })));
    vi.stubGlobal("fetch", fetcher);
    const renew = vi.fn().mockResolvedValue("renewed-proof");
    await expect(revokeWorkspaceSession("/api", session, renew)).rejects.toThrow("не подтвердил");
    expect(fetcher).toHaveBeenCalledTimes(2); expect(renew).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue(Response.json({ code: "UNAUTHORIZED" }, { status: 401 })); renew.mockClear();
    await expect(revokeWorkspaceSession("/api", session, renew)).rejects.toThrow("не подтвердил");
    expect(renew).not.toHaveBeenCalled();
  });
  it("accepts an expired terminal receipt without refreshing and broadcasts only its target", async () => {
    const postMessage = vi.fn(); const close = vi.fn();
    vi.stubGlobal("window", {});
    vi.stubGlobal("BroadcastChannel", class { postMessage = postMessage; close = close; });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...receipt, status: "EXPIRED", loginStatus: "NOT_LINKED" })));
    const renew = vi.fn();
    await revokeWorkspaceSession("/api", session, renew);
    expect(renew).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: "revoked", sessionId: session.sessionId }); expect(close).toHaveBeenCalledOnce();
  });
  it("revokes the exact bearer session without cookies or identity headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(receipt));
    vi.stubGlobal("fetch", fetcher);
    await revokeWorkspaceSession("http://localhost/api/", session);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("http://localhost/api/auth/session-logout");
    expect(options).toMatchObject({ method: "POST", credentials: "omit", headers: { "content-type": "application/json" }, body: JSON.stringify(session) });
    expect(Object.keys(options.headers)).toHaveLength(1);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([null, {}, { sessionId: "s" }, { accessToken: "t" }])("never claims a local/demo-only session was revoked (%j)", async (value) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(revokeWorkspaceSession("http://localhost/api", value)).rejects.toThrow("не подтверждён");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 429, 500])("does not accept HTTP %s or expose server internals", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "SQL secret" }, { status })));
    await expect(revokeWorkspaceSession("http://localhost/api", session)).rejects.toThrow("не подтвердил");
    await expect(revokeWorkspaceSession("http://localhost/api", session)).rejects.not.toThrow("SQL secret");
  });

  it.each([{ ok: true }, { id: "other-session", status: "REVOKED" }, { id: "session-1", status: "ACTIVE" }, null])("requires explicit confirmation for this session (%j)", async (result) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));
    await expect(revokeWorkspaceSession("http://localhost/api", session)).rejects.toThrow("отзыв текущей сессии");
  });

  it("allows retry after a lost response without treating a network error as success", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("network with internal details"))
      .mockResolvedValueOnce(Response.json(receipt));
    vi.stubGlobal("fetch", fetcher);
    await expect(revokeWorkspaceSession("http://localhost/api", session)).rejects.toThrow("проверьте соединение");
    await expect(revokeWorkspaceSession("http://localhost/api", session)).resolves.toBeUndefined();
  });
});
