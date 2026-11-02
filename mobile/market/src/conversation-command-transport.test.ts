import { jest } from "@jest/globals";
import { createConversationCommandTransport, ConversationCommandTransportError } from "./conversation-command-transport";
import { createConversationReadTransport } from "./conversation-read-transport";
import { createMarketTransport, MarketHttpError, type FetchTransport } from "./market-transport";
import { createReadController } from "./read-controller";
import { offerStateApi } from "./test-fixtures/offer-conversation-state";
import { offerMessagesAuthorization } from "./test-fixtures/offer-conversation-messages";
import { offerConversationScope, offerConversationThreadId as id, offerConversationId as uuid, offerComparison } from "./test-fixtures/offer-conversation";
const scope = Object.freeze({ ...offerConversationScope, environment: "https://market.example.invalid/api" }), key = uuid(62001), ticket = uuid(62002), text = "SYNTHETIC reviewed text", reason = "SYNTHETIC reviewed support reason";
function setup() { let live = true; const post = jest.fn<(path: string, body: Readonly<object>) => Promise<unknown>>().mockResolvedValue({ conversationId: id }), model = createConversationCommandTransport(scope, post, () => live); return { post, model, live: (value: boolean) => { live = value; } }; }
it("command candidate creates no key/grant and has no GET or arbitrary request surface", () => {
  const s = setup(); expect(Object.isFrozen(s.model)).toBe(true); expect(Object.keys(s.model).sort()).toEqual(["close", "escalate", "markRead", "resolve", "send", "start", "supportReply"]); expect(s.post).not.toHaveBeenCalled();
});
it.each(["ORDER", "OFFER"] as const)("first%s message uses actual source POST and exact canonical body", async contextType => {
  const s = setup(), input = { contextType, contextId: id, body: text, idempotencyKey: key }; await s.model.start(scope, input); expect(s.post).toHaveBeenCalledWith("/conversations", input); expect(Object.isFrozen(s.post.mock.calls[0]![1])).toBe(true); expect(s.post.mock.calls[0]![1]).not.toHaveProperty("attachments");
});
it("existing message/read/close/escalate/public reply preserve their distinct source inputs", async () => {
  const s = setup(); await s.model.send(scope, id, { body: text, idempotencyKey: key }); await s.model.markRead(scope, id, { throughSequence: 0 }); await s.model.resolve(scope, id, { expectedVersion: 5 }); await s.model.escalate(scope, id, { reason, idempotencyKey: key }); await s.model.supportReply(scope, ticket, { body: text, idempotencyKey: key, isInternal: false, attachments: [] });
  expect(s.post.mock.calls).toEqual([[`/conversations/${id}/messages`, { body: text, idempotencyKey: key }], [`/conversations/${id}/read`, { throughSequence: 0 }], [`/conversations/${id}/resolve`, { expectedVersion: 5 }], [`/conversations/${id}/escalate`, { reason, idempotencyKey: key }], [`/support/tickets/${ticket}/messages`, { body: text, idempotencyKey: key, isInternal: false, attachments: [] }]]);
  expect(s.post.mock.calls.every(row => Object.isFrozen(row[1]))).toBe(true); expect(Object.isFrozen((s.post.mock.calls[4]![1] as { attachments: unknown[] }).attachments)).toBe(true);
});
it.each(["start", "send", "escalate", "supportReply"] as const)("%s refuses to silently trim text after source review", method => {
  const s = setup(), input = method === "start" ? { contextType: "OFFER", contextId: id, body: ` ${text} `, idempotencyKey: key } : method === "escalate" ? { reason: ` ${reason} `, idempotencyKey: key } : method === "supportReply" ? { body: ` ${text} `, idempotencyKey: key, isInternal: false, attachments: [] } : { body: ` ${text} `, idempotencyKey: key };
  const invoke = () => method === "start" ? s.model.start(scope, input) : s.model[method](scope, id, input); expect(invoke).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled(); expect(JSON.stringify(input)).toContain("SYNTHETIC");
});
it.each([{ body: "", idempotencyKey: key }, { body: text, idempotencyKey: "bad" }, { body: "a".repeat(10001), idempotencyKey: key }, { body: text, idempotencyKey: key, attachments: [] }, { body: text, idempotencyKey: key, expectedVersion: 5 }])("invalid selected message input cannot POST:%p", input => {
  const s = setup(); expect(() => s.model.send(scope, id, input)).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ contextType: "B2C", contextId: id, body: text, idempotencyKey: key }, { contextType: "OFFER", contextId: "../foreign", body: text, idempotencyKey: key }, { contextType: "ORDER", contextId: id, body: text, idempotencyKey: key, attachments: [{ assetId: id }] }])("invalid first-message subset never dispatches:%p", input => {
  const s = setup(); expect(() => s.model.start(scope, input)).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ throughSequence: -1 }, { throughSequence: 0.5 }, { throughSequence: 65, idempotencyKey: key }])("read marker keeps actual keyless source shape:%p", input => {
  const s = setup(); expect(() => s.model.markRead(scope, id, input)).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ expectedVersion: 0 }, { expectedVersion: 5, decision: reason }, { expectedVersion: 5, idempotencyKey: key }])("unlinked BUYER close cannot smuggle operator decision/key:%p", input => {
  const s = setup(); expect(() => s.model.resolve(scope, id, input)).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ reason: "short", idempotencyKey: key }, { reason, idempotencyKey: key, expectedVersion: 5 }, { reason, idempotencyKey: key, ticketId: ticket }])("support request retains actual reason/key only:%p", input => {
  const s = setup(); expect(() => s.model.escalate(scope, id, input)).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ body: text, idempotencyKey: key, isInternal: true, attachments: [] }, { body: text, idempotencyKey: key, isInternal: false, attachments: [], reopen: true }, { body: text, idempotencyKey: key, isInternal: false, attachments: [{ assetId: id }] }, { body: "", idempotencyKey: key, isInternal: false, attachments: [] }])("public reply rejects unsupported internal/reopen/file/empty subset:%p", input => {
  const s = setup(); expect(() => s.model.supportReply(scope, ticket, input)).toThrow(ConversationCommandTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each(["send", "markRead", "resolve", "escalate", "supportReply"] as const)("%s validates route UUID before touching a command body", method => {
  const s = setup(), input = {}, hidden = jest.fn(() => { throw Error("invalid target private input"); }); Object.defineProperty(input, "body", { get: hidden }); Object.defineProperty(input, "reason", { get: hidden });
  expect(() => s.model[method](scope, "//foreign.example.invalid/path", input)).toThrow(ConversationCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).not.toHaveBeenCalled();
});
it.each(["environment", "organizationId", "userId", "generation"] as const)("caller%s mismatch is stopped before any body getter", field => {
  const s = setup(), candidate = { ...scope, [field]: field === "generation" ? scope.generation + 1 : field === "environment" ? "https://other.example.invalid/api" : uuid(62003) }, hidden = jest.fn(() => { throw Error("foreign draft"); }), input = {};
  Object.defineProperty(input, "body", { get: hidden }); expect(() => s.model.send(candidate, id, input)).toThrow(ConversationCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).not.toHaveBeenCalled();
});
it.each(["fulfilled", "rejected"] as const)("late%s POST data after scope loss is suppressed before raw private getters", async outcome => {
  const s = setup(); let yes!: (value: unknown) => void, no!: (value: unknown) => void; s.post.mockImplementationOnce(() => new Promise((resolve, reject) => { yes = resolve; no = reject; }));
  const work = s.model.send(scope, id, { body: text, idempotencyKey: key }); s.live(false); const hidden = jest.fn(() => { throw Error("late command result"); }), raw = {};
  for (const field of ["conversationId", "ticketId", "body", "payload", "status"]) Object.defineProperty(raw, field, { get: hidden }); if (outcome === "fulfilled") yes(raw); else no(raw);
  await expect(work).rejects.toThrow(ConversationCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).toHaveBeenCalledTimes(1);
});
it.each([401, 403, 409, "network"] as const)("active%s error is preserved with no hidden retry or regenerated key", async status => {
  const s = setup(), failure = status === "network" ? Error("SYNTHETIC lost") : new MarketHttpError(status, { statusCode: status, message: "SYNTHETIC source failure" }); s.post.mockRejectedValueOnce(failure);
  await expect(s.model.send(scope, id, { body: text, idempotencyKey: key })).rejects.toBe(failure); expect(s.post).toHaveBeenCalledTimes(1);
});
it("explicit retry serializes original body/key unchanged without mutating caller input", async () => {
  const s = setup(), input = { body: text, idempotencyKey: key }; s.post.mockRejectedValueOnce(Error("lost")); await expect(s.model.send(scope, id, input)).rejects.toThrow("lost"); await s.model.send(scope, id, input);
  expect(JSON.stringify(s.post.mock.calls[1]![1])).toBe(JSON.stringify(s.post.mock.calls[0]![1])); expect(input).toEqual({ body: text, idempotencyKey: key }); expect(s.post).toHaveBeenCalledTimes(2);
});
it("pending outbound body is an immutable snapshot independent of later caller edits", async () => {
  const s = setup(), input = { body: text, idempotencyKey: key }; let finish!: (value: unknown) => void; s.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const work = s.model.send(scope, id, input); input.body = "SYNTHETIC later unsent edit";
  expect(s.post.mock.calls[0]![1]).toEqual({ body: text, idempotencyKey: key }); expect(Object.isFrozen(s.post.mock.calls[0]![1])).toBe(true); finish({ conversationId: id }); await work;
});
it("command close cannot close a separate GET port and cannot be revived", async () => {
  const s = setup(), read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValue({}), view = createConversationReadTransport(scope, read, () => true); s.model.close(); s.live(true);
  expect(() => s.model.send(scope, id, { body: text, idempotencyKey: key })).toThrow(ConversationCommandTransportError); await view.get(scope, id); expect(read).toHaveBeenCalledTimes(1); expect(s.post).not.toHaveBeenCalled(); view.close();
});
it("existing native transport sends one bearer POST with canonical JSON and private callback CSRF", async () => {
  const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => JSON.stringify({ conversationId: id }) }), http = createMarketTransport(scope.environment, fetcher), model = createConversationCommandTransport(scope, (path, body) => http.request(path, { method: "POST", token: "SYNTHETIC-token", csrf: "SYNTHETIC-csrf", body }), () => true);
  await model.send(scope, id, { body: text, idempotencyKey: key }); expect(fetcher).toHaveBeenCalledTimes(1); const [url, request] = fetcher.mock.calls[0]!;
  expect(url).toBe(`${scope.environment}/conversations/${id}/messages`); expect(request).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error" }); expect(JSON.parse(request.body as string)).toEqual({ body: text, idempotencyKey: key });
  const headers = request.headers as Record<string, string>; expect(headers.authorization).toBe("Bearer SYNTHETIC-token"); expect(headers["x-csrf-token"]).toBe("SYNTHETIC-csrf"); expect(headers["x-user-id"]).toBeUndefined(); model.close();
});
it("existing OFFER command model owns the original unknown attempt and explicit same-key replay through raw POST", async () => {
  const source = offerStateApi(), s = setup(), comparison = offerComparison(), selected = comparison.offers[0]!, nextKey = jest.fn(() => key);
  source.api.offerConversationFixture!.authorization = { ...source.api.offerConversationFixture!.authorization, scope };
  source.api.offerConversationMessagesFixture = { authorization: { ...offerMessagesAuthorization(), scope }, nextMessageKey: nextKey, start: s.model.start, send: s.model.send };
  const controller = createReadController({ scope, client: source.api }); controller.subscribe(() => {}); await controller.load({ kind: "comparison", input: { productId: comparison.product.id, variantId: selected.variantId } }); const target = controller.selectOfferConversation(comparison.product.id, selected.variantId, selected.offerId)!; await controller.load({ kind: "offer-conversation", target });
  const state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "offer-conversation") throw Error("fixture source window missing"); const window = state.read.value, draft = controller.offerConversationDrafts.begin(window)!; controller.offerConversationDrafts.setText(draft, ` ${text} `); expect(controller.offerConversationMessages.prepare(window)).toBe(true);
  s.post.mockRejectedValueOnce(Error("SYNTHETIC committed response lost")); await controller.offerConversationMessages.confirm(controller.offerConversationMessages.stateFor(selected.offerId).review!); expect(controller.offerConversationMessages.stateFor(selected.offerId).phase).toBe("unknown"); expect(s.post).toHaveBeenCalledTimes(1); expect(source.get).toHaveBeenCalledTimes(1);
  await controller.offerConversationMessages.replay(selected.offerId); expect(controller.offerConversationMessages.stateFor(selected.offerId).phase).toBe("receipt"); expect(nextKey).toHaveBeenCalledTimes(1); expect(JSON.stringify(s.post.mock.calls[1]![1])).toBe(JSON.stringify(s.post.mock.calls[0]![1])); expect(s.model).not.toHaveProperty("authorization"); controller.dispose(); s.model.close();
});
