import { z } from "zod";
import { createMarketOperationScope } from "./market-operation-scope";
import type { PublishedReviewFixtureClient } from "./published-reviews-fixture-read";
import type { ReadScope } from "./read-controller";
export class NativePublishedReviewReadError extends Error {
  constructor(readonly code: "scope" | "input") { super("Published review reading is unavailable"); this.name = "NativePublishedReviewReadError"; }
}
/** Existing public review windows through authenticated native GET. The view validates returned identities before text. */
export function bindNativePublishedReviewReads(scope: ReadScope, read: (path: string) => Promise<unknown>, isCurrent: () => boolean): Readonly<Required<PublishedReviewFixtureClient>> {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativePublishedReviewReadError("scope"));
  const request = async (candidate: ReadScope, kind: "products" | "suppliers", target: string) => {
    lifetime.assert(candidate); const id = z.uuid().safeParse(target); if (!id.success) throw new NativePublishedReviewReadError("input");
    // Own-supplier source GET has a private branch. This published-only entry never selects it.
    if (kind === "suppliers" && id.data === lifetime.owner.organizationId) throw new NativePublishedReviewReadError("scope");
    try { const body = await read(`/trust/${kind}/${encodeURIComponent(id.data)}/reviews`); lifetime.assert(candidate); return body; }
    catch (error) { lifetime.assert(candidate); throw error; }
  };
  return Object.freeze({ productReviewsFixture: (candidate, productId) => request(candidate, "products", productId), supplierReviewsFixture: (candidate, supplierId) => request(candidate, "suppliers", supplierId) });
}
