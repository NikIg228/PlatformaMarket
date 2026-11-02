import { z } from "zod";
import { comparedOfferSchema, offerComparisonResponseSchema, orderDocumentResponseSchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { createVerifiedReviewSchema, moderateVerifiedReviewSchema } from "../../../packages/schemas/src/trust-commerce";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Private fixture projections of actual GET implementations/web consumer fields.
// These are not accepted shared CURRENT response schemas or new server DTOs.
const uuid = comparedOfferSchema.shape.offerId;
const rating = createVerifiedReviewSchema.shape.overallRating;
const row = z.object({ id: uuid, overallRating: rating, comment: z.string().nullable(), officialResponse: z.string().nullable(), createdAt: orderDocumentResponseSchema.shape.createdAt });
const productBinding = z.object({ reviews: z.array(z.object({ id: uuid, productVariantId: uuid })).max(100) });
const supplierBinding = z.array(z.object({ id: uuid, supplierOrganizationId: comparedOfferSchema.shape.supplier.shape.organizationId, status: moderateVerifiedReviewSchema.shape.status.extract(["PUBLISHED"]) })).max(200);
const productWindow = z.object({ summary: offerComparisonResponseSchema.shape.reviewSummary, reviews: z.array(row).max(100) });
const supplierWindow = z.array(row).max(200);
export type PublishedReview = z.output<typeof row>;
export type ReviewSummary = z.output<typeof offerComparisonResponseSchema.shape.reviewSummary>;
export type ReviewSelection = Readonly<{ kind: "product" | "supplier"; id: string; selection: number }>;
type Context = Readonly<{ kind: "product"; id: string; name: string; variantIds: readonly string[] }> | Readonly<{ kind: "supplier"; id: string; name: string }>;
export type PublishedReviewWindow = { context: Context; reviews: PublishedReview[]; summary: ReviewSummary | null };
const comparisonIdentity = offerComparisonResponseSchema.pick({ selectedVariantId: true }).extend({ product: offerComparisonResponseSchema.shape.product.pick({ id: true, name: true }), variants: z.array(offerComparisonResponseSchema.shape.variants.element.pick({ id: true })) });
const offerIdentity = comparedOfferSchema.pick({ offerId: true, variantId: true }).extend({ supplier: comparedOfferSchema.shape.supplier.pick({ organizationId: true, name: true }) });
export function productReviewContext(comparison: unknown): Extract<Context, { kind: "product" }> | null {
  const parsed = comparisonIdentity.safeParse(comparison); if (!parsed.success) return null;
  const value = parsed.data, variantIds = value.variants.map(item => item.id);
  if (value.selectedVariantId === null || !variantIds.includes(value.selectedVariantId) || new Set(variantIds).size !== variantIds.length) return null;
  return Object.freeze({ kind: "product", id: value.product.id, name: value.product.name, variantIds: Object.freeze(variantIds) });
}
export function supplierReviewContext(comparison: unknown, offerId: string, organizationId: string): Extract<Context, { kind: "supplier" }> | null {
  const parent = productReviewContext(comparison), parsed = comparisonIdentity.extend({ offers: z.array(offerIdentity) }).safeParse(comparison); if (!parent || !parsed.success) return null;
  const matches = parsed.data.offers.filter(item => item.offerId === offerId && item.variantId === parsed.data.selectedVariantId);
  if (matches.length !== 1) return null;
  const supplier = matches[0]!.supplier;
  // Avoid the source's own-supplier/private review branch. IDs do not grant access.
  return supplier.organizationId === organizationId ? null : Object.freeze({ kind: "supplier", id: supplier.organizationId, name: supplier.name });
}
export function decodeProductReviewFixture(body: unknown, variantIds: readonly string[]): { reviews: PublishedReview[]; summary: ReviewSummary } | null {
  const binding = productBinding.safeParse(body);
  if (!binding.success || new Set(binding.data.reviews.map(item => item.id)).size !== binding.data.reviews.length || binding.data.reviews.some(item => !variantIds.includes(item.productVariantId))) return null;
  const parsed = productWindow.safeParse(body); if (!parsed.success) return null;
  const { reviews, summary } = parsed.data;
  if (summary.count !== reviews.length || (reviews.length === 0 ? summary.averageRating !== null : summary.averageRating === null || summary.averageRating < rating.minValue! || summary.averageRating > rating.maxValue!)) return null;
  return { reviews, summary };
}
export function decodeSupplierReviewFixture(body: unknown, supplierOrganizationId: string): PublishedReview[] | null {
  const binding = supplierBinding.safeParse(body);
  if (!binding.success || new Set(binding.data.map(item => item.id)).size !== binding.data.length || binding.data.some(item => item.supplierOrganizationId !== supplierOrganizationId)) return null;
  const parsed = supplierWindow.safeParse(body); return parsed.success ? parsed.data : null;
}
export type PublishedReviewFixtureClient = { productReviewsFixture?: (scope: ReadScope, productId: string) => Promise<unknown>; supplierReviewsFixture?: (scope: ReadScope, supplierOrganizationId: string) => Promise<unknown> };
type Failure = "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error";
export type PublishedReviewFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "published-reviews" } } | { phase: "ready" | "empty"; read: { kind: "published-reviews"; value: PublishedReviewWindow } } | { phase: Failure };
function failure(error: unknown): Failure {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return "error";
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return "contract-error";
  return status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error";
}
export function createPublishedReviewFixtureRead(scope: ReadScope, client: PublishedReviewFixtureClient) {
  const owner = Object.freeze({ ...scope }), product = client.productReviewsFixture, supplier = client.supplierReviewsFixture;
  let issued = new WeakMap<ReviewSelection, Context>(), sequence = 0, state: PublishedReviewFixtureState = { phase: "idle" }, pending: object | null = null, last: ReviewSelection | null = null;
  const issue = (context: Context | null) => { if (!context) return null; const target: ReviewSelection = Object.freeze({ kind: context.kind, id: context.id, selection: ++sequence }); issued.set(target, context); return target; };
  const load = async (target: ReviewSelection): Promise<"applied" | "discarded"> => {
    const request = {}; pending = request;
    const context = typeof target === "object" && target !== null ? issued.get(target) : undefined;
    if (!context) { last = null; pending = null; state = { phase: "contract-error" }; return "applied"; }
    last = target; state = { phase: "loading", target: { kind: "published-reviews" } }; let next: PublishedReviewFixtureState;
    try {
      const port = context.kind === "product" ? product : supplier;
      if (!port) next = { phase: "unavailable" };
      else {
        const body = await port(owner, context.id); if (pending !== request) return "discarded";
        const value = context.kind === "product" ? decodeProductReviewFixture(body, context.variantIds) : (() => { const reviews = decodeSupplierReviewFixture(body, context.id); return reviews ? { reviews, summary: null } : null; })();
        next = value ? { phase: value.reviews.length ? "ready" : "empty", read: { kind: "published-reviews", value: { context, ...value } } } : { phase: "contract-error" };
      }
    } catch (error) { if (pending !== request) return "discarded"; next = { phase: failure(error) }; }
    if (pending !== request) return "discarded"; pending = null; state = next; return "applied";
  };
  return { selectProduct: (comparison: unknown) => issue(productReviewContext(comparison)), selectSupplier: (comparison: unknown, offerId: string) => issue(supplierReviewContext(comparison, offerId, owner.organizationId)), load, getState: () => state, refresh: () => last ? load(last) : Promise.resolve("no-query" as const), reset() { pending = null; last = null; issued = new WeakMap(); state = { phase: "idle" }; } };
}
