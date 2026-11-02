import { z } from "zod";
import { createSavedListSchema, upsertSavedListItemSchema } from "../../../packages/schemas/src/commercial";
import { createOrderCommentSchema, updateOrderCommentSchema } from "../../../packages/schemas/src/trust-commerce";
import { createMarketOperationScope } from "./market-operation-scope";
import type { MarketRequestMethod } from "./market-transport";
import type { ReadScope } from "./read-controller";

export type BuyerWorkspaceMutationMethod = Exclude<MarketRequestMethod, "GET">;
export class BuyerWorkspaceTransportError extends Error {
  constructor(readonly code: "scope" | "input") {
    super(code === "scope" ? "Buyer workspace context is unavailable" : "Invalid reviewed buyer workspace command");
    this.name = "BuyerWorkspaceTransportError";
  }
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; }
  catch { /* Caller input details stay private. */ }
  throw new BuyerWorkspaceTransportError("input");
}
const listInput = z.object({ name: z.string(), isDefault: z.boolean() }).strict();
const itemInput = z.object({ offerId: z.uuid(), quantity: z.number().positive(), note: z.string().nullable().optional() }).strict();
const commentInput = z.object({ body: z.string(), idempotencyKey: z.string() }).strict();
const editInput = z.object({ body: z.string(), version: z.number().int().positive() }).strict();
const canonical = (raw: unknown, parsed: unknown) => { if (raw !== parsed) throw new BuyerWorkspaceTransportError("input"); };

/** Actual selected source routes only. Ownership/permissions and raw response admission remain with consumers/server. */
export function createBuyerWorkspaceTransport(scope: ReadScope, read: (path: string) => Promise<unknown>, mutateOnce: (method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean) {
  if (typeof read !== "function" || typeof mutateOnce !== "function") throw new BuyerWorkspaceTransportError("scope");
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new BuyerWorkspaceTransportError("scope"));
  const id = (value: unknown) => encodeURIComponent(decode(z.uuid(), value));
  const request = async (candidate: ReadScope, method: MarketRequestMethod, path: string, body?: Readonly<object>) => {
    lifetime.assert(candidate);
    try {
      const result = method === "GET" ? await read(path) : await mutateOnce(method, path, body);
      lifetime.assert(candidate); return result;
    } catch (error) { lifetime.assert(candidate); throw error; }
  };
  return Object.freeze({
    savedLists(candidate: ReadScope) {
      lifetime.assert(candidate); return request(candidate, "GET", "/owner/saved-lists");
    },
    createSavedList(candidate: ReadScope, input: unknown) {
      lifetime.assert(candidate); const raw = decode(listInput, input), body = decode(createSavedListSchema.strict(), raw); canonical(raw.name, body.name);
      return request(candidate, "POST", "/owner/saved-lists", Object.freeze(body));
    },
    upsertSavedListItem(candidate: ReadScope, listId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(listId), raw = decode(itemInput, input), body = decode(upsertSavedListItemSchema.strict(), raw); canonical(raw.note, body.note);
      return request(candidate, "POST", `/owner/saved-lists/${target}/items`, Object.freeze(body));
    },
    removeSavedListItem(candidate: ReadScope, listId: unknown, itemId: unknown) {
      lifetime.assert(candidate); const target = id(listId), item = id(itemId);
      return request(candidate, "DELETE", `/owner/saved-lists/${target}/items/${item}`);
    },
    orderComments(candidate: ReadScope, orderId: unknown) {
      lifetime.assert(candidate); return request(candidate, "GET", `/trust/orders/${id(orderId)}/comments`);
    },
    createOrderComment(candidate: ReadScope, orderId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(orderId), raw = decode(commentInput, input), body = decode(createOrderCommentSchema.strict(), raw); canonical(raw.body, body.body); canonical(raw.idempotencyKey, body.idempotencyKey);
      return request(candidate, "POST", `/trust/orders/${target}/comments`, Object.freeze(body));
    },
    updateOrderComment(candidate: ReadScope, commentId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(commentId), raw = decode(editInput, input), body = decode(updateOrderCommentSchema.strict(), raw); canonical(raw.body, body.body);
      return request(candidate, "PATCH", `/trust/comments/${target}`, Object.freeze(body));
    },
    close: lifetime.close,
  });
}
export type BuyerWorkspaceTransport = ReturnType<typeof createBuyerWorkspaceTransport>;
