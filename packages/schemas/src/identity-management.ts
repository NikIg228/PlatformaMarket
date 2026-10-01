import { z } from "zod";

const timestamp = z.iso.datetime();
export const invitationSummarySchema = z.object({
  id: z.uuid(), email: z.email(), status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]),
  expiresAt: timestamp, createdAt: timestamp, roleIds: z.array(z.uuid()),
}).strict();
export const invitationListSchema = z.array(invitationSummarySchema);
export const invitationCreatedSchema = z.object({
  invitationId: z.uuid(), email: z.email(), expiresAt: timestamp, token: z.string().min(32),
}).strict();
export const invitationDeliveredSchema = z.object({
  invitationId: z.uuid(), expiresAt: timestamp, delivery: z.enum(["LOCAL_FILE", "PROVIDER"]),
}).strict();
export const invitationAcceptedSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.email(), displayName: z.string() }).strict(),
  membership: z.object({ id: z.uuid(), organizationId: z.uuid(), status: z.literal("ACTIVE"),
    roles: z.array(z.object({ roleId: z.uuid() })) }),
}).strict();
export const invitationProofSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const invitationDetailsSchema = z.object({
  organizationName: z.string(), email: z.email(), expiresAt: timestamp,
  roles: z.array(z.string()), accountExists: z.boolean(), mfaRequired: z.boolean(),
}).strict();
export const identityRoleSchema = z.object({
  id: z.uuid(), code: z.string(), name: z.string(), isSystem: z.boolean(),
  permissions: z.array(z.object({ permission: z.object({ code: z.string(), description: z.string() }) })),
});
export const identityRolesSchema = z.array(identityRoleSchema);
export const identityMemberSchema = z.object({
  id: z.uuid(), userId: z.uuid(), organizationId: z.uuid(), title: z.string().nullable(),
  status: z.enum(["INVITED", "ACTIVE", "BLOCKED", "REVOKED"]),
  user: z.object({ id: z.uuid(), email: z.email(), displayName: z.string(), status: z.string() }),
  roles: z.array(z.object({ roleId: z.uuid(), role: z.object({ id: z.uuid(), name: z.string(), code: z.string() }) })),
});
export const identityMembersSchema = z.array(identityMemberSchema);
export const identitySessionsSchema = z.array(z.object({
  id: z.uuid(), activeOrganizationId: z.uuid().nullable(), authMethods: z.array(z.string()),
  ipAddress: z.string().nullable(), userAgent: z.string().nullable(), lastUsedAt: timestamp.nullable(),
  expiresAt: timestamp, createdAt: timestamp,
}));
export const identityCommandResultSchema = z.object({ ok: z.literal(true) }).strict();
export const identitySessionRevokedSchema = z.object({ id: z.uuid(), status: z.literal("REVOKED") }).strict();
export type IdentitySessionRevoked = z.infer<typeof identitySessionRevokedSchema>;
export type InvitationSummary = z.infer<typeof invitationSummarySchema>;
export type InvitationCreated = z.infer<typeof invitationCreatedSchema>;
export type InvitationDelivered = z.infer<typeof invitationDeliveredSchema>;
export type InvitationAccepted = z.infer<typeof invitationAcceptedSchema>;
export type InvitationDetails = z.infer<typeof invitationDetailsSchema>;
export type IdentityRole = z.infer<typeof identityRoleSchema>;
export type IdentityMember = z.infer<typeof identityMemberSchema>;
export type IdentitySession = z.infer<typeof identitySessionsSchema>[number];
