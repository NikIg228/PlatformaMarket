import { expect, it } from "vitest";
import { createVerifiedReviewSchema, orderReviewStateSchema } from "./trust-commerce";
const id = "00000000-0000-4000-8000-000000000001";
it("allows a received-order review without inventing unobserved document scores", () => {
  const input = { overallRating: 4, dimensions: {}, idempotencyKey: "review-test" };
  expect(createVerifiedReviewSchema.safeParse(input).success).toBe(true);
  expect(createVerifiedReviewSchema.safeParse({ ...input, dimensions: { documents: 0 } }).success).toBe(false);
  expect(createVerifiedReviewSchema.safeParse({ ...input, overallRating: 6 }).success).toBe(false);
  expect(createVerifiedReviewSchema.safeParse({ ...input, comment: "x".repeat(4001) }).success).toBe(false);
});
it("validates authoritative receipt eligibility and a saved review independently", () => {
  expect(orderReviewStateSchema.parse({ orderId: id, eligible: false, review: null }).eligible).toBe(false);
  expect(orderReviewStateSchema.safeParse({ orderId: id, eligible: true, review: { id, overallRating: 5, comment: null, status: "PENDING" } }).success).toBe(true);
  expect(orderReviewStateSchema.safeParse({ orderId: id, eligible: "DELIVERED", review: null }).success).toBe(false);
});
