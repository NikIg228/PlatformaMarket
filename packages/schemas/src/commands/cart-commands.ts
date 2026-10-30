import { z } from "zod";
import { cartLineSnapshotSchema } from "../core-api.js";

export const createCartSchema = z.object({
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default("KZT"),
});

export const addCartItemSchema = z.object({
  offerId: z.uuid(),
  quantity: z.number().positive().max(1_000_000),
});

export const checkoutCartSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  expectedVersion: z.number().int().positive().optional(),
});

export const cartVersionSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

// Recovery is inherently idempotent per source cart, including across sessions.
export const recoverCartSchema = cartVersionSchema;

export type RecoverCartRequest = z.infer<typeof recoverCartSchema>;

export const updateCartItemSchema = cartVersionSchema.extend({
  quantity: z.number().positive().max(1_000_000).multipleOf(0.000001),
});

export const repriceCartSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  acceptedItems: z.array(z.object({ cartItemId: z.uuid(), snapshot: cartLineSnapshotSchema }).strict()).max(500).optional(),
}).strict().superRefine(({ acceptedItems }, context) => {
  const ids = new Set<string>();
  for (const [index, item] of (acceptedItems ?? []).entries()) {
    if (ids.has(item.cartItemId)) context.addIssue({ code: "custom", message: "Duplicate accepted cart item", path: ["acceptedItems", index, "cartItemId"] });
    ids.add(item.cartItemId);
  }
});

export type UpdateCartItemRequest = z.infer<typeof updateCartItemSchema>;

export type CartVersionRequest = z.infer<typeof cartVersionSchema>;

export type RepriceCartRequest = z.infer<typeof repriceCartSchema>;

export type CreateCartInput = z.infer<typeof createCartSchema>;

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export type CheckoutCartInput = z.infer<typeof checkoutCartSchema>;

export type CreateCartRequest = z.input<typeof createCartSchema>;

export type AddCartItemRequest = z.input<typeof addCartItemSchema>;

export type CheckoutCartRequest = z.input<typeof checkoutCartSchema>;
