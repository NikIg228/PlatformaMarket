import { z } from "zod";

export const organizationCapabilitySchema = z.enum([
  "BUYER",
  "SUPPLIER",
  "IMPORTER",
  "LOGISTICS_PROVIDER",
  "SERVICE_PROVIDER",
  "MARKETPLACE_OPERATOR",
  "PAYMENT_PARTNER",
]);

export const createOrganizationSchema = z.object({
  legalName: z.string().trim().min(2).max(240),
  displayName: z.string().trim().min(2).max(160),
  bin: z.string().regex(/^\d{12}$/, "БИН должен содержать 12 цифр"),
  capabilities: z.array(organizationCapabilitySchema).min(1),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const createInvitationSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  roleIds: z.array(z.uuid()).max(20).default([]),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(256),
  displayName: z.string().trim().min(2).max(160),
  password: z.string().min(12).max(128).optional(),
  mfaCode: z.string().trim().min(6).max(32).optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const createRoleSchema = z.object({
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{2,62}$/),
  name: z.string().trim().min(2).max(120),
  permissionCodes: z.array(z.string().trim().min(3).max(120)).min(1).max(100),
});

export const assignMembershipRoleSchema = z.object({ roleId: z.uuid() });

export const updateMembershipSchema = z.object({
  title: z.string().trim().min(2).max(120).nullable().optional(),
  status: z.enum(["ACTIVE", "BLOCKED", "REVOKED"]).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export type AssignMembershipRoleInput = z.infer<typeof assignMembershipRoleSchema>;

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

export const mfaCodeSchema = z.object({
  code: z.string().trim().regex(/^(?:\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/i),
});

export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;
