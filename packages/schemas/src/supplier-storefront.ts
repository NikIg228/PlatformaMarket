import { z } from "zod";
import { organizationContactSchema } from "./organization-profile.js";
import { uploadProfileAvatarSchema } from "./personal-profile.js";
import { searchCatalogSchema } from "./commands/catalog-search.js";

export const storefrontLocaleSchema = z.object({
  description: z.string().trim().max(1000).default(""),
  location: z.string().trim().max(300).default(""),
  hours: z.string().trim().max(300).default(""),
  delivery: z.string().trim().max(600).default(""),
}).strict();
export const storefrontContentSchema = z.object({
  ru: storefrontLocaleSchema,
  kk: storefrontLocaleSchema,
}).strict();
export const supplierStorefrontSchema = z.object({
  supplierId: z.uuid(), name: z.string(),
  content: storefrontContentSchema,
  logoUrl: z.string().nullable(),
  contact: organizationContactSchema.nullable(),
}).strict();
export const supplierStorefrontSettingsSchema = supplierStorefrontSchema.extend({
  version: z.number().int().nonnegative(),
  published: z.boolean(), canEdit: z.boolean(),
}).strict();
export const saveSupplierStorefrontSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  content: storefrontContentSchema,
}).strict();
export const uploadSupplierLogoSchema = uploadProfileAvatarSchema.extend({ expectedVersion: z.number().int().nonnegative() });
// Supplier and availability are fixed by the route, not by caller-controlled query fields.
export const supplierStorefrontQuerySchema = z.object(searchCatalogSchema.shape).omit({
  buyerOrganizationId: true, supplierOrganizationId: true, inStock: true, priceBasis: true,
  minNormalizedPriceMinor: true, maxNormalizedPriceMinor: true,
});
export type SupplierStorefront = z.infer<typeof supplierStorefrontSchema>;
export type SupplierStorefrontSettings = z.infer<typeof supplierStorefrontSettingsSchema>;
export type SaveSupplierStorefront = z.infer<typeof saveSupplierStorefrontSchema>;
export type UploadSupplierLogo = z.infer<typeof uploadSupplierLogoSchema>;
export type SupplierStorefrontQuery = z.input<typeof supplierStorefrontQuerySchema>;
