import { jest } from "@jest/globals";
import { createConversationReadTransport, ConversationReadTransportError } from "./conversation-read-transport";
import { createMarketTransport, MarketHttpError, type FetchTransport } from "./market-transport";
import { createOfferConversationRead } from "./offer-conversation-read";
import { offerConversationScope, offerConversationThreadId as id, offerConversationId as uuid, offerConversationAuthorization, offerComparison, offerConversationPage } from "./test-fixtures/offer-conversation";
const scope = Object.freeze({ ...offerConversationScope, environment: "https://market.example.invalid/api" });
function setup() { let live = true; const read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValue({ untouched: true }), model = createConversationReadTransport(scope, read, () => live); return { read, model, live: (value: boolean) => { live = value; } }; }
it("raw GET candidate has no permission, fixture grant, mutation or key provider fields", () => {
  const s = setup(); expect(Object.keys(s.model).sort()).toEqual(["close", "get", "list", "lookup"]); expect(Object.isFrozen(s.model)).toBe(true); expect(s.read).not.toHaveBeenCalled();
});
it("list uses actual defaults and supported explicit source filters/offset/limit", async () => {
  const s = setup(); await s.model.list(scope); expect(s.read).toHaveBeenLastCalledWith("/conversations?filter=ALL&offset=0&limit=30");
  await s.model.list(scope, { filter: "ORDERS", offset: 30, limit: 30 }); expect(s.read).toHaveBeenLastCalledWith("/conversations?filter=ORDERS&offset=30&limit=30");
  await s.model.list(scope, { filter: "UNREAD", offset: 100000, limit: 50 }); expect(s.read).toHaveBeenLastCalledWith("/conversations?filter=UNREAD&offset=100000&limit=50");
});
it.each([{ offset: -1 }, { offset: 100001 }, { offset: 0.5 }, { limit: 0 }, { limit: 51 }, { filter: "OFFER" }, { path: "/auth/logout" }])("invalid list input%p cannot dispatch a GET", input => {
  const s = setup(); expect(() => s.model.list(scope, input)).toThrow(ConversationReadTransportError); expect(s.read).not.toHaveBeenCalled();
});
it.each(["ORDER", "OFFER"] as const)("lookup preserves actual %s source context", async contextType => {
  const s = setup(); await s.model.lookup(scope, { contextType, contextId: id }); expect(s.read).toHaveBeenCalledWith(`/conversations/context?contextType=${contextType}&contextId=${id}`);
});
it.each([{ contextType: "B2C", contextId: id }, { contextType: "OFFER", contextId: "../private" }, { contextType: "ORDER", contextId: id, body: "hidden" }])("invalid context%p never reaches read", input => {
  const s = setup(); expect(() => s.model.lookup(scope, input)).toThrow(ConversationReadTransportError); expect(s.read).not.toHaveBeenCalled();
});
it("detail retains only exact valid id and positive actual cursor, returning raw response identity", async () => {
  const s = setup(), raw = { private: "SYNTHETIC untouched response" }; s.read.mockResolvedValue(raw);
  expect(await s.model.get(scope, id)).toBe(raw); expect(s.read).toHaveBeenLastCalledWith(`/conversations/${id}`);
  await s.model.get(scope, id, 16); expect(s.read).toHaveBeenLastCalledWith(`/conversations/${id}?beforeSequence=16`);
});
it.each([["//other.example.invalid/x", undefined], [id, 0], [id, -1], [id, 0.5]] as const)("invalid detail request%p/%p is blocked", (selected, cursor) => {
  const s = setup(); expect(() => s.model.get(scope, selected, cursor)).toThrow(ConversationReadTransportError); expect(s.read).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("caller %s mismatch cannot dispatch or read input getters", field => {
  const s = setup(), wrong = { ...scope, [field]: field === "generation" ? scope.generation + 1 : field === "environment" ? "https://other.example.invalid/api" : field === "product" ? "crm" : uuid(61000) }, hidden = jest.fn(() => { throw Error("stale request input"); }), input = {};
  Object.defineProperty(input, "contextType", { get: hidden }); expect(() => s.model.lookup(wrong as typeof scope, input)).toThrow(ConversationReadTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled();
});
it.each(["http://market.example.invalid/api", "https://user:secret@market.example.invalid/api", "https://market.example.invalid/api?token=secret", "fixture-local", "https://market.example.invalid/api/"])("invalid or noncanonical native environment is blocked:%s", environment => {
  const read = jest.fn<(path: string) => Promise<unknown>>(); expect(() => createConversationReadTransport({ ...scope, environment }, read, () => true)).toThrow(ConversationReadTransportError); expect(read).not.toHaveBeenCalled();
});
it("liveness is required, callback failure and close cannot revive a stale port", () => {
  const read = jest.fn<(path: string) => Promise<unknown>>(), model = createConversationReadTransport(scope, read, () => { throw Error("SYNTHETIC private liveness detail"); });
  expect(() => model.get(scope, id)).toThrow("Conversation read context is unavailable"); const s = setup(); s.model.close(); s.live(true); expect(() => s.model.list(scope)).toThrow(ConversationReadTransportError); expect(s.read).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
});
it.each(["fulfilled", "rejected"] as const)("late %s result after generation/liveness change is rejected before any private getter", async outcome => {
  const s = setup(); let yes!: (value: unknown) => void, no!: (value: unknown) => void; s.read.mockImplementationOnce(() => new Promise((resolve, reject) => { yes = resolve; no = reject; }));
  const work = s.model.get(scope, id); s.live(false); const hidden = jest.fn(() => { throw Error("late private GET"); }), raw = {};
  for (const key of ["conversation", "body", "payload", "status"]) Object.defineProperty(raw, key, { get: hidden });
  if (outcome === "fulfilled") yes(raw); else no(raw); await expect(work).rejects.toThrow(ConversationReadTransportError); expect(hidden).not.toHaveBeenCalled();
});
it("active HTTP errors retain exact source error identity and payload for the existing consumer", async () => {
  const s = setup(), error = new MarketHttpError(403, { statusCode: 403, message: "SYNTHETIC denied" }); s.read.mockRejectedValueOnce(error); await expect(s.model.get(scope, id)).rejects.toBe(error);
});
it("one closed port cannot cancel a separate active client or rewrite its actor namespace", async () => {
  const a = setup(), b = setup(); a.model.close(); expect(() => a.model.get(scope, id)).toThrow(ConversationReadTransportError); await b.model.get(scope, id); expect(b.read).toHaveBeenCalledTimes(1); expect(a.read).not.toHaveBeenCalled();
});
it("inactive port stops before caller scope or query getters are inspected", () => {
  const s = setup(), hidden = jest.fn(() => { throw Error("inactive caller metadata"); }), candidate = {}, input = {};
  Object.defineProperty(candidate, "userId", { get: hidden }); Object.defineProperty(input, "filter", { get: hidden }); s.live(false);
  expect(() => s.model.list(candidate as typeof scope, input)).toThrow(ConversationReadTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled();
});
it("existing native transport carries bearer GET without cookies/body/development actor header", async () => {
  const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => JSON.stringify({ items: [], hasMore: false, unreadCount: 0 }) }), http = createMarketTransport(scope.environment, fetcher), model = createConversationReadTransport(scope, path => http.request(path, { token: "SYNTHETIC-token" }), () => true);
  await model.list(scope); const [url, request] = fetcher.mock.calls[0]!; expect(url).toBe(`${scope.environment}/conversations?filter=ALL&offset=0&limit=30`); expect(request).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
  expect(request.body).toBeUndefined(); const headers = request.headers as Record<string, string>; expect(headers.authorization).toBe("Bearer SYNTHETIC-token"); expect(headers["x-user-id"]).toBeUndefined(); expect(headers["x-csrf-token"]).toBeUndefined(); model.close();
});
it("a protected OFFER consumer uses candidate GETs only with separately supplied synthetic test admission", async () => {
  const comparison = offerComparison(), selected = comparison.offers[0]!, page = offerConversationPage(), read = jest.fn<(path: string) => Promise<unknown>>().mockImplementation(async path => path.startsWith("/conversations/context?") ? { conversationId: id } : page), raw = createConversationReadTransport(scope, read, () => true), model = createOfferConversationRead(scope, { authorization: { ...offerConversationAuthorization(), scope }, lookup: raw.lookup, get: raw.get });
  const target = model.select(comparison, selected.offerId, comparison.product.id, selected.variantId)!; await model.load(target); expect(model.getState().phase).toBe("ready"); expect(read.mock.calls.map(row => row[0])).toEqual([`/conversations/context?contextType=OFFER&contextId=${selected.offerId}`, `/conversations/${id}`]);
  expect(raw).not.toHaveProperty("authorization"); model.close(); raw.close();
});
