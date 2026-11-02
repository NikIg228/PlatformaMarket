import { z } from "zod";
import { createSupportTicketSchema } from "../../../packages/schemas/src/commercial";
import type { ReadScope } from "./read-controller";
import { createMarketOperationScope } from "./market-operation-scope";
import { createConversationCommandTransport } from "./conversation-command-transport";

export class SupportCommandTransportError extends Error {
  constructor(readonly code: "scope" | "input") { super(code === "scope" ? "Support command context is unavailable" : "Invalid reviewed support command"); this.name = "SupportCommandTransportError"; }
}
function decode<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* Fixed error only, without input/getter details. */ }
  throw new SupportCommandTransportError("input");
}
const createInput = z.object({ idempotencyKey: createSupportTicketSchema.shape.idempotencyKey, subject: z.string(), description: z.string(), category: z.string(), priority: createSupportTicketSchema.shape.priority.unwrap(), links: z.tuple([]) }).strict();

/** Dormant general-support candidate. Existing source routes only; no native grant, key generation or retry. */
export function createSupportCommandTransport(scope: ReadScope, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean) {
  if (typeof postOnce !== "function") throw new SupportCommandTransportError("scope");
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new SupportCommandTransportError("scope"));
  const replies = createConversationCommandTransport(scope, postOnce, isCurrent);
  return Object.freeze({
    async create(candidate: ReadScope, input: unknown) {
      lifetime.assert(candidate);
      const raw = decode(createInput, input), parsed = decode(createSupportTicketSchema.strict(), raw);
      if ((["subject", "description", "category"] as const).some(field => raw[field] !== parsed[field])) throw new SupportCommandTransportError("input");
      const body = Object.freeze({ ...parsed, links: Object.freeze([]) });
      lifetime.assert(candidate);
      try { const result = await postOnce("/support/tickets", body); lifetime.assert(candidate); return result; }
      catch (error) { lifetime.assert(candidate); throw error; }
    },
    publicReply: replies.supportReply,
    close() { lifetime.close(); replies.close(); },
  });
}
