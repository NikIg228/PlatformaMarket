import { z } from "zod";

// R7.6.1.3 contracts only: no route is enabled by exporting these schemas.
// Parsing does not verify a certificate, membership, authority, ownership or replay.
const version = z.number().int().positive();
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const instant = z.iso.datetime();
const replayKey = z.string().trim().min(8).max(160);
const reason = z.string().trim().min(2).max(1000);
const versionReference = z.strictObject({ id: z.uuid(), version });

export const pilotSigningPurposeSchema = z.enum([
  "BIND_IDENTITY", "AUTHORIZE_EMPLOYEE", "SIGN_WAYBILL",
]);
export const pilotSigningFailureCodeSchema = z.enum([
  "IDENTITY_MISMATCH", "IDENTITY_CONFLICT", "IDENTITY_NOT_VERIFIED",
  "ORGANIZATION_MISMATCH", "AUTHORITY_NOT_ACTIVE", "HEAD_NOT_APPROVED",
  "VERSION_CONFLICT", "CONTENT_MISMATCH", "INVALID_SIGNATURE",
  "CERTIFICATE_EXPIRED", "CERTIFICATE_REVOKED", "TRUST_INDETERMINATE",
  "VERIFIER_UNAVAILABLE", "SESSION_EXPIRED", "SESSION_CANCELLED",
]);

// No IIN, actor, organization, success flag or client-selected lifetime in the request.
export const createPilotIdentityChallengeSchema = z.strictObject({ idempotencyKey: replayKey });

const challengeFields = {
  id: z.uuid(), purpose: pilotSigningPurposeSchema,
  contentBase64: z.string().min(4).max(131072), checksumSha256: checksum,
  createdAt: instant, expiresAt: instant,
};
export const pilotSigningChallengeSchema = z.strictObject(challengeFields).refine(
  value => Date.parse(value.expiresAt) > Date.parse(value.createdAt),
  { path: ["expiresAt"], message: "Challenge must expire after creation" },
);

// Base64 transport for DER CMS; only the verifier can establish the CMS structure.
// PEM normalization belongs at the NCALayer boundary.
// Transport cap: 1 MiB decoded detached CMS, not a document upload size limit.
export const PILOT_CMS_MAX_BYTES = 1024 * 1024;
const cmsBase64 = z.string().min(4).max(4 * Math.ceil(PILOT_CMS_MAX_BYTES / 3))
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
  .refine(value => {
    const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
    return value.length / 4 * 3 - padding <= PILOT_CMS_MAX_BYTES;
  }, "CMS exceeds decoded size limit");
export const submitPilotCmsSchema = z.strictObject({
  sessionId: z.uuid(), expectedSessionVersion: version,
  cmsBase64, idempotencyKey: replayKey,
});

// Read projection for the current account; full IIN/certificates stay in protected evidence.
export const pilotIdentityViewSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("UNVERIFIED") }),
  z.strictObject({ status: z.literal("VERIFIED"), bindingId: z.uuid(), version,
    maskedIin: z.string().regex(/^\*{8}\d{4}$/), verifiedAt: instant }),
]);

export const pilotAuthorityBasisSchema = z.strictObject({
  description: z.string().trim().min(2).max(1000),
  // Existing document reference, never an arbitrary remote URL or storage path.
  document: versionReference,
});
export const submitPilotHeadAdmissionSchema = z.strictObject({
  expectedOrganizationVersion: version, identityBinding: versionReference,
  basis: pilotAuthorityBasisSchema, idempotencyKey: replayKey,
});
export const reviewPilotHeadAdmissionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("APPROVE"), expectedVersion: version,
    checkedBasis: pilotAuthorityBasisSchema, reviewNote: reason, idempotencyKey: replayKey }),
  z.strictObject({ decision: z.literal("REJECT"), expectedVersion: version,
    reason, idempotencyKey: replayKey }),
]);

export const preparePilotEmployeeAuthoritySchema = z.strictObject({
  employeeUserId: z.uuid(), employeeIdentityBinding: versionReference,
  expectedMembershipVersion: version, headAdmission: versionReference,
  basis: pilotAuthorityBasisSchema,
  validFrom: instant, validUntil: instant,
  // Only the selected pilot document, not a wildcard permission grant.
  documentKinds: z.tuple([z.literal("WAYBILL")]),
  idempotencyKey: replayKey,
}).refine(value => Date.parse(value.validUntil) > Date.parse(value.validFrom), {
  path: ["validUntil"], message: "Authority end must follow its start",
});
export const revokePilotAuthoritySchema = z.strictObject({
  expectedVersion: version, reason, idempotencyKey: replayKey,
});

// Pending admission/draft grant must not be represented as active authorization.
export const pilotAuthorityViewSchema = z.discriminatedUnion("status", [
  z.strictObject({ id: z.uuid(), version, status: z.literal("PENDING_REVIEW") }),
  z.strictObject({ id: z.uuid(), version, status: z.literal("AWAITING_HEAD_SIGNATURE"), challengeId: z.uuid() }),
  z.strictObject({ id: z.uuid(), version, status: z.literal("ACTIVE"),
    organizationId: z.uuid(), userId: z.uuid(), identityBinding: versionReference,
    basis: pilotAuthorityBasisSchema, validFrom: instant, validUntil: instant.nullable(),
    documentKinds: z.tuple([z.literal("WAYBILL")]),
    approval: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("OPERATOR_HEAD_REVIEW"), reviewId: z.uuid() }),
      z.strictObject({ kind: z.literal("HEAD_SIGNED_GRANT"), headAdmission: versionReference,
        signatureEvidenceId: z.uuid() }),
    ]),
  }).refine(value => value.validUntil === null
    ? value.approval.kind === "OPERATOR_HEAD_REVIEW"
    : Date.parse(value.validUntil) > Date.parse(value.validFrom), {
    path: ["validUntil"], message: "Authority end must follow its start",
  }),
  z.strictObject({ id: z.uuid(), version, status: z.enum(["REJECTED", "REVOKED", "EXPIRED"]), reason }),
]);

const party = z.enum(["SUPPLIER", "BUYER"]);
export const pilotWaybillSigningPlanSchema = z.strictObject({
  version, documentId: z.uuid(), documentVersion: version, checksumSha256: checksum,
  parties: z.tuple([
    z.strictObject({ role: z.literal("SUPPLIER"), organizationId: z.uuid() }),
    z.strictObject({ role: z.literal("BUYER"), organizationId: z.uuid() }),
  ]),
}).refine(value => value.parties[0].organizationId !== value.parties[1].organizationId, {
  path: ["parties"], message: "The two document parties must be different organizations",
});
export const createPilotWaybillSignatureSchema = z.strictObject({
  expectedDocumentVersion: version, expectedChecksumSha256: checksum,
  expectedSigningPlanVersion: version, authority: versionReference,
  idempotencyKey: replayKey,
});

const sessionBase = { id: z.uuid(), version, purpose: pilotSigningPurposeSchema };
export const pilotSigningSessionViewSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...sessionBase, status: z.literal("AWAITING_USER"), challenge: pilotSigningChallengeSchema }),
  z.strictObject({ ...sessionBase, status: z.enum(["VERIFYING", "UNKNOWN"]) }),
  z.strictObject({ ...sessionBase, status: z.literal("COMMITTED"), evidenceId: z.uuid(), committedAt: instant }),
  z.strictObject({ ...sessionBase, status: z.literal("EVIDENCE_ONLY"), evidenceId: z.uuid(), reasonCode: pilotSigningFailureCodeSchema }),
  z.strictObject({ ...sessionBase, status: z.literal("REJECTED"), reasonCode: pilotSigningFailureCodeSchema }),
  z.strictObject({ ...sessionBase, status: z.enum(["CANCELLED", "EXPIRED"]) }),
]).refine(value => value.status !== "AWAITING_USER" || value.purpose === value.challenge.purpose, {
  path: ["challenge", "purpose"], message: "Challenge purpose must match the session",
});
export const pilotWaybillSignatureProgressSchema = z.strictObject({
  plan: pilotWaybillSigningPlanSchema,
  accepted: z.array(z.strictObject({ party, signatureId: z.uuid(), evidenceId: z.uuid() })).max(2),
}).superRefine((value, context) => {
  const roles = value.accepted.map(item => item.party);
  if (new Set(roles).size !== roles.length || (roles.includes("BUYER") && !roles.includes("SUPPLIER"))) {
    context.addIssue({ code: "custom", path: ["accepted"], message: "Supplier signature precedes the single buyer signature" });
  }
  if (new Set(value.accepted.map(item => item.signatureId)).size !== value.accepted.length ||
      new Set(value.accepted.map(item => item.evidenceId)).size !== value.accepted.length) {
    context.addIssue({ code: "custom", path: ["accepted"], message: "Each party needs independent signature evidence" });
  }
});

export type CreatePilotIdentityChallenge = z.infer<typeof createPilotIdentityChallengeSchema>;
export type SubmitPilotCms = z.infer<typeof submitPilotCmsSchema>;
export type PilotIdentityView = z.infer<typeof pilotIdentityViewSchema>;
export type SubmitPilotHeadAdmission = z.infer<typeof submitPilotHeadAdmissionSchema>;
export type ReviewPilotHeadAdmission = z.infer<typeof reviewPilotHeadAdmissionSchema>;
export type PreparePilotEmployeeAuthority = z.infer<typeof preparePilotEmployeeAuthoritySchema>;
export type RevokePilotAuthority = z.infer<typeof revokePilotAuthoritySchema>;
export type PilotAuthorityView = z.infer<typeof pilotAuthorityViewSchema>;
export type PilotWaybillSigningPlan = z.infer<typeof pilotWaybillSigningPlanSchema>;
export type CreatePilotWaybillSignature = z.infer<typeof createPilotWaybillSignatureSchema>;
export type PilotSigningSessionView = z.infer<typeof pilotSigningSessionViewSchema>;
export type PilotWaybillSignatureProgress = z.infer<typeof pilotWaybillSignatureProgressSchema>;
