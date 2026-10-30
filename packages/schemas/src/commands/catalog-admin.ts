import { z } from "zod";

export const createCategorySchema = z.object({
  industryId: z.uuid(),
  parentId: z.uuid().nullable().optional(),
  code: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  nameRu: z.string().trim().min(2).max(160),
  nameKk: z.string().trim().min(2).max(160),
});

export const createProductSchema = z.object({
  canonicalName: z.string().trim().min(3).max(240),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,159}$/),
  productType: z.string().trim().min(2).max(80),
  brandId: z.uuid().nullable().optional(),
  manufacturerId: z.uuid().nullable().optional(),
  manufacturerSku: z.string().trim().max(120).nullable().optional(),
  gtin: z.string().trim().regex(/^\d{8,14}$/).nullable().optional(),
  baseUnitId: z.uuid().nullable().optional(),
  industryIds: z.array(z.uuid()).min(1),
  categoryIds: z.array(z.uuid()).min(1),
});

export const createVariantSchema = z.object({
  sku: z.string().trim().max(120).nullable().optional(),
  gtin: z.string().trim().regex(/^\d{8,14}$/).nullable().optional(),
  saleUnitId: z.uuid().nullable().optional(),
  packageQuantity: z.number().positive().nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;

export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const createAttributeDefinitionSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,62}$/),
  nameRu: z.string().trim().min(2).max(160),
  nameKk: z.string().trim().min(2).max(160),
  valueType: z.enum(["TEXT", "LONG_TEXT", "INTEGER", "DECIMAL", "BOOLEAN", "DATE", "DATETIME", "OPTION", "MULTI_OPTION", "RANGE", "NUMBER_WITH_UNIT"]),
  groupId: z.uuid().nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  isSearchable: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  validation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const setAttributeValueSchema = z.object({
  attributeId: z.uuid(),
  value: z.union([
    z.string().max(10_000),
    z.number(),
    z.boolean(),
    z.object({ optionId: z.uuid() }),
    z.object({ optionIds: z.array(z.uuid()).min(1) }),
    z.object({ min: z.number(), max: z.number() }).refine((value) => value.min <= value.max, "Range minimum must not exceed maximum"),
    z.object({ amount: z.number(), unitId: z.uuid() }),
  ]),
});

export type CreateAttributeDefinitionInput = z.infer<typeof createAttributeDefinitionSchema>;

export type SetAttributeValueInput = z.infer<typeof setAttributeValueSchema>;

export const upsertCategoryAttributeRuleSchema = z.object({
  attributeId: z.uuid(),
  isRequired: z.boolean().default(false),
  isVariant: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  overrides: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type UpsertCategoryAttributeRuleInput = z.infer<typeof upsertCategoryAttributeRuleSchema>;

export const updateProductSchema = z.object({
  version: z.number().int().min(1),
  catalogName: z.string().trim().min(3).max(240).nullable().optional(),
  canonicalName: z.string().trim().min(3).max(240).optional(),
  productType: z.string().trim().min(2).max(80).optional(),
  regulatoryClass: z.string().trim().min(1).max(80).nullable().optional(),
  status: z.enum(["DRAFT", "UNDER_REVIEW", "ACTIVE", "BLOCKED", "ARCHIVED"]).optional(),
  manufacturerSku: z.string().trim().max(120).nullable().optional(),
  gtin: z.string().trim().regex(/^\d{8,14}$/).nullable().optional(),
}).refine(
  ({ version: _version, ...changes }) => Object.values(changes).some((value) => value !== undefined),
  "At least one product field must be changed",
);

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createProductPackagingSchema = z.object({
  unitId: z.uuid(),
  parentPackagingId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  name: z.string().trim().min(1).max(160),
  level: z.enum(["BASE", "SALE", "TRANSPORT"]),
  quantityInBaseUnit: z.number().positive(),
  unitsPerParent: z.number().positive().nullable().optional(),
  gtin: z.string().trim().max(32).nullable().optional(),
  netWeightGrams: z.number().positive().nullable().optional(),
  grossWeightGrams: z.number().positive().nullable().optional(),
  lengthMm: z.number().positive().nullable().optional(),
  widthMm: z.number().positive().nullable().optional(),
  heightMm: z.number().positive().nullable().optional(),
}).refine((value) => !value.netWeightGrams || !value.grossWeightGrams || value.grossWeightGrams >= value.netWeightGrams, "Gross weight cannot be below net weight");

export const assignOfferPackagingSchema = z.object({ packagingId: z.uuid(), version: z.number().int().positive() });

export type CreateProductPackagingInput = z.infer<typeof createProductPackagingSchema>;

export type AssignOfferPackagingInput = z.infer<typeof assignOfferPackagingSchema>;
