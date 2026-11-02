import { z } from "zod";
import { conversationReadSchema, conversationResolveSchema, conversationEscalationSchema, type ConversationEscalation } from "../../../packages/schemas/src/conversations";
import { createConversationCommandTransport } from "./conversation-command-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { ReadScope } from "./read-controller";
export type NativeConversationActions = Readonly<{
  available: (scope: ReadScope) => boolean;
  canIssueKey: (scope: ReadScope) => boolean;
  nextKey: (scope: ReadScope) => string;
  markRead: (scope: ReadScope, conversationId: string, input: Readonly<{ throughSequence: number }>) => Promise<unknown>;
  resolve: (scope: ReadScope, conversationId: string, input: Readonly<{ expectedVersion: number }>) => Promise<unknown>;
  escalate: (scope: ReadScope, conversationId: string, input: Readonly<ConversationEscalation>) => Promise<unknown>;
}>;
export type NativeConversationActionClient = { nativeConversationActions?: NativeConversationActions };
export class NativeConversationActionError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super("Conversation action request is unavailable"); this.name = "NativeConversationActionError"; }
}
const ordinaryResolve = conversationResolveSchema.pick({ expectedVersion: true }).strict();
/** Explicit personal/ordinary-participant commands. No operator decision or implicit read marker. */
export function createNativeConversationActions(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeConversationActionError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>(), transport = createConversationCommandTransport(scope, postOnce, isCurrent);
  const pinned = new Map<string, Readonly<{ id: string; bytes: string; input: Readonly<ConversationEscalation> }>>(); let submittedResolves = new WeakSet<object>();
  const parseId = (value: string) => { try { return z.uuid().parse(value); } catch { throw new NativeConversationActionError("input"); } };
  const port: NativeConversationActions = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueKey: keys.canIssue,
    nextKey(candidate) { lifetime.assert(candidate); const key = keys.next(candidate); lifetime.assert(candidate); issued.add(key); return key; },
    async markRead(candidate, conversationId, input) {
      lifetime.assert(candidate); const id = parseId(conversationId); let body: Readonly<{ throughSequence: number }>;
      try { body = Object.freeze(conversationReadSchema.parse(input)); } catch { throw new NativeConversationActionError("input"); }
      lifetime.assert(candidate); try { const result = await transport.markRead(candidate, id, body); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
    async resolve(candidate, conversationId, input) {
      lifetime.assert(candidate); const id = parseId(conversationId); let body: Readonly<{ expectedVersion: number }>;
      try { body = Object.freeze(ordinaryResolve.parse(input)); } catch { throw new NativeConversationActionError("input"); }
      lifetime.assert(candidate); if (submittedResolves.has(input)) throw new NativeConversationActionError("input"); submittedResolves.add(input);
      try { const result = await transport.resolve(candidate, id, body); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
    async escalate(candidate, conversationId, input) {
      lifetime.assert(candidate); const id = parseId(conversationId); let body: Readonly<ConversationEscalation>;
      try { const parsed = conversationEscalationSchema.parse(input); if (parsed.reason !== input.reason) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeConversationActionError("input"); }
      lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeConversationActionError("key"); const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey);
      if (prior && (prior.id !== id || prior.bytes !== bytes)) throw new NativeConversationActionError("input"); const attempt = prior ?? Object.freeze({ id, bytes, input: body }); if (!prior) pinned.set(body.idempotencyKey, attempt);
      try { const result = await transport.escalate(candidate, id, attempt.input); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); transport.close(); issued.clear(); pinned.clear(); submittedResolves = new WeakSet(); } });
}
export function nativeConversationActionsAvailable(port: NativeConversationActions, scope: ReadScope, needsKey = false): boolean {
  try { return typeof port.markRead === "function" && typeof port.resolve === "function" && typeof port.escalate === "function" && port.available(scope) === true && (!needsKey || port.canIssueKey(scope) === true); } catch { return false; }
}
