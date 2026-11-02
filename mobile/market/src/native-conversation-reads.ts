import { createConversationReadTransport } from "./conversation-read-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import type { OrderConversationFixtureClient } from "./order-conversation-read";
import type { ReadScope } from "./read-controller";

/** Ability to issue a scoped authenticated request. The server decides permission on every GET. */
export type NativeConversationReads = Readonly<{
  available: (scope: ReadScope) => boolean;
  list: (scope: ReadScope, input: Readonly<{ filter: "ORDERS" | "ALL"; offset: number; limit: 30 }>) => Promise<unknown>;
  lookup: (scope: ReadScope, input: Readonly<{ contextType: "ORDER" | "OFFER"; contextId: string }>) => Promise<unknown>;
  get: (scope: ReadScope, id: string, beforeSequence?: number) => Promise<unknown>;
}>;
export type NativeConversationReadClient = { nativeConversationReads?: NativeConversationReads };
export function bindNativeConversationReads(scope: ReadScope, read: (path: string) => Promise<unknown>, isCurrent: () => boolean): Readonly<NativeConversationReadClient & Required<OrderConversationFixtureClient>> {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => Error("Conversation request context is unavailable"));
  const transport = createConversationReadTransport(scope, read, isCurrent);
  const port: NativeConversationReads = Object.freeze({
    available(candidate: ReadScope) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async list(candidate, input) { return transport.list(candidate, input); },
    async lookup(candidate, input) { return transport.lookup(candidate, input); },
    async get(candidate, id, beforeSequence) { return transport.get(candidate, id, beforeSequence); },
  });
  return Object.freeze({ nativeConversationReads: port, orderConversationLookupFixture: port.lookup, orderConversationDetailFixture: port.get });
}

export function nativeConversationReadAvailable(port: NativeConversationReads, scope: ReadScope): boolean {
  try { return typeof port.list === "function" && typeof port.lookup === "function" && typeof port.get === "function" && port.available(scope) === true; } catch { return false; }
}
