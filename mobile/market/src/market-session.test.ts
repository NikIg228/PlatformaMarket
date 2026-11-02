import { bindMarketReads, createMarketTransport, normalizeApiUrl, type FetchTransport } from "./market-transport";
import { createMarketSession } from "./market-session";

import { api, user, org, otherOrg, loginId, sessionId, accessToken, csrf, workspace, current, login, exchange, mfaStatus, response, deferred, until, server, paths, type Reply } from "./test-fixtures/market-session";

it("requires an explicit HTTPS API origin without credentials, query or fragment", () => {
  expect(normalizeApiUrl(` ${api}/ `)).toBe(api);
  for (const value of ["http://localhost/api", "https://name:secret@example.invalid/api", `${api}?token=secret`, `${api}#session=secret`, "invalid"]) expect(() => normalizeApiUrl(value)).toThrow();
});
it("rejects path escapes and does not send identities without a bearer", async () => {
  const fetcher = server(); const transport = createMarketTransport(api, fetcher);
  await expect(transport.request("/../foreign")).rejects.toThrow();
  await expect(transport.request("//foreign.invalid")).rejects.toThrow();
  await expect(transport.request("/x", { organizationId: org })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("opens no catalog or anonymous identity when the server has no cookie session", async () => {
  const fetcher = server(path => path.startsWith("/auth/current") ? response(null) : undefined); const store = createMarketSession(api, fetcher);
  await store.start(); expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", canLogout: false }); expect(paths(fetcher)).toEqual(["/auth/current?workspace=BUYER"]);
});
it("publishes only after current-session and membership validation, without exposing secrets", async () => {
  const fetcher = server(); const store = createMarketSession(api, fetcher); await store.start();
  expect(store.getSnapshot().session?.scope).toMatchObject({ product: "market", environment: api, userId: user.id, organizationId: org });
  expect(paths(fetcher)).toEqual(["/auth/current?workspace=BUYER", "/auth/workspace-context"]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "include", redirect: "error" });
  expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: "omit", headers: { authorization: `Bearer ${accessToken}` } });
  for (const [, init] of fetcher.mock.calls) expect(init.headers).toMatchObject({ "Cache-Control": "no-store, no-cache", Pragma: "no-cache" });
  const publicState = JSON.stringify(store.getSnapshot()); expect(publicState).not.toContain(accessToken); expect(publicState).not.toContain(csrf);
});
it.each([401, 403])("keeps the shell closed when context returns %s", async status => {
  const fetcher = server(path => path === "/auth/workspace-context" ? response({ message: "synthetic-private-message" }, status) : undefined);
  const store = createMarketSession(api, fetcher); await store.start(); expect(store.getSnapshot().session).toBeUndefined(); expect(store.getSnapshot().phase).toBe("signed-out");
  expect(JSON.stringify(store.getSnapshot())).not.toContain("synthetic-private-message");
});
it("rejects supplier-only and mismatched current organization contexts", async () => {
  for (const body of [{ ...workspace(), capabilities: ["SUPPLIER"] }, workspace(otherOrg)]) {
    const store = createMarketSession(api, server(path => path === "/auth/workspace-context" ? response(body) : undefined)); await store.start(); expect(store.getSnapshot().session).toBeUndefined();
  }
});
it("uses email login, explicit BUYER selection and one-use exchange, with no token URL", async () => {
  const fetcher = server(path => path === "/auth/handoff/exchange" ? response(exchange(otherOrg), 201) : undefined); const store = createMarketSession(api, fetcher);
  await store.login("SYNTHETIC@example.invalid", "synthetic-password"); expect(store.getSnapshot().phase).toBe("choose"); expect(store.getSnapshot().choices).toHaveLength(2);
  expect(paths(fetcher)).toEqual(["/auth/login", "/identity/mfa", "/auth/workspaces"]);
  expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ email: user.email, password: "synthetic-password" });
  await store.selectOrganization(otherOrg); expect(store.getSnapshot().session?.scope.organizationId).toBe(otherOrg);
  const handoff = fetcher.mock.calls.find(([url]) => url.endsWith("/auth/handoff"))!;
  expect(handoff[1]).toMatchObject({ headers: { authorization: "Bearer synthetic-login-access-token", "x-organization-id": otherOrg }, credentials: "omit", body: '{"capability":"BUYER"}' });
  for (const [url, init] of fetcher.mock.calls) { expect(url).not.toMatch(/synthetic-(password|.*token|one-use)/); expect(init.headers).not.toHaveProperty("x-user-id"); expect(init.headers).not.toHaveProperty("x-session-id"); }
});
it("does not send an invalid login or select an organization outside the server choices", async () => {
  const fetcher = server(); const store = createMarketSession(api, fetcher);
  await store.login("not email", "synthetic-password"); expect(fetcher).not.toHaveBeenCalled(); expect(store.getSnapshot().issue).toBe("input");
  await store.login(user.email, "synthetic-password"); const count = fetcher.mock.calls.length; await store.selectOrganization("00000000-0000-4000-8000-000000000099"); expect(fetcher).toHaveBeenCalledTimes(count); expect(store.getSnapshot().session).toBeUndefined();
});
it("does not invent an organization for an account without memberships", async () => {
  const fetcher = server(path => path === "/auth/login" ? response({ ...login(), activeOrganizationId: null, organizationIds: [] }, 201) : undefined);
  const store = createMarketSession(api, fetcher); await store.login(user.email, "synthetic-password"); expect(store.getSnapshot()).toMatchObject({ phase: "choose", choices: [], canReloadChoices: false }); await store.reloadOrganizations(); expect(paths(fetcher)).toEqual(["/auth/login"]);
});
it("rejects refresh material in JSON instead of adding a storage fallback", async () => {
  const fetcher = server(path => path === "/auth/login" ? response({ ...login(), refreshToken: "synthetic-refresh-secret" }) : undefined);
  const store = createMarketSession(api, fetcher); await store.login(user.email, "synthetic-password"); expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", issue: "contract", canLogout: false }); expect(paths(fetcher)).toEqual(["/auth/login"]);
});
it.each([{ user: { ...user, id: otherOrg } }, { activeOrganizationId: otherOrg }, { capability: "SUPPLIER" }])("rejects a handoff exchange identity/capability mismatch %o", async override => {
  const store = createMarketSession(api, server(path => path === "/auth/handoff/exchange" ? response({ ...exchange(), ...override }) : undefined));
  await store.login(user.email, "synthetic-password"); await store.selectOrganization(org); expect(store.getSnapshot().session).toBeUndefined(); expect(store.getSnapshot().issue).toBe("contract");
});
it("routes exact read inputs and preserves zero/decimal strings without writes", async () => {
  const read = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(null); const client = bindMarketReads(read, org);
  await client.searchCatalog({ buyerOrganizationId: org, q: "a & b", limit: 1 });
  await client.compareOffers({ buyerOrganizationId: org, productId: user.id, quantity: "0.2500" });
  await client.workspaceOrders("buyer", { limit: 1 }); await client.getOrderWorkflow(sessionId);
  expect(read.mock.calls.map(([path]) => path)).toEqual([`/marketplace/search?buyerOrganizationId=${org}&q=a+%26+b&limit=1`, `/marketplace/products/${user.id}/compare?buyerOrganizationId=${org}&quantity=0.2500`, "/workspaces/buyer/orders?limit=1", `/supplier-orders/${sessionId}/workflow`]);
  expect(() => client.searchCatalog({ buyerOrganizationId: otherOrg })).toThrow();
});
it("coalesces expired-token refreshes and validates their session before reads", async () => {
  let time = 0; const gate = deferred<Reply>(); const fetcher = server(path => path === "/auth/refresh" ? gate.promise : undefined);
  const store = createMarketSession(api, fetcher, () => time); await store.start(); const client = store.getSnapshot().session!.client; time = 280_000;
  const first = client.getOrderWorkflow(user.id); const second = client.workspaceOrders("buyer", {});
  await until(() => paths(fetcher).includes("/auth/refresh")); expect(paths(fetcher).filter(path => path === "/auth/refresh")).toHaveLength(1);
  const { user: _, workspaces: __, ...renewed } = current({ accessToken: "synthetic-renewed-access-token" }); gate.resolve(response(renewed)); await Promise.all([first, second]);
  const call = fetcher.mock.calls.find(([url]) => url.endsWith("/auth/refresh"))!; expect(call[1]).toMatchObject({ credentials: "include", headers: { "x-csrf-token": csrf }, body: JSON.stringify({ workspace: "BUYER", expectedSessionId: sessionId }) });
  expect(fetcher.mock.calls.at(-1)![1]).toMatchObject({ credentials: "omit", headers: { authorization: "Bearer synthetic-renewed-access-token" } });
});
it("replays safe reads only once and does not rotate again for a late old-token 401", async () => {
  const pending: ReturnType<typeof deferred<Reply>>[] = [];
  const fetcher = server((path, init) => { if (path.startsWith("/supplier-orders/") && (init.headers as Record<string, string>).authorization === `Bearer ${accessToken}`) { const gate = deferred<Reply>(); pending.push(gate); return gate.promise; } });
  const store = createMarketSession(api, fetcher); await store.start(); const client = store.getSnapshot().session!.client;
  const first = client.getOrderWorkflow(user.id); const second = client.getOrderWorkflow(loginId); await until(() => pending.length === 2);
  pending[0].resolve(response(null, 401)); await first; pending[1].resolve(response(null, 401)); await second;
  expect(paths(fetcher).filter(path => path === "/auth/refresh")).toHaveLength(1);
});
it.each(["revoked", "wrong-session"])("drops revoked or mismatched refreshes (%s), with no identity header fallback", async kind => {
  let time = 0; const fetcher = server(path => path === "/auth/refresh" ? kind === "revoked" ? response(null, 401) : response({ ...current(), user: undefined, workspaces: undefined, sessionId: loginId }) : undefined);
  const store = createMarketSession(api, fetcher, () => time); await store.start(); const client = store.getSnapshot().session!.client; time = 280_000;
  await expect(client.getOrderWorkflow(user.id)).rejects.toThrow(); expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", canLogout: false }); expect(paths(fetcher)).not.toContain(`/supplier-orders/${user.id}/workflow`);
});
it("does not refresh or end the session for an object-level 403", async () => {
  const fetcher = server(path => path.startsWith("/supplier-orders") ? response({ message: "private" }, 403) : undefined); const store = createMarketSession(api, fetcher); await store.start();
  await expect(store.getSnapshot().session!.client.getOrderWorkflow(user.id)).rejects.toMatchObject({ status: 403 }); expect(store.getSnapshot().phase).toBe("ready"); expect(paths(fetcher)).not.toContain("/auth/refresh");
});
it("revokes exactly the captured session, sends no cookies/proofs in a URL and clears reads", async () => {
  const fetcher = server(); const store = createMarketSession(api, fetcher); await store.start(); const old = store.getSnapshot().session!.client;
  await store.logout(); expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", canLogout: false });
  const call = fetcher.mock.calls.find(([url]) => url.endsWith("/auth/session-logout"))!; expect(call[1]).toMatchObject({ method: "POST", credentials: "omit", body: JSON.stringify({ sessionId, accessToken }) });
  const count = fetcher.mock.calls.length; await expect(old.getOrderWorkflow(user.id)).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(count);
});
it.each(["network", "wrong-receipt"])("closes unknown logout on %s until a separate source read rebinds a usable client", async kind => {
  const fetcher = server(path => path === "/auth/session-logout" ? kind === "network" ? Promise.reject(new TypeError("synthetic network failure")) : response({ sessionId: loginId, status: "REVOKED", loginStatus: "REVOKED" }) : undefined);
  const store = createMarketSession(api, fetcher); await store.start(); const oldGeneration = store.getSnapshot().session!.scope.generation; await store.logout();
  expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", canContinueLogout: true, logoutUncertain: true, canLogout: true, issue: kind === "network" ? "network" : "contract" }); expect(store.getSnapshot().session).toBeUndefined(); await store.continueLogout(store.getSnapshot()); expect(store.getSnapshot().phase).toBe("ready"); expect(store.getSnapshot().session!.scope.generation).not.toBe(oldGeneration);
  await expect(store.getSnapshot().session!.client.getOrderWorkflow(user.id)).resolves.toEqual({ read: `/supplier-orders/${user.id}/workflow` }); expect(paths(fetcher).filter(path => path === "/auth/session-logout")).toHaveLength(1);
});
it("discards a delayed restore even if the fetch implementation ignores cancellation", async () => {
  const gate = deferred<Reply>(); const fetcher = server(path => path.startsWith("/auth/current") ? gate.promise : undefined); const store = createMarketSession(api, fetcher);
  const pending = store.start(); store.requireLogin(); gate.resolve(response(current())); await pending;
  expect(store.getSnapshot().phase).toBe("signed-out"); expect(paths(fetcher)).not.toContain("/auth/workspace-context");
});
it("does not silently replace a known session with a new cookie session on resume", async () => {
  let restored = current(); const fetcher = server(path => path.startsWith("/auth/current") ? response(restored) : undefined); const store = createMarketSession(api, fetcher); await store.start();
  restored = current({ sessionId: loginId }); await store.restore(); expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", issue: "authentication" }); expect(store.getSnapshot().session).toBeUndefined();
});
it("uses the existing MFA challenge before workspace access, including a server-elevated token", async () => {
  const fetcher = server(path => path === "/identity/mfa" ? response(mfaStatus(true)) : path === "/identity/mfa/challenge" ? response({ accessToken: "synthetic-elevated-access-token", accessTokenExpiresIn: 300, activeOrganizationId: org, authenticationMethods: ["password", "totp"], factor: { verified: true, method: "TOTP", challengeId: user.id, recoveryCodesRemaining: 0 } }) : undefined);
  const store = createMarketSession(api, fetcher); await store.login(user.email, "synthetic-password"); expect(store.getSnapshot().phase).toBe("mfa"); expect(paths(fetcher)).not.toContain("/auth/workspaces");
  await store.challenge("123456"); expect(store.getSnapshot().phase).toBe("choose"); expect(fetcher.mock.calls.at(-1)![1]).toMatchObject({ headers: { authorization: "Bearer synthetic-elevated-access-token" } });
});
it("deduplicates bootstrap and ignores a second login while the first is pending", async () => {
  const gate = deferred<Reply>(); const fetcher = server(path => path === "/auth/login" ? gate.promise : undefined); const store = createMarketSession(api, fetcher);
  const loginPending = store.login(user.email, "synthetic-password"); await store.login("second@example.invalid", "another-synthetic-password"); expect(paths(fetcher)).toEqual(["/auth/login"]); gate.resolve(response(login())); await loginPending;
  const restored = createMarketSession(api, fetcher); await Promise.all([restored.start(), restored.start()]); expect(paths(fetcher).filter(path => path.startsWith("/auth/current"))).toHaveLength(1);
});

it("re-reads existing choices once and filters a newly returned foreign membership", async () => {
  const gate = deferred<Reply>(); let reads = 0;
  const fetcher = server(path => path === "/auth/workspaces" ? ++reads === 1 ? response([]) : gate.promise : undefined);
  const store = createMarketSession(api, fetcher); await store.login(user.email, "synthetic-password");
  expect(store.getSnapshot()).toMatchObject({ phase: "choose", choices: [], canReloadChoices: true });
  const pending = store.reloadOrganizations(); await store.reloadOrganizations();
  expect(paths(fetcher).filter(path => path === "/auth/workspaces")).toHaveLength(2);
  gate.resolve(response([workspace(org), workspace("00000000-0000-4000-8000-000000000099")])); await pending;
  expect(store.getSnapshot().choices.map(choice => choice.organizationId)).toEqual([org]);
  expect(store.getSnapshot().session).toBeUndefined();
  expect(paths(fetcher)).not.toContain("/auth/handoff");
});

it("retains validated choices on a recoverable list-read failure without opening a session", async () => {
  let failed = false;
  const fetcher = server(path => failed && path === "/auth/workspaces" ? response({ message: "SYNTHETIC private choices error" }, 503) : undefined);
  const store = createMarketSession(api, fetcher); await store.login(user.email, "synthetic-password"); const prior = store.getSnapshot().choices;
  failed = true; await store.reloadOrganizations();
  expect(store.getSnapshot()).toMatchObject({ phase: "choose", issue: "network", canReloadChoices: true });
  expect(store.getSnapshot().choices).toEqual(prior); expect(store.getSnapshot().session).toBeUndefined();
  expect(JSON.stringify(store.getSnapshot())).not.toContain("SYNTHETIC private choices error");
});

it("ignores a late choices reload after the session is invalidated", async () => {
  const gate = deferred<Reply>(); let reads = 0;
  const fetcher = server(path => path === "/auth/workspaces" ? ++reads === 1 ? response([]) : gate.promise : undefined);
  const store = createMarketSession(api, fetcher); await store.login(user.email, "synthetic-password");
  const pending = store.reloadOrganizations(); store.requireLogin(); gate.resolve(response([workspace(org)])); await pending;
  expect(store.getSnapshot()).toMatchObject({ phase: "signed-out", choices: [], canReloadChoices: false });
  expect(store.getSnapshot().session).toBeUndefined();
});
