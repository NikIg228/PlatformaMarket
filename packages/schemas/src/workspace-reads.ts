import { z } from "zod";
import { cartResponseSchema } from "./core-api";

export const workspacePageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(1500).optional(),
  q: z.string().trim().max(160).default(""),
});
export const workspaceOrderStatusSchema = z.enum(["DRAFT", "AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "RESERVED", "AWAITING_PAYMENT", "PAID", "ASSEMBLING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "DELIVERED", "PARTIALLY_FULFILLED", "RETURN_DISPUTE", "REJECTED", "CANCELLED"]);
export const workspaceOrderQuerySchema = workspacePageQuerySchema.extend({ status: workspaceOrderStatusSchema.optional() });
const page = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const date = z.iso.datetime();
const party = z.object({ id: z.uuid(), displayName: z.string() });
export const workspaceOrderSchema = z.object({
  id: z.uuid(), orderNumber: z.string(), status: workspaceOrderStatusSchema, paymentStatus: z.string(),
  subtotalAmountMinor: decimal, currency: z.string(), createdAt: date,
  supplier: party, buyer: party, itemCount: z.number().int().nonnegative(),
});
export const workspaceOrderPageSchema = page(workspaceOrderSchema);
export const workspaceOfferSchema = z.object({
  id: z.uuid(), version: z.number().int(), productVariantId: z.uuid(), supplierSku: z.string().nullable(),
  status: z.string(), sourceType: z.string(), confirmationMode: z.string(),
  minimumOrderQuantity: decimal, orderIncrement: decimal, baseUnitsPerSaleUnit: decimal, createdAt: date,
  productVariant: z.object({ product: z.object({ id: z.uuid(), canonicalName: z.string(), description: z.string().nullable(), manufacturerSku: z.string().nullable(), gtin: z.string().nullable(), productType: z.string(), regulatoryClass: z.string().nullable() }) }),
  saleUnit: z.object({ nameRu: z.string(), symbol: z.string() }).nullable(),
  packaging: z.object({ id: z.uuid(), name: z.string(), quantityInBaseUnit: decimal, unit: z.object({ symbol: z.string() }) }).nullable(),
  publication: z.object({ status: z.string(), marketplaceVisible: z.boolean(), blockedReason: z.string().nullable() }).nullable(),
  prices: z.array(z.object({ id: z.uuid(), amountMinor: decimal, currency: z.string(), status: z.string(), includesVat: z.boolean(), vatRate: decimal.nullable(), source: z.string(), lastConfirmedAt: date.nullable(), freshnessExpiresAt: date.nullable() })),
  inventoryBalances: z.array(z.object({ id: z.uuid(), warehouseId: z.uuid(), warehouse: z.object({ name: z.string() }), quantityOnHand: decimal, quantityAvailable: decimal, quantityReserved: decimal, freshnessStatus: z.string(), freshnessExpiresAt: date.nullable(), source: z.string(), updatedAt: date })),
});
export const workspaceOfferPageSchema = page(workspaceOfferSchema);
export const workspaceCartPageSchema = z.object({ current: cartResponseSchema.nullable(), ...page(cartResponseSchema).shape });
export const workspaceSummarySchema = z.object({ orders: z.number().int().nonnegative(), offers: z.number().int().nonnegative(), publishedOffers: z.number().int().nonnegative() });
export type WorkspacePageQuery = z.input<typeof workspacePageQuerySchema>;
export type WorkspaceOrderQuery = z.input<typeof workspaceOrderQuerySchema>;
export type WorkspaceOrderPage = z.infer<typeof workspaceOrderPageSchema>;
export type WorkspaceOffer = z.infer<typeof workspaceOfferSchema>;
export type WorkspaceOfferPage = z.infer<typeof workspaceOfferPageSchema>;
export type WorkspaceCartPage = z.infer<typeof workspaceCartPageSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
