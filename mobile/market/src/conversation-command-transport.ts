import { z } from "zod";
import { startConversationSchema, conversationMessageInputSchema, conversationReadSchema, conversationResolveSchema, conversationEscalationSchema } from "../../../packages/schemas/src/conversations";
import { addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import { createConversationTransportScope } from "./conversation-transport-scope";
import type { ReadScope } from "./read-controller";

export class ConversationCommandTransportError extends Error {
  constructor(readonly code: "scope" | "input") { super(code === "scope" ? "Conversation command context is unavailable" : "Invalid reviewed conversation command"); this.name = "ConversationCommandTransportError"; }
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Never expose a caller's body/getter error. */ }
  throw new ConversationCommandTransportError("input");
}
const firstInput = z.object({ contextType: startConversationSchema.shape.contextType, contextId: startConversationSchema.shape.contextId, body: z.string(), idempotencyKey: startConversationSchema.shape.idempotencyKey }).strict();
const messageInput = z.object({ body: z.string(), idempotencyKey: conversationMessageInputSchema.shape.idempotencyKey }).strict();
const reasonInput = z.object({ reason: z.string(), idempotencyKey: conversationEscalationSchema.shape.idempotencyKey }).strict();
const closeInput = z.object({ expectedVersion: conversationResolveSchema.shape.expectedVersion }).strict();
const publicReplyInput = z.object({ idempotencyKey: addSupportMessageSchema.shape.idempotencyKey, body: z.string(), isInternal: z.literal(false), attachments: z.tuple([]) }).strict();
const canonical = (raw: string, parsed: string) => { if (raw !== parsed) throw new ConversationCommandTransportError("input"); };

/** Fixed raw command routes. postOnce must be the private single-attempt POST callback; response admission belongs to the consumer/server. */
export function createConversationCommandTransport(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean) {
  if (typeof postOnce !== "function") throw new ConversationCommandTransportError("scope");
  const lifetime = createConversationTransportScope(scope, isCurrent, () => new ConversationCommandTransportError("scope"));
  const request = async (candidate: ReadScope, path: string, body: Readonly<object>) => {
    lifetime.assert(candidate);
    try { const result = await postOnce(path, body); lifetime.assert(candidate); return result; }
    catch (error) { lifetime.assert(candidate); throw error; }
  };
  const id = (value: unknown) => encodeURIComponent(decode(z.uuid(), value));
  return Object.freeze({
    start(candidate: ReadScope, input: unknown) {
      lifetime.assert(candidate); const raw = decode(firstInput, input), body = decode(startConversationSchema, raw); canonical(raw.body, body.body);
      return request(candidate, "/conversations", Object.freeze(body));
    },
    send(candidate: ReadScope, conversationId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(conversationId), raw = decode(messageInput, input), body = decode(conversationMessageInputSchema, raw); canonical(raw.body, body.body);
      return request(candidate, `/conversations/${target}/messages`, Object.freeze(body));
    },
    markRead(candidate: ReadScope, conversationId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(conversationId), body = decode(conversationReadSchema, input);
      return request(candidate, `/conversations/${target}/read`, Object.freeze(body));
    },
    resolve(candidate: ReadScope, conversationId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(conversationId), body = decode(conversationResolveSchema, decode(closeInput, input));
      return request(candidate, `/conversations/${target}/resolve`, Object.freeze(body));
    },
    escalate(candidate: ReadScope, conversationId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(conversationId), raw = decode(reasonInput, input), body = decode(conversationEscalationSchema, raw); canonical(raw.reason, body.reason);
      return request(candidate, `/conversations/${target}/escalate`, Object.freeze(body));
    },
    supportReply(candidate: ReadScope, ticketId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(ticketId), raw = decode(publicReplyInput, input), parsed = decode(addSupportMessageSchema, raw); canonical(raw.body, parsed.body);
      const body = Object.freeze({ idempotencyKey: parsed.idempotencyKey, body: parsed.body, isInternal: false as const, attachments: Object.freeze([]) });
      return request(candidate, `/support/tickets/${target}/messages`, body);
    },
    close: lifetime.close,
  });
}
export type ConversationCommandTransport = ReturnType<typeof createConversationCommandTransport>;
