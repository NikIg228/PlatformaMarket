import { z } from "zod";
import { normalizeApiUrl } from "./market-transport";
import type { ReadScope } from "./read-controller";
const scopeSchema = z.object({ product: z.literal("market"), environment: z.string().min(1), userId: z.uuid(), organizationId: z.uuid(), generation: z.number().int().positive() }).strip();
/** Internal request lifetime and immutable selector only; never a permission/admission proof. */
export function createMarketOperationScope(scope: ReadScope, isCurrent: () => boolean, unavailable: () => Error) {
  const decode = (value: unknown) => { try { const parsed = scopeSchema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Do not expose private getter errors. */ } throw unavailable(); };
  if (typeof isCurrent !== "function") throw unavailable();
  const owner = Object.freeze(decode(scope));
  try { if (normalizeApiUrl(owner.environment) !== owner.environment) throw Error("scope"); } catch { throw unavailable(); }
  let closed = false;
  const live = () => {
    try { return !closed && isCurrent() === true && !closed; }
    catch { return false; }
  };
  return Object.freeze({ owner,
    assert(candidate: ReadScope) {
      if (!live()) throw unavailable();
      const value = decode(candidate);
      if (value.product !== owner.product || value.environment !== owner.environment || value.userId !== owner.userId || value.organizationId !== owner.organizationId || value.generation !== owner.generation) throw unavailable();
      // Metadata getters and the liveness callback can invalidate this lifetime synchronously.
      if (!live()) throw unavailable();
    },
    close() { closed = true; },
  });
}
