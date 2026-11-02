import type { ReadScope } from "./read-controller";
import { createSupportCreateCommand, type SupportCommandFixture, type CreateSupportInput } from "./support-command-fixture";
import { createSupportTicketDraft } from "./support-ticket-draft";
import { createSupportTicketSchema } from "../../../packages/schemas/src/commercial";
import { commandScope, syntheticSupportAuthorization, commandFields, createdTicket, commandEnvelope } from "./test-fixtures/support-commands";
import { supportId } from "./test-fixtures/support";
function setup() {
  const draft = createSupportTicketDraft(commandScope); draft.setReadAccess(commandScope, true); draft.begin();
  const create = jest.fn(async (_scope: ReadScope, input: CreateSupportInput): Promise<unknown> => createdTicket(input));
  let counter = 1000; const key = jest.fn(() => supportId(++counter));
  const fixture: SupportCommandFixture = { authorization: syntheticSupportAuthorization(), nextIdempotencyKey: key, createSupportTicket: create };
  const model = createSupportCreateCommand(commandScope, fixture, draft);
  const fill = () => { for (const name of ["subject", "description", "category"] as const) draft.setText(name, commandFields[name]); };
  return { draft, create, key, fixture, model, fill };
}
it.each(["absent", "permission", "operator", "provenance", "organizationId", "userId", "environment", "generation"])("requires an explicit matching synthetic permission context: %s", async field => {
  const s = setup(); s.fill();
  if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  else if (field === "operator") s.fixture.authorization = { ...s.fixture.authorization, operator: true } as never;
  else if (field === "provenance") s.fixture.authorization = { ...s.fixture.authorization, provenance: "production" } as never;
  else if (field !== "absent") s.fixture.authorization = { ...s.fixture.authorization, scope: { ...commandScope, [field]: field === "generation" ? 99 : field === "environment" ? "other" : supportId(99) } };
  const model = createSupportCreateCommand(commandScope, field === "absent" ? undefined : s.fixture, s.draft); expect(model.isAvailable()).toBe(false); await model.submit(); expect(s.key).not.toHaveBeenCalled(); expect(s.create).not.toHaveBeenCalled();
});
it("validates local fields before key allocation and emits only the actual normalized complete create contract", async () => {
  const s = setup(); await s.model.submit(); expect(s.key).not.toHaveBeenCalled(); s.fill(); await s.model.submit();
  const [scope, input] = s.create.mock.calls[0]!; expect(scope).toEqual(commandScope); expect(Object.isFrozen(scope)).toBe(true);
  expect(input).toEqual(createSupportTicketSchema.parse({ ...commandFields, links: [], idempotencyKey: input.idempotencyKey })); expect(Object.keys(input).sort()).toEqual(["category", "description", "idempotencyKey", "links", "priority", "subject"]); expect(Object.isFrozen(input)).toBe(true); expect(Object.isFrozen(input.links)).toBe(true);
  expect(s.draft.getSnapshot().values.description).toBe(commandFields.description); expect(s.model.getSnapshot()).toMatchObject({ phase: "success", value: { number: "SYNTHETIC-CREATED-330" } });
});
it("locks duplicate clicks while pending, retains unknown outcome and replays the identical key/input object", async () => {
  const s = setup(); s.fill(); let finish!: (value: unknown) => void; s.create.mockImplementationOnce(() => new Promise(yes => { finish = yes; }));
  const pending = s.model.submit(); await s.model.submit(); expect(s.key).toHaveBeenCalledTimes(1); expect(s.create).toHaveBeenCalledTimes(1); expect(s.model.getSnapshot().phase).toBe("pending");
  finish(Promise.reject(new Error("synthetic timeout"))); await pending; expect(s.model.getSnapshot().phase).toBe("unknown"); await s.model.submit(); expect(s.key).toHaveBeenCalledTimes(1);
  const original = s.create.mock.calls[0]![1]; const replay = s.model.retry(); await s.model.retry(); await replay; expect(s.create).toHaveBeenCalledTimes(2); expect(s.create.mock.calls[1]![1]).toBe(original); expect(s.model.getSnapshot().phase).toBe("success"); expect(s.key).toHaveBeenCalledTimes(1);
});
it.each([400, 401, 403, 404, 409])("retains raw input after definitive source %s rejection and preserves same-key retry", async status => {
  const s = setup(); s.fill(); s.create.mockRejectedValueOnce(commandEnvelope(status)); await s.model.submit(); expect(s.model.getSnapshot().phase).toBe("rejected"); expect(s.model.isLocked()).toBe(false); expect(s.draft.getSnapshot().values).toEqual(commandFields);
  const input = s.create.mock.calls[0]![1]; await s.model.retry(); expect(s.create.mock.calls[1]![1]).toBe(input); expect(s.key).toHaveBeenCalledTimes(1);
});
it.each([new Error("timeout"), commandEnvelope(500), { status: 400, payload: {} }])("does not turn an uncertain result into success or allocate a replacement key", async error => {
  const s = setup(); s.fill(); s.create.mockRejectedValueOnce(error); await s.model.submit(); expect(s.model.getSnapshot().phase).toBe("unknown"); s.draft.setText("subject", "SYNTHETIC edited while unknown"); await s.model.submit(); expect(s.create).toHaveBeenCalledTimes(1); await s.model.retry(); expect(s.key).toHaveBeenCalledTimes(1); expect(s.create.mock.calls[1]![1]).toBe(s.create.mock.calls[0]![1]);
});
it.each(["organizationId", "requesterId"] as const)("checks returned %s before reading title or private content", async field => {
  const s = setup(); s.fill(); const hidden = jest.fn(() => { throw new Error("Foreign response content read"); }); s.create.mockImplementationOnce(async (_scope, input) => { const value = { ...createdTicket(input), [field]: supportId(99) }; Object.defineProperty(value, "subject", { get: hidden }); return value; });
  await s.model.submit(); expect(s.model.getSnapshot().phase).toBe("invalid-result"); expect(hidden).not.toHaveBeenCalled(); expect(s.model.isLocked()).toBe(true); await s.model.submit(); expect(s.key).toHaveBeenCalledTimes(1);
});
it("rejects malformed or payload-mismatched success without manufacturing a local ticket", async () => {
  const s = setup(); s.fill(); s.create.mockResolvedValueOnce({ id: supportId(1) } as never); await s.model.submit(); expect(s.model.getSnapshot().phase).toBe("invalid-result"); s.create.mockImplementationOnce(async (_scope, input) => ({ ...createdTicket(input), subject: "different subject" })); await s.model.retry(); expect(s.model.getSnapshot().phase).toBe("invalid-result"); expect(s.draft.getSnapshot().values).toEqual(commandFields);
});
it.each(["dispose", "read-context-loss", "permission-loss"])("drops late results before decoding on %s", async reason => {
  const s = setup(); s.fill(); let finish!: (body: unknown) => void; s.create.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = s.model.submit();
  if (reason === "dispose") s.model.dispose(); else if (reason === "read-context-loss") s.draft.setReadAccess(commandScope, false); else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  const hidden = jest.fn(() => { throw new Error("Late content decoded"); }), value = {}; Object.defineProperty(value, "id", { get: hidden }); finish(value); await pending; expect(hidden).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).not.toBe("success");
});
it("allocates a new key only for an explicitly changed, definitively rejected request", async () => {
  const s = setup(); s.fill(); s.create.mockRejectedValueOnce(commandEnvelope(400)); await s.model.submit(); s.draft.setText("subject", "SYNTHETIC corrected subject"); expect(s.model.canRetry()).toBe(false); await s.model.retry(); expect(s.create).toHaveBeenCalledTimes(1); await s.model.submit(); expect(s.key).toHaveBeenCalledTimes(2); expect(s.create.mock.calls[1]![1].idempotencyKey).not.toBe(s.create.mock.calls[0]![1].idempotencyKey);
});
it("requires explicit new-draft action after success and refuses provider key reuse", async () => {
  const s = setup(); s.fill(); s.key.mockReturnValue(supportId(1001)); await s.model.submit(); await s.model.submit(); expect(s.create).toHaveBeenCalledTimes(1); s.model.startNew(); expect(s.draft.getSnapshot().values.subject).toBe(""); s.fill(); await s.model.submit(); expect(s.model.getSnapshot()).toEqual({ phase: "rejected", issue: "key" }); expect(s.create).toHaveBeenCalledTimes(1); expect(s.model.canRetry()).toBe(false);
});
it("recovers the original result after a fake server committed once but the first response was lost", async () => {
  const s = setup(); s.fill(); const records = new Map<string, { json: string; value: unknown }>(); let executions = 0, loseFirst = true;
  s.create.mockImplementation(async (scope, input) => {
    const scopedKey = `support.create:${scope.organizationId}:${scope.userId}:${input.idempotencyKey}`, json = JSON.stringify(input), existing = records.get(scopedKey);
    if (existing) { if (existing.json !== json) throw commandEnvelope(409); return existing.value; }
    executions++; const value = createdTicket(input); records.set(scopedKey, { json, value });
    if (loseFirst) { loseFirst = false; throw new Error("SYNTHETIC committed response lost"); } return value;
  });
  await s.model.submit(); expect(s.model.getSnapshot().phase).toBe("unknown"); expect(executions).toBe(1); await s.model.retry(); expect(s.model.getSnapshot().phase).toBe("success"); expect(executions).toBe(1); expect(s.key).toHaveBeenCalledTimes(1);
});

it.each([400,404,409])("known replay%s preserves earlier unknown creation and the original request/key",async status=>{const s=setup();s.fill();s.create.mockRejectedValueOnce(Error("lost creation response"));await s.model.submit();s.create.mockRejectedValueOnce(commandEnvelope(status));await s.model.retry();expect(s.model.getSnapshot().phase).toBe("unknown");expect(s.model.isLocked()).toBe(true);await s.model.submit();expect(s.key).toHaveBeenCalledTimes(1);expect(s.create.mock.calls[1]![1]).toBe(s.create.mock.calls[0]![1]);await s.model.retry();expect(s.model.getSnapshot().phase).toBe("success");});
it("peer grant denial while creating hides the attempt and preserves uncertainty before late decoding",async()=>{const s=setup();s.fill();let finish!:(value:unknown)=>void;s.create.mockImplementationOnce(()=>new Promise(yes=>{finish=yes;}));const work=s.model.submit();s.model.denyAccess();const hidden=jest.fn(()=>{throw Error("denied create result");}),body={};Object.defineProperty(body,"id",{get:hidden});finish(body);await work;expect(hidden).not.toHaveBeenCalled();expect(s.model.getSnapshot().phase).toBe("unknown");expect(s.model.isAvailable()).toBe(false);await s.model.retry();expect(s.create).toHaveBeenCalledTimes(1);});
