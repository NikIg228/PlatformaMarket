import { describe, expect, it, vi } from "vitest";
import { PilotSigningApiClient } from "./pilot-signing";

const id = "00000000-0000-4000-8000-000000000001";
function fixture(result: unknown = { status: "UNVERIFIED" }) {
  const send = vi.fn(async (_path: string, _init?: RequestInit) => result);
  return { send, client: new PilotSigningApiClient({ request: async <T>(path: string, init?: RequestInit) => await send(path, init) as T }) };
}

describe("pilot signing contract client", () => {
  it("reads identity using the existing transport without user-supplied actor or tenant headers", async () => {
    const f = fixture();
    expect(await f.client.call("identity", {})).toEqual({ status: "UNVERIFIED" });
    expect(f.send).toHaveBeenCalledWith("/identity/signing-binding", { method: "GET" });
  });
  it("encodes pagination in the URL and validates path parameters before transport", async () => {
    const f = fixture({ offset: 0, total: 0, items: [] });
    await f.client.call("authorities", { organizationId: id }, { offset: 0, limit: 25 });
    expect(f.send).toHaveBeenCalledWith(`/organizations/${id}/signing/authorities?offset=0&limit=25`, { method: "GET" });
    await expect(f.client.call("authorities", { organizationId: "../other-org" }, { offset: 0, limit: 25 })).rejects.toThrow();
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it("preserves replay keys and session versions on CMS submission and does not report pending as committed", async () => {
    const pending = { id, version: 2, purpose: "BIND_IDENTITY", status: "VERIFYING" };
    const f = fixture(pending);
    const input = { sessionId: id, expectedSessionVersion: 1, cmsBase64: "AQID", idempotencyKey: "submit-1" };
    expect(await f.client.call("submitCms", {}, input)).toEqual(pending);
    expect(f.send).toHaveBeenCalledWith("/signing/sessions/cms", { method: "POST", body: JSON.stringify(input) });
  });
  it("propagates a timeout without an automatic repeat; recovery reads the same session", async () => {
    const f = fixture({ id, version: 2, purpose: "BIND_IDENTITY", status: "UNKNOWN", reasonCode: "VERIFIER_UNAVAILABLE" });
    f.send.mockRejectedValueOnce(new Error("timeout"));
    await expect(f.client.call("submitCms", {}, { sessionId: id, expectedSessionVersion: 1,
      cmsBase64: "AQID", idempotencyKey: "submit-1" })).rejects.toThrow("timeout");
    expect(f.send).toHaveBeenCalledTimes(1);
    expect((await f.client.call("session", { sessionId: id })).status).toBe("UNKNOWN");
    expect(f.send).toHaveBeenLastCalledWith(`/signing/sessions/${id}`, { method: "GET" });
  });
  it("rejects a forged success response and invalid payload before another network write", async () => {
    const f = fixture({ id, version: 1, purpose: "BIND_IDENTITY", status: "COMMITTED" });
    await expect(f.client.call("createIdentityChallenge", {}, { idempotencyKey: "create-1" })).rejects.toThrow();
    await expect(f.client.call("createIdentityChallenge", {}, { idempotencyKey: "" })).rejects.toThrow();
    expect(f.send).toHaveBeenCalledTimes(1);
  });
});
