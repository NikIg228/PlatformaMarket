import { orderWorkflowResponseSchema, type OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import type { BuyerReviewInput, BuyerReviewReceipt, ReviewDimension } from "../buyer-review-create";
import { reviewDimensions } from "../buyer-review-create";
import type { ReadScope } from "../read-controller";
import { MarketHttpError } from "../market-transport";
import { dashboardWorkflow } from "./buyer-dashboard";

export const reviewId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const reviewScope: ReadScope = Object.freeze({ product: "market", environment: "https://market.example.invalid/api", userId: reviewId(20), organizationId: reviewId(4), generation: 1 });
export function reviewWorkflow(status = "DELIVERED"): OrderWorkflowResponse { const value = dashboardWorkflow(); value.order.status = status; return orderWorkflowResponseSchema.parse(value); }
export function reviewInput(key = "00000000-0000-4000-8000-000000010001"): BuyerReviewInput { return { productVariantId: null, overallRating: 4, dimensions: Object.fromEntries(reviewDimensions.map(dimension => [dimension, 4])) as Record<ReviewDimension, number>, comment: "SYNTHETIC проверенный отзыв", idempotencyKey: key }; }
export function reviewReceipt(input: BuyerReviewInput, workflow = reviewWorkflow(), scope: ReadScope = reviewScope, overrides: Partial<BuyerReviewReceipt> = {}): BuyerReviewReceipt {
  return { id: reviewId(11001), supplierOrderId: workflow.orderId, reviewerOrganizationId: scope.organizationId, reviewerUserId: scope.userId, supplierOrganizationId: workflow.order.supplierOrganizationId, productVariantId: input.productVariantId ?? null, targetKey: input.productVariantId ? `PRODUCT:${input.productVariantId}` : "SUPPLIER", overallRating: input.overallRating, dimensions: { ...input.dimensions }, comment: input.comment ?? null, idempotencyKey: input.idempotencyKey, status: "PENDING", editDeadline: "2026-11-14T01:02:03.000Z", version: 1, createdAt: "2026-10-31T01:02:03.000Z", updatedAt: "2026-10-31T01:02:03.000Z", ...overrides };
}
export function reviewError(status: number) { return new MarketHttpError(status, errorResponseSchema.parse({ statusCode: status, code: "SYNTHETIC_REVIEW_ERROR", message: "SYNTHETIC private review server error", path: "/api/trust/orders/synthetic/reviews", timestamp: "2026-10-31T01:02:03.000Z" })); }
