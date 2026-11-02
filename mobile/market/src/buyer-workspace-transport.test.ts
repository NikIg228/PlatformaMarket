import { jest } from "@jest/globals";
import { createBuyerWorkspaceTransport, BuyerWorkspaceTransportError, type BuyerWorkspaceTransport, type BuyerWorkspaceMutationMethod } from "./buyer-workspace-transport";
import { createMarketTransport, MarketHttpError, type FetchTransport } from "./market-transport";
import { createSavedListCreateCommands, type SavedListCreateFixture } from "./saved-list-create-command";
import { savedListCreateScope, savedListCreateId as uuid, savedListCreatePage, savedListCreateAuthorization } from "./test-fixtures/saved-list-create-command";
import { createOrderCommentCreateCommands, type OrderCommentCreateFixture, type CreateOrderCommentInput } from "./order-comment-create-command";
import { commentCreateWindow, commentCreateAuthorization, commentCreateResult } from "./test-fixtures/order-comment-create-command";

const scope = Object.freeze({ ...savedListCreateScope, environment: "https://market.example.invalid/api" }), id = uuid(66001), item = uuid(66002), key = uuid(66003);
const list = { name: "SYNTHETIC reviewed тізім", isDefault: true }, line = { offerId: item, quantity: 0.500001, note: "SYNTHETIC reviewed note" }, comment = { body: "SYNTHETIC reviewed пікір\nЕкінші жол", idempotencyKey: key }, edit = { body: "SYNTHETIC reviewed edit", version: 9 };
function setup() {
  let live = true;
  const read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValue([]), mutate = jest.fn<(method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>>().mockResolvedValue({ untouched: true }), model = createBuyerWorkspaceTransport(scope, read, mutate, () => live);
  return { model, read, mutate, live: (value: boolean) => { live = value; } };
}
const commands: { name: string; method: BuyerWorkspaceMutationMethod; path: string; body?: Readonly<object>; run: (model: BuyerWorkspaceTransport) => Promise<unknown> }[] = [
  { name: "list create", method: "POST", path: "/owner/saved-lists", body: list, run: model => model.createSavedList(scope, list) },
  { name: "item upsert", method: "POST", path: `/owner/saved-lists/${id}/items`, body: line, run: model => model.upsertSavedListItem(scope, id, line) },
  { name: "item remove", method: "DELETE", path: `/owner/saved-lists/${id}/items/${item}`, run: model => model.removeSavedListItem(scope, id, item) },
  { name: "comment create", method: "POST", path: `/trust/orders/${id}/comments`, body: comment, run: model => model.createOrderComment(scope, id, comment) },
  { name: "comment edit", method: "PATCH", path: `/trust/comments/${item}`, body: edit, run: model => model.updateOrderComment(scope, item, edit) },
];
it("candidate exposes only existing source operations and no admission, keys, header delete or retry", () => {
  const s = setup(); expect(Object.keys(s.model).sort()).toEqual(["close", "createOrderComment", "createSavedList", "orderComments", "removeSavedListItem", "savedLists", "updateOrderComment", "upsertSavedListItem"]); expect(Object.isFrozen(s.model)).toBe(true); expect(s.read).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(commands)("one $name dispatch preserves exact source method/path/body without follow-up GET", async command => {
  const s = setup(), response = {}, before = JSON.stringify(command.body); s.mutate.mockResolvedValueOnce(response); expect(await command.run(s.model)).toBe(response);
  expect(s.mutate.mock.calls).toEqual([[command.method, command.path, command.body]]); expect(JSON.stringify(command.body)).toBe(before); expect(s.read).not.toHaveBeenCalled();
  if (command.body) { const sent = s.mutate.mock.calls[0]![2]!; expect(sent).not.toBe(command.body); expect(Object.isFrozen(sent)).toBe(true); }
});
it.each(["lists", "comments"] as const)("%s GET preserves raw response identity without reading source DTO fields", async kind => {
  const s = setup(), response = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private row"); }); for (const field of ["name", "body", "items", "version", "organizationId"]) Object.defineProperty(response, field, { get: hidden }); s.read.mockResolvedValueOnce(response);
  expect(await (kind === "lists" ? s.model.savedLists(scope) : s.model.orderComments(scope, id))).toBe(response); expect(s.read.mock.calls).toEqual([[kind === "lists" ? "/owner/saved-lists" : `/trust/orders/${id}/comments`]]); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each([undefined, null, "", "SYNTHETIC canonical note"])("item note preserves source optional/null/empty distinction:%p", async note => {
  const s = setup(), input = note === undefined ? { offerId: item, quantity: 1 } : { offerId: item, quantity: 1, note }; await s.model.upsertSavedListItem(scope, id, input); expect(s.mutate.mock.calls[0]![2]).toEqual(input);
  if (note === undefined) expect(s.mutate.mock.calls[0]![2]).not.toHaveProperty("note");
});
it.each([
  { name: "missing default", run: (model: BuyerWorkspaceTransport) => model.createSavedList(scope, { name: list.name }) },
  { name: "list key", run: (model: BuyerWorkspaceTransport) => model.createSavedList(scope, { ...list, idempotencyKey: key }) },
  { name: "padded list name", run: (model: BuyerWorkspaceTransport) => model.createSavedList(scope, { ...list, name: ` ${list.name} ` }) },
  { name: "missing quantity", run: (model: BuyerWorkspaceTransport) => model.upsertSavedListItem(scope, id, { offerId: item }) },
  { name: "string quantity", run: (model: BuyerWorkspaceTransport) => model.upsertSavedListItem(scope, id, { ...line, quantity: "0.500001" }) },
  { name: "zero quantity", run: (model: BuyerWorkspaceTransport) => model.upsertSavedListItem(scope, id, { ...line, quantity: 0 }) },
  { name: "item version", run: (model: BuyerWorkspaceTransport) => model.upsertSavedListItem(scope, id, { ...line, version: 1 }) },
  { name: "padded note", run: (model: BuyerWorkspaceTransport) => model.upsertSavedListItem(scope, id, { ...line, note: ` ${line.note} ` }) },
  { name: "padded comment", run: (model: BuyerWorkspaceTransport) => model.createOrderComment(scope, id, { ...comment, body: ` ${comment.body} ` }) },
  { name: "padded key", run: (model: BuyerWorkspaceTransport) => model.createOrderComment(scope, id, { ...comment, idempotencyKey: ` ${key} ` }) },
  { name: "comment visibility", run: (model: BuyerWorkspaceTransport) => model.createOrderComment(scope, id, { ...comment, visibility: "PARTIES_AND_OPERATOR" }) },
  { name: "comment empty", run: (model: BuyerWorkspaceTransport) => model.createOrderComment(scope, id, { ...comment, body: "" }) },
  { name: "edit expectedVersion", run: (model: BuyerWorkspaceTransport) => model.updateOrderComment(scope, item, { body: edit.body, expectedVersion: 9 }) },
  { name: "edit key", run: (model: BuyerWorkspaceTransport) => model.updateOrderComment(scope, item, { ...edit, idempotencyKey: key }) },
  { name: "edit nonpositive version", run: (model: BuyerWorkspaceTransport) => model.updateOrderComment(scope, item, { ...edit, version: 0 }) },
  { name: "edit padded body", run: (model: BuyerWorkspaceTransport) => model.updateOrderComment(scope, item, { ...edit, body: ` ${edit.body} ` }) },
])("unreviewed/defaulted/invented $name never dispatches", command => {
  const s = setup(); expect(() => command.run(s.model)).toThrow(BuyerWorkspaceTransportError); expect(s.mutate).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled();
});
it.each(["list", "order", "comment"] as const)("invalid %s ID fails before private input getters", kind => {
  const s = setup(), input = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private body"); }); for (const name of ["offerId", "quantity", "body", "idempotencyKey", "version"]) Object.defineProperty(input, name, { get: hidden });
  expect(() => kind === "list" ? s.model.upsertSavedListItem(scope, "../foreign", input) : kind === "order" ? s.model.createOrderComment(scope, "../foreign", input) : s.model.updateOrderComment(scope, "../foreign", input)).toThrow(BuyerWorkspaceTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it("invalid removal item and comment-read IDs cannot reach either source callback", () => {
  const s = setup(); expect(() => s.model.removeSavedListItem(scope, id, "../foreign")).toThrow(BuyerWorkspaceTransportError); expect(() => s.model.orderComments(scope, "../foreign")).toThrow(BuyerWorkspaceTransportError); expect(s.read).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["product", "environment", "organizationId", "userId", "generation"] as const)("foreign %s cannot inspect command input or read source", field => {
  const s = setup(), candidate = { ...scope, [field]: field === "generation" ? scope.generation + 1 : field === "environment" ? "https://other.example.invalid/api" : field === "product" ? "other" : uuid(66004) }, input = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private input"); }); Object.defineProperty(input, "name", { get: hidden });
  expect(() => s.model.createSavedList(candidate as typeof scope, input)).toThrow(BuyerWorkspaceTransportError); expect(() => s.model.savedLists(candidate as typeof scope)).toThrow(BuyerWorkspaceTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["read fulfilled", "read rejected", "write fulfilled", "write rejected"])("late %s is rejected before private response/error fields", async kind => {
  const s = setup(); let yes!: (value: unknown) => void, no!: (value: unknown) => void; const pending = () => new Promise((resolve, reject) => { yes = resolve; no = reject; }); if (kind.startsWith("read")) s.read.mockImplementationOnce(pending); else s.mutate.mockImplementationOnce(pending);
  const work = kind.startsWith("read") ? s.model.savedLists(scope) : s.model.createSavedList(scope, list), raw = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private late fields"); }); for (const field of ["name", "body", "payload", "status", "items"]) Object.defineProperty(raw, field, { get: hidden }); s.live(false); if (kind.endsWith("fulfilled")) yes(raw); else no(raw);
  await expect(work).rejects.toThrow(BuyerWorkspaceTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.read.mock.calls.length + s.mutate.mock.calls.length).toBe(1);
});
it.each([400, 401, 403, 404, 409, "network"] as const)("live %s error retains source identity and never retries or follows a write with GET", async status => {
  const s = setup(), failure = status === "network" ? Error("SYNTHETIC lost") : new MarketHttpError(status, { statusCode: status, message: "SYNTHETIC failure" }); s.mutate.mockRejectedValueOnce(failure); await expect(s.model.createSavedList(scope, list)).rejects.toBe(failure); expect(s.mutate).toHaveBeenCalledTimes(1); expect(s.read).not.toHaveBeenCalled();
  s.read.mockRejectedValueOnce(failure); await expect(s.model.savedLists(scope)).rejects.toBe(failure); expect(s.read).toHaveBeenCalledTimes(1);
});
it("parsed immutable input cannot be changed by caller edits while native request is pending", async () => {
  const s = setup(), input = { ...line }; let yes!: (value: unknown) => void; s.mutate.mockImplementationOnce(() => new Promise(resolve => { yes = resolve; })); const work = s.model.upsertSavedListItem(scope, id, input); input.quantity = 2; input.note = "SYNTHETIC later"; expect(s.mutate.mock.calls[0]![2]).toEqual(line); yes({}); await work;
});
it("closed candidate cannot revive and checks lifetime before command getters", () => {
  const s = setup(), input = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private closed name"); }); Object.defineProperty(input, "name", { get: hidden }); s.model.close(); s.live(true); expect(() => s.model.createSavedList(scope, input)).toThrow(BuyerWorkspaceTransportError); expect(() => s.model.savedLists(scope)).toThrow(BuyerWorkspaceTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it("existing native HTTP transport sends bearer GET/POST/PATCH/DELETE with exact bodies and no invented actor header", async () => {
  const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => "{}" }), http = createMarketTransport(scope.environment, fetcher), model = createBuyerWorkspaceTransport(scope, path => http.request(path, { token: "SYNTHETIC-token" }), (method, path, body) => http.request(path, { method, body, token: "SYNTHETIC-token", csrf: "SYNTHETIC-csrf" }), () => true);
  await model.savedLists(scope); await model.orderComments(scope, id); for (const command of commands) await command.run(model); expect(fetcher).toHaveBeenCalledTimes(7);
  for (const [index, [url, request]] of fetcher.mock.calls.entries()) {
    const command = commands[index - 2]; expect(url).toBe(`${scope.environment}${index === 0 ? "/owner/saved-lists" : index === 1 ? `/trust/orders/${id}/comments` : command!.path}`); expect(request.method).toBe(index < 2 ? "GET" : command!.method);
    if (index < 2 || command!.body === undefined) expect(request.body).toBeUndefined(); else expect(JSON.parse(request.body as string)).toEqual(command!.body);
    const headers = request.headers as Record<string, string>; expect(headers.authorization).toBe("Bearer SYNTHETIC-token"); expect(headers["x-user-id"]).toBeUndefined(); if (index >= 2) expect(headers["x-csrf-token"]).toBe("SYNTHETIC-csrf");
  } model.close();
});
it("existing list-create model keeps a lost non-idempotent result unknown without repeat confirm or GET", async () => {
  const s = setup(), page = savedListCreatePage(), fixture: SavedListCreateFixture = { authorization: { ...savedListCreateAuthorization(), scope }, createSavedList: s.model.createSavedList }, reload = jest.fn(async () => page), model = createSavedListCreateCommands(scope, fixture, () => page, reload, () => true);
  s.mutate.mockRejectedValueOnce(Error("SYNTHETIC list committed response lost")); const rawName = "  SYNTHETIC original список  "; expect(model.start()).toBe(true); model.setName(rawName); model.setDefault(true); expect(model.prepare(page)).toBe(true); await model.confirm();
  expect(model.getSnapshot()).toMatchObject({ phase: "unknown", unresolved: true, rawName, priorUnknown: [{ input: { name: rawName.trim(), isDefault: true } }] }); await model.confirm(); expect(s.mutate).toHaveBeenCalledTimes(1); expect(s.read).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled(); expect(model).not.toHaveProperty("replay"); model.dispose(); s.model.close();
});
it("existing comment model preserves original raw text and key across explicit lost-response replay", async () => {
  const s = setup(), window = commentCreateWindow(), orderId = window.context.orderId, nextKey = jest.fn(() => key), fixture: OrderCommentCreateFixture = { authorization: { ...commentCreateAuthorization(), scope }, nextOrderCommentIdempotencyKey: nextKey, createOrderComment: s.model.createOrderComment }, model = createOrderCommentCreateCommands(scope, fixture, id => id === orderId ? window : null, async () => window, () => true);
  const rawBody = "  SYNTHETIC original comment\nЕкінші жол  "; model.start(window); const form = model.stateFor(orderId).formKey!; model.setBody(orderId, form, rawBody); model.prepare(window); const review = model.stateFor(orderId).review!;
  let receipt: ReturnType<typeof commentCreateResult> | null = null, effects = 0; s.mutate.mockImplementation(async (_method, _path, body) => { if (receipt) return receipt; receipt = commentCreateResult(orderId, body as CreateOrderCommentInput); effects++; throw Error("SYNTHETIC comment committed response lost"); });
  expect(nextKey).not.toHaveBeenCalled(); await model.confirm(orderId, review); expect(model.stateFor(orderId)).toMatchObject({ phase: "unknown", rawBody, unresolved: true }); expect(s.mutate).toHaveBeenCalledTimes(1); await model.replay(orderId); expect(model.stateFor(orderId).phase).toBe("receipt"); expect(nextKey).toHaveBeenCalledTimes(1); expect(effects).toBe(1); expect(s.mutate.mock.calls[1]).toEqual(s.mutate.mock.calls[0]); expect(s.read).not.toHaveBeenCalled(); model.dispose(); s.model.close();
});
