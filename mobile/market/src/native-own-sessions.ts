import { z } from "zod";
import { identitySessionsSchema, identitySessionRevokedSchema, type IdentitySession, type IdentitySessionRevoked } from "../../../packages/schemas/src/identity-management";
import { revokeSessionSchema } from "../../../packages/schemas/src/commercial";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type OwnSession = Readonly<Omit<IdentitySession, "authMethods"> & { authMethods: readonly string[] }>;
export type OwnSessionRevocation = Readonly<IdentitySessionRevoked>;
export type OwnSessionRevokeInput = Readonly<{ reason: string }>;
export type NativeOwnSessionsPort = Readonly<{
  available(scope: ReadScope): boolean;
  list(scope: ReadScope): Promise<readonly OwnSession[]>;
  isCurrent(scope: ReadScope, row: OwnSession): boolean;
  revoke(scope: ReadScope, row: OwnSession, input: OwnSessionRevokeInput): Promise<OwnSessionRevocation>;
}>;
export type NativeOwnSessionsClient = { nativeOwnSessions?: NativeOwnSessionsPort };
export class NativeOwnSessionsError extends Error { constructor(readonly code: "scope" | "input" | "contract") { super("Own-account session request is unavailable"); this.name = "NativeOwnSessionsError"; } }
/** The response has no userId: ownership is the fixed authenticated own-account RPC, not an invented row receipt. */
export function bindNativeOwnSessions(scope: ReadScope, read: (path: string) => Promise<unknown>, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, isCurrentScope: () => boolean, currentSessionId: string, onCurrentRevoked: () => void) {
  if (!z.uuid().safeParse(currentSessionId).success) throw new NativeOwnSessionsError("input");
  const lifetime = createMarketOperationScope(scope, isCurrentScope, () => new NativeOwnSessionsError("scope")), issued = new Set<OwnSession>(), usedRows = new Set<OwnSession>(); let usedInputs = new WeakSet<object>();
  const port: NativeOwnSessionsPort = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async list(candidate) {
      lifetime.assert(candidate); let raw: unknown;
      try { raw = await read("/auth/sessions"); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; }
      try {
        const roots = z.array(identitySessionsSchema.element.pick({ id: true })).parse(raw);
        if (new Set(roots.map(row => row.id)).size !== roots.length) throw Error("duplicate");
        lifetime.assert(candidate);
        const parsed = identitySessionsSchema.parse(raw); lifetime.assert(candidate);
        const rows = Object.freeze(parsed.map(row => Object.freeze({ ...row, authMethods: Object.freeze([...row.authMethods]) })));
        issued.clear(); usedRows.clear(); rows.forEach(row => issued.add(row)); return rows;
      } catch (error) { lifetime.assert(candidate); throw new NativeOwnSessionsError("contract"); }
    },
    isCurrent(candidate, row) { try { lifetime.assert(candidate); return issued.has(row) && row.id === currentSessionId; } catch { return false; } },
    async revoke(candidate, row, input) {
      lifetime.assert(candidate); if (!issued.has(row) || usedRows.has(row) || !input || typeof input !== "object" || usedInputs.has(input)) throw new NativeOwnSessionsError("input");
      let body: OwnSessionRevokeInput;
      try { body = Object.freeze(revokeSessionSchema.strict().parse(input)); if (body.reason !== input.reason) throw Error("canonical"); } catch { throw new NativeOwnSessionsError("input"); }
      lifetime.assert(candidate); usedRows.add(row); usedInputs.add(input); const target = row.id;
      let raw: unknown; try { raw = await postOnce(`/auth/sessions/${encodeURIComponent(target)}/revoke`, body); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; }
      const parsed = identitySessionRevokedSchema.safeParse(raw); if (!parsed.success || parsed.data.id !== target) throw new NativeOwnSessionsError("contract"); lifetime.assert(candidate); const receipt = Object.freeze(parsed.data);
      // Deliberate local invalidation only after a matching source receipt for the captured current session.
      if (target === currentSessionId) { onCurrentRevoked(); return receipt; }
      lifetime.assert(candidate); return receipt;
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); issued.clear(); usedRows.clear(); usedInputs = new WeakSet(); } });
}
