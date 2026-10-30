import { z } from "zod";
import { decimalStringSchema, currencySchema, inventoryReservationResponseSchema, nullableDateTimeSchema, dateTimeSchema, organizationSummarySchema } from "./primitives.js";
import { orderDocumentResponseSchema } from "./documents.js";
import { checkoutCartSnapshotResponseSchema } from "./cart.js";

export const shipmentStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "PACKING",
  "READY",
  "DISPATCHED",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
]);

export const supplierOrderItemResponseSchema = z
  .object({
    id: z.uuid(),
    giftForItemId: z.uuid().nullable().optional(),
    supplierOrderId: z.uuid(),
    offerId: z.uuid(),
    productVariantId: z.uuid(),
    quantity: decimalStringSchema,
    acceptedQuantity: decimalStringSchema.nullable(),
    decisionReason: z.string().nullable(),
    unitPriceMinor: decimalStringSchema,
    totalPriceMinor: decimalStringSchema,
    currency: currencySchema,
    status: z.string(),
    warehouseId: z.uuid(),
    warehouse: z
      .object({ id: z.uuid(), name: z.string(), code: z.string() })
      .passthrough()
      .optional(),
    reservation: inventoryReservationResponseSchema.nullable().optional(),
    offer: z
      .object({
        id: z.uuid(),
        productVariant: z.object({
          id: z.uuid(),
          product: z
            .object({ id: z.uuid(), canonicalName: z.string() })
            .passthrough(),
        }),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const fulfillmentStepResponseSchema = z
  .object({
    id: z.uuid(),
    shipmentId: z.uuid(),
    type: z.string(),
    status: z.string(),
    sequence: z.number().int().positive(),
    scheduledAt: nullableDateTimeSchema,
    startedAt: nullableDateTimeSchema,
    completedAt: nullableDateTimeSchema,
    notes: z.string().nullable(),
  })
  .passthrough();

export const shipmentItemResponseSchema = z
  .object({
    id: z.uuid(),
    shipmentId: z.uuid(),
    supplierOrderItemId: z.uuid(),
    quantity: decimalStringSchema,
    deliveredQuantity: decimalStringSchema,
    resupplyQuantity: decimalStringSchema.optional(),
    resupplyReservationId: z.uuid().nullable().optional(),
  })
  .passthrough();

export const shipmentResponseSchema = z
  .object({
    id: z.uuid(),
    supplierOrderId: z.uuid(),
    warehouseId: z.uuid(),
    shipmentNumber: z.string(),
    resupplyDiscrepancyId: z.uuid().nullable().optional(),
    resupplySourceShipmentId: z.uuid().nullable().optional(),
    method: z.string(),
    status: shipmentStatusSchema,
    trackingNumber: z.string().nullable(),
    carrierName: z.string().nullable(),
    pickup: z.boolean(),
    deliveryWindowStart: nullableDateTimeSchema,
    deliveryWindowEnd: nullableDateTimeSchema,
    recipientName: z.string(),
    recipientPhone: z.string().nullable(),
    dispatchedAt: nullableDateTimeSchema,
    deliveredAt: nullableDateTimeSchema,
    failureReason: z.string().nullable(),
    version: z.number().int().positive(),
    warehouse: z
      .object({ id: z.uuid(), name: z.string(), code: z.string() })
      .passthrough()
      .optional(),
    items: z.array(shipmentItemResponseSchema),
    fulfillmentSteps: z.array(fulfillmentStepResponseSchema),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

export const shipmentListResponseSchema = z.array(shipmentResponseSchema);

export const supplierOrderResponseSchema = z
  .object({
    reviewEligible: z.boolean().optional(),
    id: z.uuid(),
    checkoutId: z.uuid(),
    supplierOrganizationId: z.uuid(),
    buyerOrganizationId: z.uuid(),
    orderNumber: z.string(),
    status: z.string(),
    paymentStatus: z.string(),
    subtotalAmountMinor: decimalStringSchema,
    currency: currencySchema,
    transactionMode: z.string(),
    version: z.number().int().positive(),
    supplier: organizationSummarySchema.optional(),
    buyer: organizationSummarySchema.optional(),
    items: z.array(supplierOrderItemResponseSchema),
    shipments: z.array(shipmentResponseSchema).optional(),
    documents: z.array(orderDocumentResponseSchema).optional(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

export const supplierOrderListResponseSchema = z.array(
  supplierOrderResponseSchema,
);

export const checkoutResponseSchema = z
  .object({
    id: z.uuid(),
    cartId: z.uuid(),
    buyerOrganizationId: z.uuid(),
    totalAmountMinor: decimalStringSchema,
    currency: currencySchema,
    status: z.string(),
    idempotencyKey: z.string(),
    failureReason: z.string().nullable(),
    cart: checkoutCartSnapshotResponseSchema,
    supplierOrders: z.array(supplierOrderResponseSchema),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export type SupplierOrderResponse = z.infer<typeof supplierOrderResponseSchema>;

export type ShipmentResponse = z.infer<typeof shipmentResponseSchema>;
