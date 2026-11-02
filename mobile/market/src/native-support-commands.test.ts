import { createNativeSupportCommands, nativeSupportAvailable } from "./native-support-commands";
import { createMarketSession } from "./market-session";
import type { ReadScope } from "./read-controller";
import { api, response, server, deferred } from "./test-fixtures/market-session";
import { listDraftScope, listDraftId as id } from "./test-fixtures/list-draft";
import { commandEnvelope } from "./test-fixtures/support-commands";
const scope: ReadScope = { ...listDraftScope, environment: api }, ticketId = id(124001), key = id(124002);
const create = (idempotencyKey = key) => ({ idempotencyKey, subject: "SYNTHETIC native support", description: "SYNTHETIC native support description", category: "GENERAL", priority: "NORMAL" as const, links: [] });
const reply = (idempotencyKey = key) => ({ idempotencyKey, body: "SYNTHETIC native public reply", isInternal: false, attachments: [] });
function setup(entropy = true) { const post = jest.fn(async (_path: string, _body: Readonly<object>): Promise<unknown> => ({})), uuid = jest.fn(() => key), binding = createNativeSupportCommands(scope, post, entropy ? { randomUUID: uuid } : {}, () => true); return { post, uuid, binding, port: binding.port }; }
it.each(["create", "reply"] as const)("sends only explicit canonical source support %s without synthetic permission metadata", async kind => {
  const s = setup(); expect(s.post).not.toHaveBeenCalled(); expect(s.uuid).not.toHaveBeenCalled(); expect(nativeSupportAvailable(s.port, scope)).toBe(true); const issued = s.port.nextIdempotencyKey();
  await (kind === "create" ? s.port.createSupportTicket(scope, create(issued)) : s.port.addSupportMessage(scope, ticketId, reply(issued)));
  expect(s.post.mock.calls).toEqual([[kind === "create" ? "/support/tickets" : `/support/tickets/${ticketId}/messages`, kind === "create" ? create() : reply()]]); expect("authorization" in s.port).toBe(false); expect(s.uuid).toHaveBeenCalledTimes(1); s.binding.close();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("blocks changed support %s before network", async field => {
  const s = setup(), wrong = { ...scope, [field]: field === "generation" ? 2 : "SYNTHETIC_OTHER" } as ReadScope; expect(nativeSupportAvailable(s.port, wrong)).toBe(false);
  await expect(s.port.createSupportTicket(wrong, create())).rejects.toMatchObject({ code: "scope" }); await expect(s.port.addSupportMessage(wrong, ticketId, reply())).rejects.toMatchObject({ code: "scope" }); expect(s.post).not.toHaveBeenCalled(); s.binding.close();
});
it("blocks support commands without installed UUID capability or with an unissued key", async () => {
  const s = setup(false); expect(nativeSupportAvailable(s.port, scope)).toBe(false); expect(() => s.port.nextIdempotencyKey()).toThrow(); await expect(s.port.createSupportTicket(scope, create())).rejects.toMatchObject({ code: "key" }); expect(s.post).not.toHaveBeenCalled(); s.binding.close();
});
it("rejects internal notes, reopen, attachments, links and noncanonical fields before POST", async () => {
  const s = setup(); s.port.nextIdempotencyKey();
  await expect(s.port.addSupportMessage(scope, ticketId, { ...reply(), isInternal: true })).rejects.toMatchObject({ code: "input" });
  await expect(s.port.addSupportMessage(scope, ticketId, { ...reply(), reopen: true })).rejects.toMatchObject({ code: "input" });
  await expect(s.port.addSupportMessage(scope, ticketId, { ...reply(), attachments: [id(124003)] } as unknown as Parameters<typeof s.port.addSupportMessage>[2])).rejects.toMatchObject({ code: "input" });
  await expect(s.port.createSupportTicket(scope, { ...create(), links: [{ entityType: "ORDER", entityId: id(124004) }] })).rejects.toMatchObject({ code: "input" });
  await expect(s.port.createSupportTicket(scope, { ...create(), subject: " SYNTHETIC raw " })).rejects.toMatchObject({ code: "input" });
  await expect(s.port.addSupportMessage(scope, "../ticket", reply())).rejects.toMatchObject({ code: "input" }); expect(s.post).not.toHaveBeenCalled(); s.binding.close();
});
it.each(["create", "reply"] as const)("pins original support %s through lost response and explicit same-key replay", async kind => {
  const s = setup(); s.port.nextIdempotencyKey(); s.post.mockRejectedValueOnce(commandEnvelope(500)); const run = () => kind === "create" ? s.port.createSupportTicket(scope, create()) : s.port.addSupportMessage(scope, ticketId, reply());
  await expect(run()).rejects.toMatchObject({ status: 500 }); expect(s.post).toHaveBeenCalledTimes(1);
  await expect(kind === "create" ? s.port.createSupportTicket(scope, { ...create(), description: "SYNTHETIC changed text" }) : s.port.addSupportMessage(scope, ticketId, { ...reply(), body: "SYNTHETIC changed text" })).rejects.toMatchObject({ code: "input" });
  await expect(kind === "create" ? s.port.addSupportMessage(scope, ticketId, reply()) : s.port.addSupportMessage(scope, id(124005), reply())).rejects.toMatchObject({ code: "input" });
  await run(); expect(s.post.mock.calls[1]).toEqual(s.post.mock.calls[0]); expect(s.uuid).toHaveBeenCalledTimes(1); s.binding.close();
});
it("discards late support data and closes request/key capability", async () => {
  const s = setup(), pending = deferred<unknown>(); s.port.nextIdempotencyKey(); s.post.mockImplementationOnce(() => pending.promise); const work = s.port.createSupportTicket(scope, create()); s.binding.close(); pending.resolve({ private: "SYNTHETIC private late ticket" }); await expect(work).rejects.toMatchObject({ code: "scope" }); expect(nativeSupportAvailable(s.port, scope)).toBe(false); expect(() => s.port.nextIdempotencyKey()).toThrow();
});
it.each(["create", "reply"] as const)("does not refresh or replay support %s after business401", async kind => {
  const path = kind === "create" ? "/support/tickets" : `/support/tickets/${ticketId}/messages`, fetcher = server(route => route === path ? response(commandEnvelope(401).payload, 401) : undefined), manager = createMarketSession(api, fetcher, Date.now, { randomUUID: () => key });
  await manager.start(); const session = manager.getSnapshot().session!, port = session.client.nativeSupportCommands!, issued = port.nextIdempotencyKey();
  await expect(kind === "create" ? port.createSupportTicket(session.scope, create(issued)) : port.addSupportMessage(session.scope, ticketId, reply(issued))).rejects.toBeDefined(); expect(fetcher.mock.calls.filter(([url]) => url.endsWith(path))).toHaveLength(1); expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); expect(manager.getSnapshot().phase).toBe("signed-out");
});
