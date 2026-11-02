import { z } from "zod";
import { createOrderCommentSchema, updateOrderCommentSchema } from "../../../packages/schemas/src/trust-commerce";
import { createBuyerWorkspaceTransport, type BuyerWorkspaceMutationMethod } from "./buyer-workspace-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { CreateOrderCommentInput } from "./order-comment-create-command";
import type { EditOrderCommentInput } from "./order-comment-edit-command";
import type { ReadScope } from "./read-controller";

export type NativeOrderCommentCommands = Readonly<{
  available: (scope: ReadScope) => boolean;
  canIssueKey: (scope: ReadScope) => boolean;
  nextKey: (scope: ReadScope) => string;
  create: (scope: ReadScope, orderId: string, input: Readonly<CreateOrderCommentInput>) => Promise<unknown>;
  update: (scope: ReadScope, commentId: string, input: Readonly<EditOrderCommentInput>) => Promise<unknown>;
}>;
export type NativeOrderCommentClient = { nativeOrderCommentCommands?: NativeOrderCommentCommands };
export class NativeOrderCommentError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super("Comment request is unavailable"); this.name = "NativeOrderCommentError"; }
}
/** Existing fixed commands. Scope/key capability never represents a server permission grant. */
export function createNativeOrderCommentCommands(scope: ReadScope, read: (path: string) => Promise<unknown>, mutateOnce: (method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeOrderCommentError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>();
  const transport = createBuyerWorkspaceTransport(scope, read, mutateOnce, isCurrent), pinned = new Map<string, Readonly<{ orderId: string; bytes: string; input: Readonly<CreateOrderCommentInput> }>>();
  let submittedEdits = new WeakSet<object>();
  const port: NativeOrderCommentCommands = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueKey: keys.canIssue,
    nextKey(candidate) { lifetime.assert(candidate); const value = keys.next(candidate); lifetime.assert(candidate); issued.add(value); return value; },
    async create(candidate, orderId, input) {
      lifetime.assert(candidate); let id: string, body: Readonly<CreateOrderCommentInput>;
      try { id = z.uuid().parse(orderId); const parsed = createOrderCommentSchema.strict().parse(input); if (parsed.body !== input.body || parsed.idempotencyKey !== input.idempotencyKey) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeOrderCommentError("input"); }
      lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeOrderCommentError("key");
      const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey); if (prior && (prior.orderId !== id || prior.bytes !== bytes)) throw new NativeOrderCommentError("input");
      const attempt = prior ?? Object.freeze({ orderId: id, bytes, input: body }); if (!prior) pinned.set(body.idempotencyKey, attempt);
      try { const result = await transport.createOrderComment(candidate, id, attempt.input); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
    async update(candidate, commentId, input) {
      lifetime.assert(candidate); let id: string, body: Readonly<EditOrderCommentInput>;
      try { id = z.uuid().parse(commentId); const parsed = updateOrderCommentSchema.strict().parse(input); if (parsed.body !== input.body) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeOrderCommentError("input"); }
      lifetime.assert(candidate); if (submittedEdits.has(input)) throw new NativeOrderCommentError("input");
      // The model creates a new reviewed object only after an independent current reading.
      submittedEdits.add(input);
      try { const result = await transport.updateOrderComment(candidate, id, body); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); transport.close(); issued.clear(); pinned.clear(); submittedEdits = new WeakSet(); } });
}
export function nativeOrderCommentAvailable(port: NativeOrderCommentCommands, scope: ReadScope, needsKey = false): boolean {
  try { return typeof port.create === "function" && typeof port.update === "function" && port.available(scope) === true && (!needsKey || port.canIssueKey(scope) === true); } catch { return false; }
}
