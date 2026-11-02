import { uuid } from "expo";
import { createNativeBuyerReviewPort, platformReviewUuidProvider } from "./buyer-review-native-port";
import { createMarketSession } from "./market-session";
import { reviewScope, reviewWorkflow, reviewInput, reviewReceipt, reviewId, reviewError } from "./test-fixtures/buyer-review";
import { api, current, response, server, deferred } from "./test-fixtures/market-session";
import type { ReadScope } from "./read-controller";

function provider() { let n = 20001; return { randomUUID: jest.fn(() => reviewId(n++)) }; }
afterEach(() => jest.restoreAllMocks());
it.each([false, true])("uses the installed Expo UUID API when Web Crypto is absent, native failure=%s", failed => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto"), generate = jest.spyOn(uuid, "v4");
  Object.defineProperty(globalThis, "crypto", { configurable: true, get: () => undefined });
  if (failed) generate.mockImplementation(() => { throw Error("SYNTHETIC native UUID unavailable"); }); else generate.mockReturnValue(reviewId(22001));
  const write = jest.fn(async () => ({}));
  try {
    const binding = createNativeBuyerReviewPort(reviewScope, write, platformReviewUuidProvider(), () => true);
    if (failed) expect(() => binding.port.nextKey(reviewScope)).toThrow(); else expect(binding.port.nextKey(reviewScope)).toBe(reviewId(22001));
    expect(generate).toHaveBeenCalledTimes(1); expect(write).not.toHaveBeenCalled(); binding.close();
  } finally { if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor); else Reflect.deleteProperty(globalThis, "crypto"); }
});
it("issues a native key and sends only the existing scoped POST with a frozen source-schema body", async () => {
  const uuid = provider(), write = jest.fn(async (_path, input) => reviewReceipt(input)), binding = createNativeBuyerReviewPort(reviewScope, write, uuid, () => true), port = binding.port;
  expect(Object.keys(port).sort()).toEqual(["canIssueKey", "create", "nextKey"]); expect(uuid.randomUUID).not.toHaveBeenCalled();
  const key = port.nextKey(reviewScope), input = reviewInput(key); await port.create(reviewScope, reviewWorkflow().orderId, input);
  expect(write).toHaveBeenCalledTimes(1); expect(write.mock.calls[0][0]).toBe(`/trust/orders/${reviewWorkflow().orderId}/reviews`); expect(write.mock.calls[0][1]).toEqual(input); expect(Object.isFrozen(write.mock.calls[0][1])).toBe(true); expect(Object.isFrozen(write.mock.calls[0][1].dimensions)).toBe(true); binding.close();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("does not issue a key or send a request for mismatched %s", async field => {
  const uuid = provider(), write = jest.fn(async () => ({})), binding = createNativeBuyerReviewPort(reviewScope, write, uuid, () => true), forged = { ...reviewScope, [field]: field === "generation" ? 2 : "SYNTHETIC_OTHER" } as ReadScope;
  expect(binding.port.canIssueKey(forged)).toBe(false); expect(() => binding.port.nextKey(forged)).toThrow(); await expect(binding.port.create(forged, reviewWorkflow().orderId, reviewInput())).rejects.toMatchObject({ code: "scope" }); expect(uuid.randomUUID).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); binding.close();
});
it("blocks an absent native UUID capability without a weak fallback", () => { const write = jest.fn(async () => ({})), binding = createNativeBuyerReviewPort(reviewScope, write, undefined, () => true); expect(binding.port.canIssueKey(reviewScope)).toBe(false); expect(() => binding.port.nextKey(reviewScope)).toThrow(); expect(write).not.toHaveBeenCalled(); binding.close(); });
it("requires an actually issued key before a native request", async () => { const write = jest.fn(async () => ({})), binding = createNativeBuyerReviewPort(reviewScope, write, provider(), () => true); await expect(binding.port.create(reviewScope, reviewWorkflow().orderId, reviewInput())).rejects.toMatchObject({ code: "key" }); expect(write).not.toHaveBeenCalled(); binding.close(); });
it("pins the exact wire body and key through a failed request and an explicit retry", async () => {
  const write = jest.fn(async (_path, input) => reviewReceipt(input)); write.mockRejectedValueOnce(reviewError(500)); const uuid = provider(), binding = createNativeBuyerReviewPort(reviewScope, write, uuid, () => true), input = reviewInput(binding.port.nextKey(reviewScope)), id = reviewWorkflow().orderId;
  await expect(binding.port.create(reviewScope, id, input)).rejects.toMatchObject({ status: 500 }); expect(write).toHaveBeenCalledTimes(1); await binding.port.create(reviewScope, id, input);
  expect(write).toHaveBeenCalledTimes(2); expect(write.mock.calls[0][1]).toBe(write.mock.calls[1][1]); expect(uuid.randomUUID).toHaveBeenCalledTimes(1); binding.close();
});
it.each(["overallRating", "dimensions", "comment", "productVariantId", "orderId"])("refuses a changed %s under an already sent key before another POST", async field => {
  const write = jest.fn(async (_path, input) => reviewReceipt(input)), binding = createNativeBuyerReviewPort(reviewScope, write, provider(), () => true), input = reviewInput(binding.port.nextKey(reviewScope)), id = reviewWorkflow().orderId;
  await binding.port.create(reviewScope, id, input); const changed = { ...input };
  if (field === "overallRating") changed.overallRating = 1; else if (field === "dimensions") changed.dimensions = { ...input.dimensions, delivery: 1 }; else if (field === "comment") changed.comment = "SYNTHETIC another intent"; else if (field === "productVariantId") changed.productVariantId = reviewId(90001);
  await expect(binding.port.create(reviewScope, field === "orderId" ? reviewId(90002) : id, changed)).rejects.toMatchObject({ code: "input" }); expect(write).toHaveBeenCalledTimes(1); binding.close();
});
it("rejects an invalid path and unexpected grant-like payload fields", async () => {
  const write = jest.fn(async () => ({})), binding = createNativeBuyerReviewPort(reviewScope, write, provider(), () => true), input = reviewInput(binding.port.nextKey(reviewScope));
  await expect(binding.port.create(reviewScope, "../another-order", input)).rejects.toMatchObject({ code: "input" }); await expect(binding.port.create(reviewScope, reviewWorkflow().orderId, { ...input, permissions: ["trust.review.create"] } as typeof input)).rejects.toMatchObject({ code: "input" }); expect(write).not.toHaveBeenCalled(); binding.close();
});
it("discards a late result after the native request scope is closed", async () => { const pending = deferred<unknown>(), write = jest.fn(() => pending.promise), binding = createNativeBuyerReviewPort(reviewScope, write, provider(), () => true), input = reviewInput(binding.port.nextKey(reviewScope)), work = binding.port.create(reviewScope, reviewWorkflow().orderId, input); binding.close(); pending.resolve(reviewReceipt(input)); await expect(work).rejects.toMatchObject({ code: "scope" }); expect(binding.port.canIssueKey(reviewScope)).toBe(false); });
it("does not apply the GET401 refresh/replay rule to a business POST", async () => {
  const id = reviewWorkflow().orderId, fetcher = server(path => path === `/trust/orders/${id}/reviews` ? response(reviewError(401).payload, 401) : undefined), manager = createMarketSession(api, fetcher, Date.now, provider()); await manager.start(); const session = manager.getSnapshot().session!, port = session.client.buyerReviewCommandPort!, input = reviewInput(port.nextKey(session.scope));
  await expect(port.create(session.scope, id, input)).rejects.toBeDefined(); expect(fetcher.mock.calls.filter(([url]) => url.endsWith(`/trust/orders/${id}/reviews`))).toHaveLength(1); expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); expect(manager.getSnapshot().phase).toBe("signed-out");
});
it("refreshes an expired token before the first explicit command, without refreshing or replaying afterward", async () => {
  let clock = 1_000_000; const id = reviewWorkflow().orderId, fetcher = server((path, init) => path === `/trust/orders/${id}/reviews` ? response({ saved: true, body: JSON.parse(String(init.body)) }, 201) : undefined), manager = createMarketSession(api, fetcher, () => clock, provider()); await manager.start(); const session = manager.getSnapshot().session!, port = session.client.buyerReviewCommandPort!, input = reviewInput(port.nextKey(session.scope)); clock += 300_000;
  await port.create(session.scope, id, input); expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1); const writes = fetcher.mock.calls.filter(([url]) => url.endsWith(`/trust/orders/${id}/reviews`)); expect(writes).toHaveLength(1); expect(writes[0][1]).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error", headers: { authorization: "Bearer synthetic-renewed-access-token", "x-organization-id": current().activeOrganizationId } }); expect(writes[0][1].headers).not.toHaveProperty("x-user-id"); manager.requireLogin();
});
