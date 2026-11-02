import { z } from "zod";
import { cartLineSnapshotSchema } from "./core-api.js";

// One persistent current cart per user. No organization or caller-supplied owner.
export const personalCartCreateSchema = z.object({}).strict();
export const personalCartVersionSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const personalCartQuantitySchema = z.number().positive().max(1_000_000).multipleOf(0.000001);
export const personalCartAddSchema = personalCartVersionSchema.extend({ offerId: z.uuid(), quantity: personalCartQuantitySchema });
export const personalCartUpdateSchema = personalCartVersionSchema.extend({ quantity: personalCartQuantitySchema });
export const personalCartRepriceSchema = personalCartVersionSchema.extend({
  acceptedItems: z.array(z.object({ cartItemId: z.uuid(), snapshot: cartLineSnapshotSchema }).strict()).min(1).max(500),
}).superRefine(({ acceptedItems }, ctx) => {
  const ids = new Set<string>();
  acceptedItems.forEach((item, index) => {
    if (ids.has(item.cartItemId)) ctx.addIssue({ code: "custom", message: "Duplicate cart item", path: ["acceptedItems", index, "cartItemId"] });
    ids.add(item.cartItemId);
  });
});
export const personalCartItemSchema = z.object({
  id: z.uuid(), offerId: z.uuid(), name: z.string(), supplierName: z.string(),
  snapshot: cartLineSnapshotSchema,
});
export const personalCartSchema = z.object({
  id: z.uuid(), ownerUserId: z.uuid(), mode: z.literal("PERSONAL"), currency: z.literal("KZT"),
  version: z.number().int().positive(), items: z.array(personalCartItemSchema),
  totalAmountMinor: z.string().regex(/^\d+$/), checkoutAvailable: z.literal(false),
});
export const personalCartValidationSchema = z.object({
  cartId: z.uuid(), cartVersion: z.number().int().positive(), checkoutAvailable: z.literal(false),
  items: z.array(z.object({
    cartItemId: z.uuid(), previous: cartLineSnapshotSchema, current: cartLineSnapshotSchema.nullable(),
    changes: z.array(z.enum(["PRICE", "STOCK", "AVAILABILITY", "OFFER_RULES"])),
    requiresAcceptance: z.boolean(), message: z.string().nullable(),
  })),
});
export type PersonalCart = z.infer<typeof personalCartSchema>;
export type PersonalCartAdd = z.infer<typeof personalCartAddSchema>;
export type PersonalCartUpdate = z.infer<typeof personalCartUpdateSchema>;
export type PersonalCartVersion = z.infer<typeof personalCartVersionSchema>;
export type PersonalCartReprice = z.infer<typeof personalCartRepriceSchema>;
export type PersonalCartValidation = z.infer<typeof personalCartValidationSchema>;

// Restored from the existing sign-in HttpOnly cookie; scoped bearer cannot grant
// organization access, even for a user who also belongs to organizations.
export const personalSessionSchema = z.object({
  user: z.object({ id: z.uuid(), displayName: z.string() }), sessionId: z.uuid(),
  accessToken: z.string().min(1), accessTokenExpiresIn: z.number().int().positive(),
  mode: z.literal("PERSONAL"),
});
export type PersonalSession = z.infer<typeof personalSessionSchema>;
