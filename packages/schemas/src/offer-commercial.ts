import { z } from "zod";

export const saveOfferCommercialSchema = z.object({
  warehouseId: z.uuid(),
  expectedOfferVersion: z.number().int().positive(),
  expectedBalanceVersion: z.number().int().positive().nullable(),
  idempotencyKey: z.string().trim().min(8).max(160),
  amountMinor: z.string().regex(/^(0|[1-9]\d{0,19})$/),
  currency: z.literal("KZT"),
  includesVat: z.boolean(),
  vatRate: z.number().min(0).max(100).nullable(),
  quantityOnHand: z.number().finite().nonnegative(),
});

export const saveOfferStockSchema = saveOfferCommercialSchema.pick({ warehouseId: true, expectedOfferVersion: true,
  expectedBalanceVersion: true, idempotencyKey: true, quantityOnHand: true }).strict();
export const saveOfferPriceSchema = saveOfferCommercialSchema.omit({ quantityOnHand: true }).strict();

export const offerCommercialStateSchema = z.object({
  offerId: z.uuid(), offerVersion: z.number().int().positive(), warehouseId: z.uuid(),
  publicationStatus: z.string(), marketplaceVisible: z.boolean(),
  price: z.object({ amountMinor: z.string(), currency: z.string(), includesVat: z.boolean(), vatRate: z.string().nullable() }).nullable(),
  balance: z.object({ id: z.uuid(), version: z.number().int().positive(), quantityOnHand: z.string(), quantityReserved: z.string(),
    safetyStock: z.string(), quantityAvailable: z.string(), availabilityStatus: z.string() }).nullable(),
});

export type SaveOfferCommercialInput = z.infer<typeof saveOfferCommercialSchema>;
export type SaveOfferStockInput = z.infer<typeof saveOfferStockSchema>;
export type SaveOfferPriceInput = z.infer<typeof saveOfferPriceSchema>;
export type OfferCommercialState = z.infer<typeof offerCommercialStateSchema>;
