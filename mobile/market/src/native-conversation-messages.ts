import { z } from "zod";
import { startConversationSchema, conversationMessageInputSchema, type StartConversation, type ConversationMessageInput } from "../../../packages/schemas/src/conversations";
import { createConversationCommandTransport } from "./conversation-command-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { ReadScope } from "./read-controller";
export type NativeConversationMessages = Readonly<{
  available: (scope: ReadScope) => boolean;
  nextKey: (scope: ReadScope) => string;
  start: (scope: ReadScope, input: Readonly<StartConversation>) => Promise<unknown>;
  send: (scope: ReadScope, conversationId: string, input: Readonly<ConversationMessageInput>) => Promise<unknown>;
}>;
export type NativeConversationMessageClient = { nativeConversationMessages?: NativeConversationMessages };
export class NativeConversationMessageError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super("Conversation message request is unavailable"); this.name = "NativeConversationMessageError"; }
}
const startOnly = z.object({ contextType: z.enum(["ORDER", "OFFER"]), contextId: z.uuid(), body: z.string(), idempotencyKey: z.uuid() }).strict();
const messageOnly = z.object({ body: z.string(), idempotencyKey: z.uuid() }).strict();
/** Text-only source requests. Permission remains server-authoritative; original attempts stay pinned. */
export function createNativeConversationMessages(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeConversationMessageError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>(), transport = createConversationCommandTransport(scope, postOnce, isCurrent);
  type Pinned = Readonly<{ target: string; bytes: string; input: Readonly<StartConversation | ConversationMessageInput> }>;
  const pinned = new Map<string, Pinned>();
  function pin(candidate: ReadScope, target: string, input: Readonly<StartConversation | ConversationMessageInput>) {
    lifetime.assert(candidate); if (!issued.has(input.idempotencyKey)) throw new NativeConversationMessageError("key"); const bytes = JSON.stringify(input), prior = pinned.get(input.idempotencyKey);
    if (prior && (prior.target !== target || prior.bytes !== bytes)) throw new NativeConversationMessageError("input");
    if (prior) return prior; const attempt = Object.freeze({ target, bytes, input }); pinned.set(input.idempotencyKey, attempt); return attempt;
  }
  const port: NativeConversationMessages = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return keys.canIssue(candidate); } catch { return false; } },
    nextKey(candidate) { lifetime.assert(candidate); const key = keys.next(candidate); lifetime.assert(candidate); issued.add(key); return key; },
    async start(candidate, input) {
      lifetime.assert(candidate); let body: Readonly<StartConversation>;
      try { const raw = startOnly.parse(input), parsed = startConversationSchema.parse(raw); if (parsed.body !== raw.body) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeConversationMessageError("input"); }
      const attempt = pin(candidate, `start:${body.contextType}:${body.contextId}`, body);
      try { const result = await transport.start(candidate, attempt.input); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
    async send(candidate, conversationId, input) {
      lifetime.assert(candidate); let id: string, body: Readonly<ConversationMessageInput>;
      try { id = z.uuid().parse(conversationId); const raw = messageOnly.parse(input), parsed = conversationMessageInputSchema.parse(raw); if (parsed.body !== raw.body) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeConversationMessageError("input"); }
      const attempt = pin(candidate, `send:${id}`, body);
      try { const result = await transport.send(candidate, id, attempt.input); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); transport.close(); issued.clear(); pinned.clear(); } });
}
export function nativeConversationMessagesAvailable(port: NativeConversationMessages, scope: ReadScope): boolean {
  try { return typeof port.start === "function" && typeof port.send === "function" && typeof port.nextKey === "function" && port.available(scope) === true; } catch { return false; }
}
