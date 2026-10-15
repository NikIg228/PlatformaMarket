import { z } from "zod";
import { organizationProfileFieldsSchema } from "./organization-profile";

export const operatorOrganizationStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export const operatorOrganizationCapabilitySchema = z.enum(["BUYER", "SUPPLIER", "IMPORTER", "LOGISTICS_PROVIDER", "SERVICE_PROVIDER", "MARKETPLACE_OPERATOR", "PAYMENT_PARTNER"]);
const queryInteger = (maximum: number, fallback: number, minimum = 0) => z.preprocess(
  value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(minimum).max(maximum).default(fallback),
);
export const operatorOrganizationsQuerySchema = z.strictObject({
  q: z.string().max(200).regex(/^[^\u0000-\u001f\u007f]*$/).trim().optional(),
  status: operatorOrganizationStatusSchema.optional(),
  capability: operatorOrganizationCapabilitySchema.optional(),
  offset: queryInteger(1_000_000, 0),
  limit: queryInteger(100, 25, 1),
});
export const operatorOrganizationSchema = z.strictObject({
  id: z.uuid(), legalName: z.string(), displayName: z.string(), bin: z.string(),
  status: operatorOrganizationStatusSchema,
  capabilities: z.array(operatorOrganizationCapabilitySchema),
  createdAt: z.iso.datetime(),
});
export const operatorOrganizationsSchema = z.strictObject({
  items: z.array(operatorOrganizationSchema), total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(), limit: z.number().int().min(1).max(100),
});
export const operatorOrganizationDetailSchema = operatorOrganizationSchema.extend({
  version: z.number().int().positive(), canEdit: z.literal(false),
  profile: organizationProfileFieldsSchema.nullable(),
  profileCities: z.strictObject({ legal: z.string().nullable(), delivery: z.string().nullable() }).nullable(),
});
export type OperatorOrganizationsQuery = z.infer<typeof operatorOrganizationsQuerySchema>;
export type OperatorOrganization = z.infer<typeof operatorOrganizationSchema>;
export type OperatorOrganizations = z.infer<typeof operatorOrganizationsSchema>;
export type OperatorOrganizationDetail = z.infer<typeof operatorOrganizationDetailSchema>;
