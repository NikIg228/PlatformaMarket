import { bindNativeBuyerWorkspaceReads } from "./native-buyer-workspace-reads";
import { createMarketSession } from "./market-session";
import { createReadController, type ReadScope } from "./read-controller";
import { api, user, org, current, response, server, deferred } from "./test-fixtures/market-session";
import { savedListFixture } from "./test-fixtures/saved-lists";

const scope: ReadScope = { product: "market", environment: api, userId: user.id, organizationId: org, generation: 1 };
const orderId = "00000000-0000-4000-8000-000000000101";

it("exposes exactly the two existing read routes, with no mutation or grant provider", async () => {
  const read = jest.fn(async () => []), ports = bindNativeBuyerWorkspaceReads(scope, read, () => true);
  expect(Object.keys(ports).sort()).toEqual(["orderCommentsFixture", "savedListsFixture"]); expect(Object.isFrozen(ports)).toBe(true);
  await ports.savedListsFixture(scope); await ports.orderCommentsFixture(scope, orderId);
  expect(read.mock.calls).toEqual([["/owner/saved-lists"], [`/trust/orders/${orderId}/comments`]]);
});

it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("rejects a mismatched %s before invoking the authenticated reader", async field => {
  const read = jest.fn(async () => []), ports = bindNativeBuyerWorkspaceReads(scope, read, () => true), forged = { ...scope, [field]: field === "generation" ? 2 : "SYNTHETIC_OTHER_CONTEXT" } as ReadScope;
  await expect(Promise.resolve().then(() => ports.savedListsFixture(forged))).rejects.toMatchObject({ code: "scope" }); expect(read).not.toHaveBeenCalled();
});

it.each(["", "../other-order", "00000000-0000-4000-8000-000000000101?private=1"])("rejects an invalid order identifier before transport: %s", async id => {
  const read = jest.fn(async () => []), ports = bindNativeBuyerWorkspaceReads(scope, read, () => true);
  await expect(Promise.resolve().then(() => ports.orderCommentsFixture(scope, id))).rejects.toMatchObject({ code: "input" }); expect(read).not.toHaveBeenCalled();
});

it("rejects a late response after its session becomes inactive", async () => {
  let active = true; const pending = deferred<unknown>(), read = jest.fn(() => pending.promise), ports = bindNativeBuyerWorkspaceReads(scope, read, () => active);
  const request = ports.savedListsFixture(scope); active = false; pending.resolve([{ private: "SYNTHETIC old response" }]);
  await expect(request).rejects.toMatchObject({ code: "scope" }); expect(read).toHaveBeenCalledTimes(1);
});

it("uses one existing refresh for simultaneous native workspace reads without adding credentials or write providers", async () => {
  let clock = 1_000_000;
  const fetcher = server(path => path === "/owner/saved-lists" || path === `/trust/orders/${orderId}/comments` ? response([]) : undefined), manager = createMarketSession(api, fetcher, () => clock);
  await manager.start(); const session = manager.getSnapshot().session!; clock += 300_000;
  await Promise.all([session.client.savedListsFixture!(session.scope), session.client.orderCommentsFixture!(session.scope, orderId)]);
  expect(fetcher.mock.calls.filter(([url]) => url === `${api}/auth/refresh`)).toHaveLength(1);
  for (const [, init] of fetcher.mock.calls.filter(([url]) => url.includes("/owner/") || url.includes("/trust/"))) {
    expect(init).toMatchObject({ method: "GET", credentials: "omit", redirect: "error", cache: "no-store", headers: { authorization: "Bearer synthetic-renewed-access-token" } }); expect(init.body).toBeUndefined(); expect(init.headers).not.toHaveProperty("x-user-id");
  }
  expect(session.client.savedListCreateCommandFixture).toBeUndefined(); expect(session.client.savedListItemCommandFixture).toBeUndefined(); expect(session.client.savedListRemoveCommandFixture).toBeUndefined(); expect(session.client.orderCommentCreateCommandFixture).toBeUndefined(); manager.requireLogin();
});

it("keeps a source403 distinct from session expiry and performs no automatic refresh", async () => {
  const fetcher = server(path => path === "/owner/saved-lists" ? response({ statusCode: 403, code: "FORBIDDEN", message: "SYNTHETIC denied", path, timestamp: "2026-10-30T01:02:03.000Z" }, 403) : undefined), manager = createMarketSession(api, fetcher);
  await manager.start(); const session = manager.getSnapshot().session!;
  await expect(session.client.savedListsFixture!(session.scope)).rejects.toMatchObject({ status: 403 });
  expect(manager.getSnapshot().phase).toBe("ready"); expect(fetcher.mock.calls.some(([url]) => url === `${api}/auth/refresh`)).toBe(false); manager.requireLogin();
});

it("invalidates old native read ports after confirmed logout before any further request", async () => {
  const fetcher = server(), manager = createMarketSession(api, fetcher); await manager.start(); const session = manager.getSnapshot().session!;
  await manager.logout(); const calls = fetcher.mock.calls.length;
  await expect(Promise.resolve().then(() => session.client.savedListsFixture!(session.scope))).rejects.toMatchObject({ code: "scope" }); expect(fetcher).toHaveBeenCalledTimes(calls);
});

it("uses the existing owner-first decoder rather than displaying a foreign native list", async () => {
  const foreign = savedListFixture({ organizationId: "00000000-0000-4000-8000-000000099801", name: "SYNTHETIC foreign private list" });
  const fetcher = server(path => path === "/owner/saved-lists" ? response([foreign]) : undefined), manager = createMarketSession(api, fetcher); await manager.start(); const session = manager.getSnapshot().session!, controller = createReadController(session);
  controller.subscribe(() => {}); await controller.load({ kind: "saved-lists" }); expect(controller.getSnapshot().state).toEqual({ phase: "contract-error" });
  expect(JSON.stringify(controller.getSnapshot())).not.toContain("SYNTHETIC foreign private list"); controller.dispose(); manager.requireLogin();
});
