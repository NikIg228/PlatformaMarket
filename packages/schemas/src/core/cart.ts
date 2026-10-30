import { z } from "zod";
import { decimalStringSchema, currencySchema, organizationSummarySchema, dateTimeSchema } from "./primitives.js";
import { vatLineSnapshotSchema } from "../vat";
import { acceptedPromotionSchema } from "../promotions.js";

export const cartItemResponseSchema = z
  .object({
    id: z.uuid(),
    cartId: z.uuid(),
    offerId: z.uuid(),
    quantity: decimalStringSchema,
    unitPriceMinor: decimalStringSchema,
    totalPriceMinor: decimalStringSchema,
    currency: currencySchema,
    priceSource: z.string(),
    priceRuleId: z.string().nullable(),
    pricingSnapshot: z.unknown(),
    offer: z
      .object({
        id: z.uuid(),
        supplierOrganizationId: z.uuid(),
        productVariantId: z.uuid(),
        supplier: z
          .object({ organization: organizationSummarySchema })
          .passthrough()
          .optional(),
        productVariant: z
          .object({
            product: z
              .object({ id: z.uuid(), canonicalName: z.string() })
              .passthrough(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

export const cartResponseSchema = z
  .object({
    id: z.uuid(),
    buyerOrganizationId: z.uuid(),
    currency: currencySchema,
    status: z.string(),
    version: z.number().int().positive(),
    createdById: z.uuid().nullable(),
    items: z.array(cartItemResponseSchema),
    checkout: z.object({ id: z.uuid(), status: z.string().optional() }).passthrough().nullable(),
    recoveredCartId: z.uuid().nullable().optional(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

export const cartListResponseSchema = z.array(cartResponseSchema);

export const cartCommercialTermsSchema = z.object({
  saleUnitId: z.uuid().nullable(),
  saleUnitName: z.string().nullable(),
  packagingId: z.uuid().nullable(),
  packagingName: z.string().nullable(),
  baseUnitsPerSaleUnit: decimalStringSchema,
  packagingUnitId: z.uuid().nullable(),
  packagingQuantity: decimalStringSchema.nullable(),
  includesVat: z.boolean().nullable(),
  vatRate: decimalStringSchema.nullable(),
});

export const cartLineSnapshotSchema = z.object({
  tax: vatLineSnapshotSchema.nullable().optional(),
  resolvedAt: dateTimeSchema,
  offerVersion: z.number().int().nonnegative(),
  source: z.string(),
  ruleId: z.string().nullable(),
  unitPriceMinor: decimalStringSchema,
  quantity: decimalStringSchema,
  totalPriceMinor: decimalStringSchema,
  currency: currencySchema,
  minimumOrderQuantity: decimalStringSchema,
  orderIncrement: decimalStringSchema,
  // Absent on historical carts, which must accept current terms once.
  commercialTerms: cartCommercialTermsSchema.nullable().optional(),
  promotion: acceptedPromotionSchema.nullable().optional(),
  availableQuantity: decimalStringSchema.nullable(),
  fulfillmentStatus: z.enum([
    "AVAILABLE",
    "INSUFFICIENT_STOCK",
    "OUT_OF_STOCK",
  ]),
});

export const cartValidationItemSchema = z.object({
  cartItemId: z.uuid(),
  offerId: z.uuid(),
  status: z.enum(["UNCHANGED", "CHANGED", "UNAVAILABLE"]),
  changes: z.array(z.enum(["PRICE", "STOCK", "AVAILABILITY", "OFFER_RULES"])),
  previous: cartLineSnapshotSchema,
  current: cartLineSnapshotSchema.nullable(),
  canCheckout: z.boolean(),
  requiresAcceptance: z.boolean(),
  message: z.string().nullable(),
});

export const cartValidationResponseSchema = z.object({
  cartId: z.uuid(),
  cartVersion: z.number().int().positive(),
  validatedAt: dateTimeSchema,
  hasChanges: z.boolean(),
  requiresAcceptance: z.boolean(),
  canCheckout: z.boolean(),
  items: z.array(cartValidationItemSchema),
});

export const checkoutCartSnapshotResponseSchema = cartResponseSchema.omit({
  checkout: true,
});

export type CartResponse = z.infer<typeof cartResponseSchema>;

export type CartItemResponse = z.infer<typeof cartItemResponseSchema>;

export type CartLineSnapshotResponse = z.infer<typeof cartLineSnapshotSchema>;

export type CartValidationResponse = z.infer<
  typeof cartValidationResponseSchema
>;
