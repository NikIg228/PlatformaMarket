import { z } from "zod";

export const createOfferPriceTierSchema = z.object({
  minimumQuantity: z.number().positive(),
  maximumQuantity: z.number().positive().nullable().optional(),
  unitPriceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  validFrom: z.iso.datetime().optional(),
  validTo: z.iso.datetime().nullable().optional(),
}).refine((value) => value.maximumQuantity == null || value.minimumQuantity <= value.maximumQuantity, "Tier minimum cannot exceed maximum")
  .refine((value) => !value.validFrom || !value.validTo || value.validFrom <= value.validTo, "Tier start must not be after end");

export const createContractPriceSchema = z.object({
  buyerOrganizationId: z.uuid(),
  contractReference: z.string().trim().max(160).nullable().optional(),
  amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  minimumQuantity: z.number().positive().default(1),
  validFrom: z.iso.datetime().optional(),
  validTo: z.iso.datetime().nullable().optional(),
  priority: z.number().int().min(1).max(10_000).default(100),
}).refine((value) => !value.validFrom || !value.validTo || value.validFrom <= value.validTo, "Contract price start must not be after end");

export const resolveOfferPriceSchema = z.object({
  buyerOrganizationId: z.uuid().optional(),
  quantity: z.number().positive(),
  at: z.iso.datetime().optional(),
});

export type CreateOfferPriceTierInput = z.infer<typeof createOfferPriceTierSchema>;

export type CreateContractPriceInput = z.infer<typeof createContractPriceSchema>;

export type ResolveOfferPriceInput = z.infer<typeof resolveOfferPriceSchema>;
