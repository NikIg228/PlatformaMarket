import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const identityVerificationSchema = z.discriminatedUnion("status", [
  z.object({ protocol: z.literal(1), status: z.literal("VERIFIED"), trustProfile: z.enum(["TEST", "PRODUCTION"]),
    policySha256: hash, iin: z.string().regex(/^\d{12}$/), originalSha256: hash, cmsSha256: hash,
    certificateSha256: hash, verifiedAt: z.iso.datetime(), timestampAt: z.iso.datetime(),
    validFrom: z.iso.datetime(), validUntil: z.iso.datetime(),
    certificatesBase64: z.array(z.string().min(4).max(100_000)).length(6),
    revocations: z.array(z.object({ source: z.string().url(), sha256: hash,
      thisUpdate: z.iso.datetime(), nextUpdate: z.iso.datetime(), contentBase64: z.string().min(4).max(10_666_668) }).strict()).length(4),
  }).strict(),
  z.object({ protocol: z.literal(1), status: z.literal("REJECTED"), code: z.enum([
    "INVALID_SIGNATURE", "CERTIFICATE_EXPIRED", "CERTIFICATE_REVOKED", "IDENTITY_MISMATCH",
    "VERIFIER_UNAVAILABLE", "TRUST_INDETERMINATE", "SESSION_EXPIRED",
  ]) }).strict(),
]);
export type IdentityVerification = z.infer<typeof identityVerificationSchema>;
export type IdentityVerifierInput = { original: Buffer; cms: Buffer; createdAt: Date; acceptedAt: Date };
