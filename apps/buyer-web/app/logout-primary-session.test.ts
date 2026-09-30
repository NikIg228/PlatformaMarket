import { afterEach, expect, it, vi } from "vitest";
import { logoutPrimarySession } from "./logout-primary-session";
afterEach(() => vi.unstubAllGlobals());
it("does not require a login cookie for an independent test workspace", async () => {
  const request = vi.fn().mockResolvedValue(Response.json(null)); vi.stubGlobal("fetch", request);
  await logoutPrimarySession("/api");
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe("/api/auth/current");
});
it("does not claim logout when the login session cannot be checked", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(logoutPrimarySession("/api")).rejects.toThrow("Повторите выход");
});
