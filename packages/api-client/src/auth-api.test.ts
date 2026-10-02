import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index.js";

afterEach(() => vi.unstubAllGlobals());
it("sends credentials in POST bodies, accepts session cookies and authenticates MFA", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://localhost/api", { accessToken: "synthetic-access-token" });
  await client.loginEmail({ email: "test@example.invalid", password: "synthetic-password" });
  await client.verifyEmail({ token: "synthetic-proof" });
  await client.resetPassword({ token: "synthetic-reset", password: "synthetic-password" });
  await client.mfaStatus();
  await client.enrollMfa();
  await client.verifyMfaEnrollment({ code: "123456" });
  await client.challengeMfa({ code: "ABCD-EFGH-IJKL" });
  await client.disableMfa({ code: "123456" });
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "auth/login", "auth/email/verify", "auth/password/reset", "identity/mfa", "identity/mfa/totp/enroll",
    "identity/mfa/totp/verify", "identity/mfa/challenge", "identity/mfa/disable",
  ].map(path => `http://localhost/api/${path}`));
  for (const index of [0, 1]) expect(fetcher.mock.calls[index]![1]).toMatchObject({ method: "POST", credentials: "include" });
  expect(fetcher.mock.calls[6]![1]).toMatchObject({ method: "POST", body: JSON.stringify({ code: "ABCD-EFGH-IJKL" }), headers: { authorization: "Bearer synthetic-access-token" } });
});
