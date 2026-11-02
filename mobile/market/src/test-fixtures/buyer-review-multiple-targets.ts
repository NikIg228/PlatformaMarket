import { orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import type { BuyerReviewInput, BuyerReviewReceipt } from "../buyer-review-create";
import type { BuyerReviewUpdateInput } from "../buyer-review-update";
import { reviewWorkflow, reviewReceipt, reviewScope, reviewId } from "./buyer-review";
export { reviewScope as multipleReviewScope, reviewId as multipleReviewId };
export function multipleReviewWorkflow(duplicateLine = false) { const value = reviewWorkflow(); value.status = value.order.status = "DELIVERED"; const first = value.order.items[0]!; first.status = "DELIVERED"; first.acceptedQuantity = first.quantity; value.order.items.push({ ...first, id: reviewId(140002), productVariantId: reviewId(140003), offerId: reviewId(140004) }); if (duplicateLine) value.order.items.push({ ...first, id: reviewId(140005) }); value.order.subtotalAmountMinor = value.order.items.reduce((sum, row) => sum + BigInt(row.totalPriceMinor), 0n).toString(); return orderWorkflowResponseSchema.parse(value); }
export function multipleReviewReceipt(input: BuyerReviewInput, serial = 1, workflow = multipleReviewWorkflow()) { return reviewReceipt(input, workflow, reviewScope, { id: reviewId(140100 + serial), status: "PUBLISHED" }); }
export function multipleReviewUpdated(base: BuyerReviewReceipt, input: BuyerReviewUpdateInput): BuyerReviewReceipt { return { ...base, overallRating: input.overallRating, dimensions: { ...input.dimensions }, comment: input.comment ?? null, version: input.version + 1, updatedAt: "2026-11-01T00:00:00.000Z" }; }
