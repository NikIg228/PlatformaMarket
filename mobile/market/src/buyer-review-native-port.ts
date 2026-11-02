import { z } from "zod";
import { uuid } from "expo";
import { createVerifiedReviewSchema, updateVerifiedReviewSchema } from "../../../packages/schemas/src/trust-commerce";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { BuyerReviewCommandPort, BuyerReviewInput } from "./buyer-review-create";
import type { BuyerReviewUpdateInput } from "./buyer-review-update";
import type { ReadScope } from "./read-controller";

export class BuyerReviewPortError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super(code === "scope" ? "Review request context is unavailable" : "Review request is unavailable"); this.name = "BuyerReviewPortError"; }
}
export function platformReviewUuidProvider(): NativeUuidProvider | undefined {
  try {
    const crypto = globalThis.crypto;
    if (typeof crypto?.randomUUID === "function") return crypto;
    // Installed Expo exports the existing iOS/Android UUID-v4 implementation.
    // Missing native support throws during preparation; no weak fallback is used.
    return { randomUUID: () => uuid.v4() };
  } catch { return undefined; }
}

/** Existing POST contract, without a manufactured permission receipt or automatic command retry. */
export function createNativeBuyerReviewPort(scope: ReadScope, writeOnce: (path: string, input: BuyerReviewInput) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean, updates?: { writeOnce: (path: string, input: BuyerReviewUpdateInput) => Promise<unknown>; read: (path: string) => Promise<unknown> }) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new BuyerReviewPortError("scope"));
  const keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>();
  const pinned = new Map<string, Readonly<{ orderId: string; input: BuyerReviewInput; bytes: string }>>();
  let submittedUpdates = new WeakSet<object>();
  const port: BuyerReviewCommandPort = Object.freeze({
    ...(updates ? {
      async update(candidate: ReadScope, reviewId: string, input: BuyerReviewUpdateInput) {
        lifetime.assert(candidate); let id: string, body: BuyerReviewUpdateInput;
        try { id = z.uuid().parse(reviewId); const parsed = updateVerifiedReviewSchema.strict().parse(input); body = Object.freeze({ ...parsed, dimensions: Object.freeze({ ...parsed.dimensions }) }); } catch { throw new BuyerReviewPortError("input"); }
        lifetime.assert(candidate); if (submittedUpdates.has(input)) throw new BuyerReviewPortError("input"); submittedUpdates.add(input);
        try { const result = await updates.writeOnce(`/trust/reviews/${encodeURIComponent(id)}`, body); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
      },
      async readPublished(candidate: ReadScope, supplierOrganizationId: string) {
        lifetime.assert(candidate); let id: string; try { id = z.uuid().parse(supplierOrganizationId); } catch { throw new BuyerReviewPortError("input"); }
        lifetime.assert(candidate); try { const result = await updates.read(`/trust/suppliers/${encodeURIComponent(id)}/reviews`); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
      },
    } : {}),
    canIssueKey: (candidate: ReadScope) => keys.canIssue(candidate),
    nextKey(candidate: ReadScope) { lifetime.assert(candidate); const key = keys.next(candidate); lifetime.assert(candidate); issued.add(key); return key; },
    async create(candidate: ReadScope, orderId: string, input: BuyerReviewInput) {
      lifetime.assert(candidate);
      let id: string, body: BuyerReviewInput;
      try {
        id = z.uuid().parse(orderId);
        const parsed = createVerifiedReviewSchema.strict().parse(input);
        body = Object.freeze({ ...parsed, dimensions: Object.freeze({ ...parsed.dimensions }) });
      } catch { throw new BuyerReviewPortError("input"); }
      lifetime.assert(candidate);
      if (!issued.has(body.idempotencyKey)) throw new BuyerReviewPortError("key");
      const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey);
      if (prior && (prior.orderId !== id || prior.bytes !== bytes)) throw new BuyerReviewPortError("input");
      const attempt = prior ?? Object.freeze({ orderId: id, input: body, bytes });
      if (!prior) pinned.set(body.idempotencyKey, attempt);
      try { const result = await writeOnce(`/trust/orders/${encodeURIComponent(id)}/reviews`, attempt.input); lifetime.assert(candidate); return result; }
      catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); issued.clear(); pinned.clear(); submittedUpdates = new WeakSet(); } });
}
