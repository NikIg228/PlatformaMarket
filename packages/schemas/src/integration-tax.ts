import { z } from "zod";
import { vatSelectionSchema } from "./vat";

export const integrationPriceTaxSchema = z.object({
  priceIncludesVat: z.boolean(), defaultVat: vatSelectionSchema.optional(),
  vatMode: z.string().trim().min(1).max(120).optional(), vatRate: z.string().trim().min(1).max(120).optional(),
  vatBasis: z.string().trim().min(1).max(120).optional(), expectedRequisitesVersion: z.number().int().positive(), taxAcknowledged: z.literal(true),
}).strict();
export const integrationTaxBindingSchema = z.object({
  id: z.uuid(), connectionId: z.uuid(), connectionName: z.string(), provider: z.string(),
  warehouseId: z.uuid().nullable(), offerId: z.uuid().nullable(), priority: z.number().int(),
  updatedAt: z.iso.datetime(), priceTax: integrationPriceTaxSchema.nullable(),
});
export const integrationTaxBindingsSchema = z.array(integrationTaxBindingSchema);
export const updateIntegrationTaxSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(), idempotencyKey: z.string().min(8).max(160), priceTax: integrationPriceTaxSchema,
}).strict();
export type IntegrationTaxBinding = z.infer<typeof integrationTaxBindingSchema>;
export type UpdateIntegrationTaxInput = z.infer<typeof updateIntegrationTaxSchema>;
