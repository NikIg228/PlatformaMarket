import { z } from "zod";
import { shipmentStatusSchema } from "../core-api.js";

export const deliveryMethodSchema = z.enum(["PICKUP", "SUPPLIER_CITY", "SELECTED_CITIES", "NATIONWIDE", "CARRIER", "MARKETPLACE_LOGISTICS", "PRICE_ON_REQUEST", "SPECIAL"]);

export const deliveryPriceTypeSchema = z.enum(["FREE", "FIXED", "FREE_FROM_AMOUNT", "PRICE_ON_REQUEST"]);

export const createDeliveryZoneSchema = z.object({
  name: z.string().trim().min(2).max(160),
  cityIds: z.array(z.uuid()).min(1).max(500),
});

const deliveryPricingFields = z.object({
  method: deliveryMethodSchema,
  priceType: deliveryPriceTypeSchema,
  fixedAmountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  freeFromAmountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default("KZT"),
  minLeadTimeHours: z.number().int().nonnegative().max(24 * 365).default(0),
  maxLeadTimeHours: z.number().int().nonnegative().max(24 * 365).nullable().optional(),
}).superRefine((value, context) => {
  if (value.priceType === "FIXED" && value.fixedAmountMinor == null) context.addIssue({ code: "custom", message: "Fixed delivery requires fixedAmountMinor", path: ["fixedAmountMinor"] });
  if (value.priceType === "FREE_FROM_AMOUNT" && value.freeFromAmountMinor == null) context.addIssue({ code: "custom", message: "Free-from delivery requires freeFromAmountMinor", path: ["freeFromAmountMinor"] });
  if (value.priceType === "FREE_FROM_AMOUNT" && value.fixedAmountMinor == null) context.addIssue({ code: "custom", message: "Free-from delivery requires a fallback fixedAmountMinor", path: ["fixedAmountMinor"] });
  if (value.maxLeadTimeHours != null && value.maxLeadTimeHours < value.minLeadTimeHours) context.addIssue({ code: "custom", message: "Maximum lead time must not be below minimum", path: ["maxLeadTimeHours"] });
});

export const createOfferDeliveryOptionSchema = deliveryPricingFields.and(z.object({
  warehouseId: z.uuid(),
  pickupInstructions: z.string().trim().max(1_000).nullable().optional(),
  temperatureControlled: z.boolean().default(false),
  installationRequired: z.boolean().default(false),
}));

export const offerDeliveryOptionResponseSchema = z.object({
  id: z.uuid(), offerId: z.uuid(), warehouseId: z.uuid(), method: deliveryMethodSchema,
  priceType: deliveryPriceTypeSchema, fixedAmountMinor: z.string().nullable(),
  freeFromAmountMinor: z.string().nullable(), currency: z.string(),
  minLeadTimeHours: z.number().int(), maxLeadTimeHours: z.number().int().nullable(),
  pickupInstructions: z.string().nullable(), temperatureControlled: z.boolean(),
  installationRequired: z.boolean(), status: z.string(),
});

export const offerDeliveryOptionsResponseSchema = z.array(offerDeliveryOptionResponseSchema);

export type OfferDeliveryOptionResponse = z.infer<typeof offerDeliveryOptionResponseSchema>;

export const createDeliveryRuleSchema = deliveryPricingFields.and(z.object({
  warehouseId: z.uuid().nullable().optional(),
  deliveryZoneId: z.uuid().nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(160),
  priority: z.number().int().min(0).max(10_000).default(100),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
}));

export const updateDeliveryRuleSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(2).max(160).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
}).refine(({ version: _version, ...changes }) => Object.values(changes).some((value) => value !== undefined), "At least one delivery-rule field must change");

export const deliveryQuoteSchema = z.object({
  destinationCityId: z.uuid().nullable().optional(),
});

export const createShipmentSchema = z.object({
  warehouseId: z.uuid(),
  method: deliveryMethodSchema,
  recipientName: z.string().trim().min(2).max(160),
  recipientPhone: z.string().trim().max(40).nullable().optional(),
  destinationAddress: z.record(z.string(), z.unknown()).nullable().optional(),
  deliveryWindowStart: z.iso.datetime().nullable().optional(),
  deliveryWindowEnd: z.iso.datetime().nullable().optional(),
  trackingNumber: z.string().trim().max(160).nullable().optional(),
  carrierName: z.string().trim().max(160).nullable().optional(),
  items: z.array(z.object({ supplierOrderItemId: z.uuid(), quantity: z.number().positive() })).min(1).max(500),
  fulfillmentSteps: z.array(z.object({ type: z.enum(["PICKUP", "DELIVERY", "INSTALLATION", "TRAINING", "SERVICE"]), providerOrganizationId: z.uuid().nullable().optional(), scheduledAt: z.iso.datetime().nullable().optional(), notes: z.string().trim().max(1_000).nullable().optional() })).max(50).default([]),
}).refine((value) => !value.deliveryWindowStart || !value.deliveryWindowEnd || value.deliveryWindowStart <= value.deliveryWindowEnd, "Delivery window start must not be after end");

export const transitionShipmentSchema = z.object({
  version: z.number().int().positive(),
  status: shipmentStatusSchema.exclude(["DRAFT"]),
  trackingNumber: z.string().trim().max(160).nullable().optional(),
  carrierName: z.string().trim().max(160).nullable().optional(),
  failureReason: z.string().trim().max(1_000).nullable().optional(),
  proofOfDelivery: z.record(z.string(), z.unknown()).nullable().optional(),
  deliveredItems: z.array(z.object({ shipmentItemId: z.uuid(), deliveredQuantity: z.number().nonnegative() })).max(500).optional(),
});

export const transitionFulfillmentStepSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"]),
  notes: z.string().trim().max(1_000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;

export type CreateOfferDeliveryOptionInput = z.infer<typeof createOfferDeliveryOptionSchema>;

export type CreateDeliveryRuleInput = z.infer<typeof createDeliveryRuleSchema>;

export type UpdateDeliveryRuleInput = z.infer<typeof updateDeliveryRuleSchema>;

export type DeliveryQuoteInput = z.infer<typeof deliveryQuoteSchema>;

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export type TransitionShipmentInput = z.infer<typeof transitionShipmentSchema>;

export type CreateShipmentRequest = z.input<typeof createShipmentSchema>;

export type TransitionShipmentRequest = z.input<typeof transitionShipmentSchema>;

export type TransitionFulfillmentStepInput = z.infer<typeof transitionFulfillmentStepSchema>;
