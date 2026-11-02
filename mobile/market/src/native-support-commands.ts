import { z } from "zod";
import { addSupportMessageSchema, createSupportTicketSchema } from "../../../packages/schemas/src/commercial";
import { createSupportCommandTransport } from "./support-command-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { SupportCommandFixture, AddSupportInput, CreateSupportInput } from "./support-command-fixture";
import type { ReadScope } from "./read-controller";
export type NativeSupportCommands = Readonly<Required<Omit<SupportCommandFixture, "authorization">> & {
  available: (scope: ReadScope) => boolean;
  canIssueKey: (scope: ReadScope) => boolean;
  /** Existing own-ticket public message with explicit reopen=true; no support-manage grant. */
  reopenWithMessage?: (scope: ReadScope, ticketId: string, input: NativeSupportReopenInput) => Promise<unknown>;
}>;
export type NativeSupportClient = { nativeSupportCommands?: NativeSupportCommands };
export class NativeSupportError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super("Support request is unavailable"); this.name = "NativeSupportError"; }
}
const createInput = createSupportTicketSchema.pick({ idempotencyKey: true, subject: true, description: true, category: true }).extend({ priority: createSupportTicketSchema.shape.priority.unwrap(), links: z.tuple([]) }).strict();
const replyInput = z.object({ idempotencyKey: addSupportMessageSchema.shape.idempotencyKey, body: addSupportMessageSchema.shape.body, isInternal: z.literal(false), attachments: z.tuple([]) }).strict().refine(value => value.body.length > 0);
const reopenInput = replyInput.safeExtend({ reopen: z.literal(true) });
export type NativeSupportReopenInput = Readonly<z.output<typeof reopenInput>>;
/** Existing own general-support/text-only routes. Request/key capability never represents a permission receipt. */
export function createNativeSupportCommands(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeSupportError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>(), transport = createSupportCommandTransport(scope, postOnce, isCurrent);
  const pinned = new Map<string, Readonly<{ kind: "create" | "reply" | "reopen"; target: string | null; bytes: string; body: CreateSupportInput | AddSupportInput }>>();
  const send = async (candidate: ReadScope, kind: "create" | "reply" | "reopen", target: string | null, input: CreateSupportInput | AddSupportInput) => {
    lifetime.assert(candidate); let body: CreateSupportInput | AddSupportInput;
    try {
      if (target !== null) z.uuid().parse(target);
      if (kind === "create") { const parsed = createInput.parse(input); if ((["subject", "description", "category", "idempotencyKey"] as const).some(field => parsed[field] !== (input as CreateSupportInput)[field])) throw Error("input"); Object.freeze(parsed.links); body = Object.freeze(parsed); }
      else { const parsed = (kind === "reopen" ? reopenInput : replyInput).parse(input); if (parsed.body !== (input as AddSupportInput).body || parsed.idempotencyKey !== input.idempotencyKey) throw Error("input"); Object.freeze(parsed.attachments); body = Object.freeze(parsed); }
    } catch { throw new NativeSupportError("input"); }
    lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeSupportError("key");
    const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey); if (prior && (prior.kind !== kind || prior.target !== target || prior.bytes !== bytes)) throw new NativeSupportError("input");
    const attempt = prior ?? Object.freeze({ kind, target, bytes, body }); if (!prior) pinned.set(body.idempotencyKey, attempt);
    try { const result = await (kind === "create" ? transport.create(candidate, attempt.body) : kind === "reopen" ? postOnce(`/support/tickets/${encodeURIComponent(target!)}/messages`, attempt.body) : transport.publicReply(candidate, target!, attempt.body)); lifetime.assert(candidate); return result; }
    catch (error) { lifetime.assert(candidate); throw error; }
  };
  const port: NativeSupportCommands = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueKey: keys.canIssue,
    nextIdempotencyKey() { lifetime.assert(lifetime.owner); const key = keys.next(lifetime.owner); lifetime.assert(lifetime.owner); issued.add(key); return key; },
    createSupportTicket: (candidate, input) => send(candidate, "create", null, input),
    addSupportMessage: (candidate, ticketId, input) => send(candidate, "reply", ticketId, input),
    reopenWithMessage: (candidate, ticketId, input) => send(candidate, "reopen", ticketId, input),
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); transport.close(); issued.clear(); pinned.clear(); } });
}
export function nativeSupportAvailable(port: NativeSupportCommands, scope: ReadScope): boolean {
  try { return port.available(scope) === true && port.canIssueKey(scope) === true; } catch { return false; }
}
