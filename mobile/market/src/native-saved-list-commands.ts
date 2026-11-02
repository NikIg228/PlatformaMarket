import { z } from "zod";
import { createSavedListSchema, upsertSavedListItemSchema } from "../../../packages/schemas/src/commercial";
import { createBuyerWorkspaceTransport, type BuyerWorkspaceMutationMethod } from "./buyer-workspace-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type NativeSavedListCreateInput = Readonly<z.output<typeof createSavedListSchema>>;
export type NativeSavedListItemInput = Readonly<z.output<typeof upsertSavedListItemSchema>>;
export type NativeSavedListCommands = Readonly<{
  available: (scope: ReadScope) => boolean;
  create: (scope: ReadScope, input: NativeSavedListCreateInput) => Promise<unknown>;
  upsert: (scope: ReadScope, listId: string, input: NativeSavedListItemInput) => Promise<unknown>;
  remove: (scope: ReadScope, listId: string, itemId: string) => Promise<unknown>;
}>;
export type NativeSavedListClient = { nativeSavedListCommands?: NativeSavedListCommands };
export class NativeSavedListError extends Error {
  constructor(readonly code: "scope" | "input") { super("Saved-list request is unavailable"); this.name = "NativeSavedListError"; }
}
/** Source keyless writes. A new intent follows explicit current-data review; no blind replay. */
export function createNativeSavedListCommands(scope: ReadScope, read: (path: string) => Promise<unknown>, mutateOnce: (method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeSavedListError("scope")), transport = createBuyerWorkspaceTransport(scope, read, mutateOnce, isCurrent);
  let creates = new WeakSet<object>(), upserts = new WeakSet<object>();
  const id = (value: string) => { try { return z.uuid().parse(value); } catch { throw new NativeSavedListError("input"); } };
  const port: NativeSavedListCommands = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async create(candidate, input) {
      lifetime.assert(candidate); let body: NativeSavedListCreateInput;
      try { const parsed = createSavedListSchema.strict().parse(input); if (parsed.name !== input.name) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeSavedListError("input"); }
      lifetime.assert(candidate); if (creates.has(input)) throw new NativeSavedListError("input"); creates.add(input);
      try { const result = await transport.createSavedList(candidate, body); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
    async upsert(candidate, listId, input) {
      lifetime.assert(candidate); const target = id(listId); let body: NativeSavedListItemInput;
      try { const parsed = upsertSavedListItemSchema.strict().parse(input); if (parsed.note !== input.note) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeSavedListError("input"); }
      lifetime.assert(candidate); if (upserts.has(input)) throw new NativeSavedListError("input"); upserts.add(input);
      try { const result = await transport.upsertSavedListItem(candidate, target, body); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
    async remove(candidate, listId, itemId) {
      lifetime.assert(candidate); const target = id(listId), item = id(itemId);
      try { const result = await transport.removeSavedListItem(candidate, target, item); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); transport.close(); creates = new WeakSet(); upserts = new WeakSet(); } });
}
export function nativeSavedListAvailable(port: NativeSavedListCommands, scope: ReadScope): boolean {
  try { return typeof port.create === "function" && typeof port.upsert === "function" && typeof port.remove === "function" && port.available(scope) === true; } catch { return false; }
}
