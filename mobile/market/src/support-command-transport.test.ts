import { jest } from "@jest/globals";
import { createSupportCommandTransport } from "./support-command-transport";
import { createConversationCommandTransport } from "./conversation-command-transport";
import { commandScope, commandFields } from "./test-fixtures/support-commands";
import { supportId } from "./test-fixtures/support";
import { createSupportTicketSchema } from "../../../packages/schemas/src/commercial";

const scope = { ...commandScope, environment: "https://market.example.invalid/api" };
const request = () => createSupportTicketSchema.parse({ ...commandFields, links: [], idempotencyKey: supportId(339) });
afterEach(() => jest.restoreAllMocks());
it("creates only the normalized no-file/no-link source subset once, preserving raw response identity", async () => {
  const result = Object.freeze({ source: true }), post = jest.fn(async (_path: string, _body: Readonly<object>) => result), raw = createSupportCommandTransport(scope, post, () => true), input = request();
  try { expect(await raw.create(scope, input)).toBe(result); expect(post).toHaveBeenCalledTimes(1); const [path, body] = post.mock.calls[0]!; expect(path).toBe("/support/tickets"); expect(body).toEqual(input); expect(Object.isFrozen(body)).toBe(true); expect(Object.isFrozen((body as typeof input).links)).toBe(true); expect(body).not.toHaveProperty("attachments"); } finally { raw.close(); }
});
it("public reply reuses the existing factory's exact method path and prepared input", async () => {
  const calls: { path: string; body: Readonly<object> }[] = [], post = async (path: string, body: Readonly<object>) => { calls.push({ path, body }); return null; }, current = () => true, raw = createSupportCommandTransport(scope, post, current), original = createConversationCommandTransport(scope, post, current);
  const body = { idempotencyKey: supportId(339), body: "SYNTHETIC public reply", isInternal: false, attachments: [] };
  try { await raw.publicReply(scope, supportId(60), body); await original.supportReply(scope, supportId(60), body); expect(calls[0]).toEqual(calls[1]); } finally { raw.close(); original.close(); }
});
it.each(["subject", "description", "category"] as const)("noncanonical %s cannot be silently normalized by the transport", async field => {
  const post = jest.fn(async () => null), raw = createSupportCommandTransport(scope, post, () => true), input = request(); input[field] = "  " + input[field] + "  ";
  try { await expect(raw.create(scope, input)).rejects.toMatchObject({ code: "input" }); expect(post).not.toHaveBeenCalled(); } finally { raw.close(); }
});
it.each(["attachments", "headers", "organizationId", "requesterId", "reopen"])("unexpected %s does not expand the source form subset", async field => {
  const post = jest.fn(async () => null), raw = createSupportCommandTransport(scope, post, () => true);
  try { await expect(raw.create(scope, { ...request(), [field]: field === "attachments" ? [] : "SENSITIVE" })).rejects.toMatchObject({ code: "input" }); expect(post).not.toHaveBeenCalled(); } finally { raw.close(); }
});
it.each([null, [], {}, { idempotencyKey: "SENSITIVE" }, { priority: "CUSTOM" }, { links: [{ entityType: "ORDER", entityId: supportId(9) }] }])("invalid or outside-subset create input remains local: %p", async changed => {
  const post = jest.fn(async () => null), raw = createSupportCommandTransport(scope, post, () => true);
  try { const input = changed && !Array.isArray(changed) ? { ...request(), ...changed } : changed; if (changed && Object.keys(changed).length === 0 && !Array.isArray(changed)) await expect(raw.create(scope, changed)).rejects.toMatchObject({ code: "input" }); else await expect(raw.create(scope, input)).rejects.toMatchObject({ code: "input" }); expect(post).not.toHaveBeenCalled(); } finally { raw.close(); }
});
it.each(["create", "publicReply"] as const)("%s rejects a changed scope before reading command text", async method => {
  for (const field of ["product", "environment", "userId", "organizationId", "generation"] as const) {
    const post = jest.fn(async () => null), raw = createSupportCommandTransport(scope, post, () => true), input = request(), getter = jest.fn(() => { throw Error("SENSITIVE late field"); }); Object.defineProperty(input, "subject", { get: getter });
    const candidate = { ...scope, [field]: field === "generation" ? 2 : field === "environment" ? "https://other.invalid/api" : field === "product" ? "ecosystem" : supportId(99) } as typeof scope;
    try { await expect((async () => method === "create" ? raw.create(candidate, input) : raw.publicReply(candidate, supportId(60), input))()).rejects.toThrow(/context is unavailable/); expect(getter).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled(); } finally { raw.close(); }
  }
});
it.each(["create", "publicReply"] as const)("closing %s while pending rejects late success and prevents another call", async method => {
  let finish!: (value: unknown) => void; const post = jest.fn(() => new Promise<unknown>(resolve => { finish = resolve; })), raw = createSupportCommandTransport(scope, post, () => true);
  const input = method === "create" ? request() : { idempotencyKey: supportId(339), body: "SYNTHETIC", isInternal: false, attachments: [] }, invoke = () => method === "create" ? raw.create(scope, input) : raw.publicReply(scope, supportId(60), input);
  const work = invoke(); raw.close(); finish({ private: "SENSITIVE" }); await expect(work).rejects.toThrow(/context is unavailable/); await expect((async () => invoke())()).rejects.toThrow(/context is unavailable/); expect(post).toHaveBeenCalledTimes(1);
});
it("scope invalidated synchronously by request getter cannot dispatch create", async () => {
  let current = true; const post = jest.fn(async () => null), raw = createSupportCommandTransport(scope, post, () => current), input = request(), subject = input.subject; Object.defineProperty(input, "subject", { get: () => { current = false; return subject; } });
  try { await expect(raw.create(scope, input)).rejects.toMatchObject({ code: "scope" }); expect(post).not.toHaveBeenCalled(); } finally { raw.close(); }
});
it("unexpired source scope preserves raw failure without retry", async () => {
  const failure = Object.freeze({ status: 500, payload: { private: "SENSITIVE" } }), post = jest.fn(async () => { throw failure; }), raw = createSupportCommandTransport(scope, post, () => true);
  try { await expect(raw.create(scope, request())).rejects.toBe(failure); expect(post).toHaveBeenCalledTimes(1); } finally { raw.close(); }
});
