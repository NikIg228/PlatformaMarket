import { z } from "zod";
import { emailLoginSchema, emailResetPasswordSchema, emailTokenSchema } from "./commercial.js";
import { localOperatorSessionSchema } from "./local-auth.js";

export const authEmailSessionSchema = localOperatorSessionSchema.extend({ activeOrganizationId: z.uuid().nullable() });
export const authEmailVerifiedSchema = authEmailSessionSchema.extend({
  verified: z.literal(true),
  actorId: z.uuid().optional(), displayName: z.string().optional(),
  organizationId: z.uuid().optional(), organizationDisplayName: z.string().optional(),
  capability: z.enum(["BUYER", "SUPPLIER"]).optional(),
  registration: z.object({
    id: z.uuid(), email: z.email(), capability: z.enum(["BUYER", "SUPPLIER"]),
    status: z.literal("CLAIMED"), expiresAt: z.iso.datetime(), createdAt: z.iso.datetime(), organizationId: z.uuid(),
  }).optional(),
});
export const authPasswordResetResultSchema = z.object({ ok: z.literal(true) }).strict();

export const mfaStatusSchema = z.object({
  enabled: z.boolean(), status: z.enum(["NOT_ENROLLED", "PENDING", "ACTIVE", "REVOKED"]),
  verifiedAt: z.iso.datetime().nullable(), lastUsedAt: z.iso.datetime().nullable(),
  recoveryCodesRemaining: z.number().int().nonnegative(), lockedUntil: z.iso.datetime().nullable(),
}).strict();
export const mfaEnrollmentSchema = z.object({ factorId: z.uuid(), secret: z.string().min(1), recoveryCodes: z.array(z.string()), otpauthUri: z.string().startsWith("otpauth://totp/") }).strict();
export const mfaVerifiedFactorSchema = z.object({ enabled: z.literal(true), verifiedAt: z.iso.datetime(), recoveryCodesRemaining: z.number().int().nonnegative() }).strict();
export const mfaChallengeFactorSchema = z.object({ verified: z.literal(true), method: z.enum(["TOTP", "RECOVERY_CODE"]), challengeId: z.uuid(), recoveryCodesRemaining: z.number().int().nonnegative() }).strict();
export const mfaElevatedSessionSchema = z.object({ accessToken: z.string().min(1), accessTokenExpiresIn: z.number().int().positive(), activeOrganizationId: z.uuid(), authenticationMethods: z.array(z.string()) });
export const mfaVerificationResultSchema = z.union([mfaElevatedSessionSchema.extend({ factor: mfaVerifiedFactorSchema }).strict(), mfaVerifiedFactorSchema]);
export const mfaChallengeResultSchema = z.union([mfaElevatedSessionSchema.extend({ factor: mfaChallengeFactorSchema }).strict(), mfaChallengeFactorSchema]);
export const mfaDisabledSchema = z.object({ enabled: z.literal(false) }).strict();

export type AuthEmailLogin = z.input<typeof emailLoginSchema>;
export type AuthEmailToken = z.input<typeof emailTokenSchema>;
export type AuthPasswordReset = z.input<typeof emailResetPasswordSchema>;
export type AuthEmailSession = z.infer<typeof authEmailSessionSchema>;
export type AuthEmailVerified = z.infer<typeof authEmailVerifiedSchema>;
export type AuthPasswordResetResult = z.infer<typeof authPasswordResetResultSchema>;
export type MfaStatus = z.infer<typeof mfaStatusSchema>;
export type MfaEnrollment = z.infer<typeof mfaEnrollmentSchema>;
export type MfaVerificationResult = z.infer<typeof mfaVerificationResultSchema>;
export type MfaChallengeResult = z.infer<typeof mfaChallengeResultSchema>;
export type MfaElevatedSession = z.infer<typeof mfaElevatedSessionSchema>;
export type MfaDisabled = z.infer<typeof mfaDisabledSchema>;
