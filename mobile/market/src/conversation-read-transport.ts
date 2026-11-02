import { z } from "zod";
import { conversationContextSchema, conversationQuerySchema, conversationMessageQuerySchema } from "../../../packages/schemas/src/conversations";
import { createConversationTransportScope } from "./conversation-transport-scope";
import type { ReadScope } from "./read-controller";

export class ConversationReadTransportError extends Error {
  constructor(readonly code: "scope" | "input") { super(code === "scope" ? "Conversation read context is unavailable" : "Invalid conversation read request"); this.name = "ConversationReadTransportError"; }
}
function decode<T>(schema: z.ZodType<T>, value: unknown, code: "scope" | "input" = "input"): T {
  try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Never expose an input getter's private error. */ }
  throw new ConversationReadTransportError(code);
}

/** Raw GET transport. The caller binds the session and validates responses; no permission grant is created. */
export function createConversationReadTransport(scope: ReadScope, read: (path: string) => Promise<unknown>, isCurrent: () => boolean) {
  if (typeof read !== "function") throw new ConversationReadTransportError("scope");
  const lifetime = createConversationTransportScope(scope, isCurrent, () => new ConversationReadTransportError("scope")), assertScope = lifetime.assert;
  const request = async (candidate: ReadScope, path: string) => {
    assertScope(candidate);
    try { const result = await read(path); assertScope(candidate); return result; }
    catch (error) { assertScope(candidate); throw error; }
  };
  return Object.freeze({
    list(candidate: ReadScope, input: unknown = {}) {
      assertScope(candidate);
      const query = decode(conversationQuerySchema.strict(), input), parameters = new URLSearchParams({ filter: query.filter, offset: String(query.offset), limit: String(query.limit) });
      return request(candidate, `/conversations?${parameters}`);
    },
    lookup(candidate: ReadScope, input: unknown) {
      assertScope(candidate);
      const context = decode(conversationContextSchema, input), parameters = new URLSearchParams({ contextType: context.contextType, contextId: context.contextId });
      return request(candidate, `/conversations/context?${parameters}`);
    },
    get(candidate: ReadScope, id: unknown, beforeSequence?: unknown) {
      assertScope(candidate);
      const conversationId = decode(z.uuid(), id), query = decode(conversationMessageQuerySchema.strict(), { beforeSequence });
      return request(candidate, `/conversations/${encodeURIComponent(conversationId)}${query.beforeSequence === undefined ? "" : `?beforeSequence=${query.beforeSequence}`}`);
    },
    close: lifetime.close,
  });
}
export type ConversationReadTransport = ReturnType<typeof createConversationReadTransport>;
