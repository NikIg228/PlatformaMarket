import { createSupportReplyCommands } from "./support-reply-command-fixture";
import { createSupportReplyDrafts } from "./support-reply-draft";
import { addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import type { SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { SupportCommandFixture, AddSupportInput } from "./support-command-fixture";
import { commandScope, syntheticSupportAuthorization, replyCommandText, postedSupportMessage, commandEnvelope } from "./test-fixtures/support-commands";
import { supportDetail, supportId } from "./test-fixtures/support";
function setup() {
  let ticket: SupportTicketDetail | null = supportDetail(), counter = 2000;
  const draft = createSupportReplyDrafts(commandScope); draft.syncTicket(ticket); const target = draft.begin(ticket)!;
  const send = jest.fn(async (_scope: typeof commandScope, id: string, input: AddSupportInput): Promise<unknown> => postedSupportMessage(id, input)), key = jest.fn(() => supportId(++counter));
  const fixture: SupportCommandFixture = { authorization: syntheticSupportAuthorization(), nextIdempotencyKey: key, addSupportMessage: send };
  const model = createSupportReplyCommands(commandScope, fixture, draft, () => ticket);
  const setTicket = (next: SupportTicketDetail | null) => { ticket = next; if (next) draft.syncTicket(next); };
  return { draft, target, send, key, fixture, model, setTicket, fill: () => draft.setText(target, replyCommandText) };
}
it.each(["permission", "organizationId", "userId", "environment", "generation", "operator"])("requires explicit source authorization for public message: %s", async field => {
  const s = setup(); s.fill(); if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else if (field === "operator") s.fixture.authorization = { ...s.fixture.authorization, operator: true } as never; else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...commandScope, [field]: field === "generation" ? 99 : field === "environment" ? "other" : supportId(99) } };
  await s.model.submit(s.target); expect(s.send).not.toHaveBeenCalled(); expect(s.key).not.toHaveBeenCalled();
});
it.each(["different-ticket", "foreign-org", "older-version", "closed", "no-current"])("does not start from an unbound/non-current/terminal source: %s", async source => {
  const s = setup(); s.fill(); s.setTicket(source === "no-current" ? null : supportDetail(source === "different-ticket" ? { id: supportId(99) } : source === "foreign-org" ? { organizationId: supportId(99) } : source === "older-version" ? { version: 2 } : { status: "CLOSED" }));
  await s.model.submit(s.target); expect(s.send).not.toHaveBeenCalled(); expect(s.key).not.toHaveBeenCalled();
});
it("validates body before key allocation, sends exactly the actual public command and accepts only returned server message", async () => {
  const s = setup(); await s.model.submit(s.target); expect(s.key).not.toHaveBeenCalled(); s.fill(); await s.model.submit(s.target);
  const [scope, id, input] = s.send.mock.calls[0]!; expect(scope).toEqual(commandScope); expect(id).toBe(s.target.id); expect(input).toEqual(addSupportMessageSchema.parse({ idempotencyKey: input.idempotencyKey, body: replyCommandText, isInternal: false, attachments: [] })); expect(Object.keys(input).sort()).toEqual(["attachments", "body", "idempotencyKey", "isInternal"]); expect(input).not.toHaveProperty("expectedVersion"); expect(input).not.toHaveProperty("reopen"); expect(Object.isFrozen(input)).toBe(true); expect(Object.isFrozen(input.attachments)).toBe(true);
  expect(s.model.stateFor(s.target)).toMatchObject({ phase: "success", value: { body: replyCommandText.trim(), ticketId: s.target.id, authorId: commandScope.userId } }); expect(s.draft.entryFor(s.target)?.body).toBe(replyCommandText);
});
it("blocks duplicate sends, never replaces unknown keys, and retries the original input across a newer ticket version", async () => {
  const s = setup(); s.fill(); let fail!: (error: unknown) => void; s.send.mockImplementationOnce(() => new Promise((_yes, no) => { fail = no; })); const pending = s.model.submit(s.target); await s.model.submit(s.target); expect(s.send).toHaveBeenCalledTimes(1); fail(new Error("timeout")); await pending; expect(s.model.stateFor(s.target).phase).toBe("unknown");
  s.setTicket(supportDetail({ version: 4 })); const next = s.draft.begin(supportDetail({ version: 4 }))!; s.draft.setText(next, "SYNTHETIC new draft"); await s.model.submit(next); expect(s.key).toHaveBeenCalledTimes(1); expect(s.model.previewFor(next)).toBe(replyCommandText.trim());
  const replay = s.model.retry(next); await s.model.retry(next); await replay; expect(s.send).toHaveBeenCalledTimes(2); expect(s.send.mock.calls[1]![2]).toBe(s.send.mock.calls[0]![2]); expect(s.model.stateFor(next).phase).toBe("success"); expect(s.draft.entryFor(next)?.body).toBe("SYNTHETIC new draft");
});
it.each([400, 401, 403, 404, 409])("preserves raw reply on definitive %s and reuses the same key when unchanged", async status => {
  const s = setup(); s.fill(); s.send.mockRejectedValueOnce(commandEnvelope(status)); await s.model.submit(s.target); expect(s.model.stateFor(s.target).phase).toBe("rejected"); expect(s.draft.entryFor(s.target)?.body).toBe(replyCommandText); await s.model.retry(s.target); expect(s.key).toHaveBeenCalledTimes(1); expect(s.send.mock.calls[1]![2]).toBe(s.send.mock.calls[0]![2]);
});
it.each(["ticketId", "authorId", "isInternal"] as const)("checks returned %s before reading any message body", async field => {
  const s = setup(); s.fill(); const hidden = jest.fn(() => { throw new Error("Unbound message body read"); }); s.send.mockImplementationOnce(async (_scope, id, input) => { const value = { ...postedSupportMessage(id, input), [field]: field === "isInternal" ? true : supportId(99) }; Object.defineProperty(value, "body", { get: hidden }); return value; });
  await s.model.submit(s.target); expect(s.model.stateFor(s.target).phase).toBe("invalid-result"); expect(hidden).not.toHaveBeenCalled(); expect(s.model.isLocked(s.target)).toBe(true);
});
it("does not inspect unexpected attachment descriptors or accept mismatched message text", async () => {
  const s = setup(); s.fill(); const hidden = jest.fn(() => { throw new Error("Unrequested file descriptor read"); }), file = {}; Object.defineProperty(file, "assetId", { get: hidden });
  s.send.mockImplementationOnce(async (_scope, id, input) => ({ ...postedSupportMessage(id, input), attachments: [file] })); await s.model.submit(s.target); expect(s.model.stateFor(s.target).phase).toBe("invalid-result"); expect(hidden).not.toHaveBeenCalled();
  s.send.mockImplementationOnce(async (_scope, id, input) => ({ ...postedSupportMessage(id, input), body: "different body" })); await s.model.retry(s.target); expect(s.model.stateFor(s.target).phase).toBe("invalid-result"); expect(s.key).toHaveBeenCalledTimes(1);
});
it("does not retry a retained attempt from another current ticket and keeps per-ticket states isolated", async () => {
  const s = setup(); s.fill(); s.send.mockRejectedValueOnce(new Error("timeout")); await s.model.submit(s.target); const other = supportDetail({ id: supportId(90) }); s.setTicket(other); const otherTarget = s.draft.begin(other)!;
  await s.model.retry(s.target); expect(s.send).toHaveBeenCalledTimes(1); expect(s.model.stateFor(otherTarget).phase).toBe("idle"); s.setTicket(supportDetail()); await s.model.retry(s.target); expect(s.model.stateFor(s.target).phase).toBe("success");
});
it.each(["dispose", "read-denial", "permission-loss", "draft-cancel"])("does not decode or apply late messages after %s", async reason => {
  const s = setup(); s.fill(); let finish!: (body: unknown) => void; s.send.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = s.model.submit(s.target);
  if (reason === "dispose") s.model.dispose(); else if (reason === "read-denial") s.model.denyTicket(s.target.id); else if (reason === "draft-cancel") s.draft.cancel(s.target); else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  const hidden = jest.fn(() => { throw new Error("Late reply result decoded"); }), body = {}; Object.defineProperty(body, "id", { get: hidden }); finish(body); await pending; expect(hidden).not.toHaveBeenCalled(); expect(s.model.stateFor(s.target).phase).not.toBe("success");
});
it("uses a new key only after editing a definite rejection and rejects key reuse across ticket IDs", async () => {
  const s = setup(); s.fill(); s.send.mockRejectedValueOnce(commandEnvelope(400)); await s.model.submit(s.target); s.draft.setText(s.target, "SYNTHETIC corrected reply"); expect(s.model.canRetry(s.target)).toBe(false); await s.model.submit(s.target); expect(s.key).toHaveBeenCalledTimes(2);
  const used = s.send.mock.calls[1]![2].idempotencyKey, other = supportDetail({ id: supportId(90) }); s.setTicket(other); const target = s.draft.begin(other)!; s.draft.setText(target, "SYNTHETIC other reply"); s.key.mockReturnValue(used); await s.model.submit(target); expect(s.model.stateFor(target)).toEqual({ phase: "rejected", issue: "key" }); expect(s.send).toHaveBeenCalledTimes(2);
});
it("replays one committed fake message after a lost response without fabricating another message/version", async () => {
  const s = setup(); s.fill(); const records = new Map<string, { json: string; value: unknown }>(); let executions = 0;
  s.send.mockImplementation(async (scope, id, input) => { const key = `support.message:${scope.organizationId}:${scope.userId}:${input.idempotencyKey}`, json = JSON.stringify({ ticketId: id, ...input }), saved = records.get(key); if (saved) { if (saved.json !== json) throw commandEnvelope(409); return saved.value; } executions++; const value = postedSupportMessage(id, input); records.set(key, { json, value }); throw new Error("SYNTHETIC committed response lost"); });
  await s.model.submit(s.target); expect(s.model.stateFor(s.target).phase).toBe("unknown"); s.setTicket(supportDetail({ version: 4, status: "CLOSED" })); await s.model.retry(s.target); expect(s.model.stateFor(s.target).phase).toBe("success"); expect(executions).toBe(1); expect(s.key).toHaveBeenCalledTimes(1); expect(s.draft.getSnapshot().entries[s.target.id]?.target.version).toBe(4);
});
