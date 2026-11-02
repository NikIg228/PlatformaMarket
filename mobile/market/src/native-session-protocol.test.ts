import { jest } from "@jest/globals";
import { sessionProtocolCaseIds, syntheticNativeSessionProtocol } from "./test-fixtures/native-session-protocol";
import { accessToken, csrf, user, org, sessionId, loginId } from "./test-fixtures/market-session";

const expected = {
  "restore-logout": ["ready", "signed-out"], "login-select": ["choose", "ready", "signed-out"], "mfa-select": ["mfa", "choose", "ready", "signed-out"],
  "expired-refresh": ["ready", "ready", "signed-out"], "refresh-revoked": ["ready", "signed-out"], "context-denied": ["signed-out"], "forbidden-json-refresh": ["signed-out"], "logout-network": ["ready", "signed-out", "ready", "ready"],
} as const;
it.each(sessionProtocolCaseIds)("redacted synthetic%s follows actual native session phases without exposing credential values", async scenario => {
  const report = await syntheticNativeSessionProtocol(scenario);
  expect(report.transitions.map(step => step.phase)).toEqual(expected[scenario]); expect(report.syntheticTransportCalls).toBe(report.requests.length);
  expect(report).toMatchObject({ businessCommandCalls: 0, realNetworkRequests: 0, realServerMutations: 0, realInputsAccepted: false, credentialStoreAccessed: false, serverAccepted: false, productionAuthorizationVerified: false, defaultNativeMutationAdmission: "NOT_VERIFIED" });
  for (const value of [accessToken, csrf, user.email, user.displayName, user.id, org, sessionId, loginId, "synthetic-password", "synthetic-login-access-token", "synthetic-one-use-handoff-code", "synthetic-renewed-access-token", "synthetic-elevated-access-token", "synthetic-forbidden-refresh-proof", "synthetic private transport failure", "123456", "https:"]) expect(JSON.stringify(report)).not.toContain(value);
  for (const call of report.requests) { expect(call.rejectsRedirects).toBe(true); expect(call.headerNames).toContain("cache-control"); expect(call.path).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i); expect(Object.isFrozen(call)).toBe(true); }
});
it("request shapes are emitted from actual login/MFA/handoff/refresh/logout calls", async () => {
  const mfa = await syntheticNativeSessionProtocol("mfa-select"), refresh = await syntheticNativeSessionProtocol("expired-refresh");
  expect(mfa.requests.find(call => call.path === "/auth/login")).toMatchObject({ method: "POST", cookies: true, bodyFields: { email: "string", password: "string" } });
  expect(mfa.requests.find(call => call.path === "/identity/mfa/challenge")?.headerNames).toContain("authorization");
  expect(mfa.requests.find(call => call.path === "/auth/handoff")?.bodyFields).toEqual({ capability: "string" });
  expect(refresh.requests.filter(call => call.path === "/auth/refresh")).toHaveLength(1);
  expect(refresh.requests.find(call => call.path === "/auth/refresh")).toMatchObject({ cookies: true, bodyFields: { expectedSessionId: "string", workspace: "string" } });
  expect(refresh.requests.find(call => call.path === "/auth/session-logout")?.bodyFields).toEqual({ accessToken: "string", sessionId: "string" });
});
it("failed logout and revoked refresh stay explicit without a false revocation or a business read", async () => {
  const logout = await syntheticNativeSessionProtocol("logout-network"), revoked = await syntheticNativeSessionProtocol("refresh-revoked"), forbidden = await syntheticNativeSessionProtocol("forbidden-json-refresh");
  expect(logout.transitions[1]).toMatchObject({ phase: "signed-out", hasSession: false, issue: "network" }); expect(logout.transitions[2]).toMatchObject({ phase: "ready", hasSession: true }); expect(logout.requests.filter(call => call.path === "/auth/current")).toHaveLength(2); expect(logout.requests.filter(call => call.path === "/auth/session-logout")).toHaveLength(1); expect(logout.requests.find(call => call.path === "/auth/session-logout")?.httpStatus).toBe("network-error");
  expect(revoked.requests.some(call => call.path.startsWith("/supplier-orders/"))).toBe(false); expect(revoked.transitions.at(-1)?.hasSession).toBe(false);
  expect(forbidden.transitions.at(-1)).toMatchObject({ phase: "signed-out", issue: "contract", hasSession: false });
});
it("all generated session examples use only the injected synthetic transport", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("FORBIDDEN_NETWORK"));
  try { for (const id of sessionProtocolCaseIds) await syntheticNativeSessionProtocol(id); expect(fetch).not.toHaveBeenCalled(); }
  finally { fetch.mockRestore(); }
});
