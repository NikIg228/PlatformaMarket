import { z } from "zod";
import {
  createPilotIdentityChallengeSchema, createPilotWaybillSignatureSchema,
  pilotAuthorityViewSchema, pilotIdentityViewSchema, pilotSigningSessionViewSchema,
  pilotWaybillSignatureProgressSchema, preparePilotEmployeeAuthoritySchema,
  reviewPilotPrincipalAdmissionSchema, revokePilotAuthoritySchema,
  submitPilotCmsSchema, submitPilotPrincipalAdmissionSchema,
} from "./pilot-document-signing.js";

// Design contract for R7.6.1.3, not a registration of live HTTP routes.
const reference = z.strictObject({ id: z.uuid(), version: z.number().int().positive() });
const admissionBase = {
  id: z.uuid(), version: z.number().int().positive(), organizationId: z.uuid(),
  applicant: z.strictObject({ userId: z.uuid(), displayName: z.string().min(1).max(240),
    maskedIin: z.string().regex(/^\*{8}\d{4}$/) }),
  application: submitPilotPrincipalAdmissionSchema.omit({ idempotencyKey: true }),
  createdAt: z.iso.datetime(),
};
export const pilotPrincipalAdmissionViewSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...admissionBase, status: z.literal("PENDING_REVIEW") }),
  z.strictObject({ ...admissionBase, status: z.literal("APPROVED"),
    authority: reference, reviewId: z.uuid(), reviewedAt: z.iso.datetime() }),
  z.strictObject({ ...admissionBase, status: z.enum(["REJECTED", "SUPERSEDED"]),
    reason: z.string().min(2).max(1000), reviewId: z.uuid(), reviewedAt: z.iso.datetime() }),
]);
export const cancelPilotSigningSessionSchema = z.strictObject({
  expectedSessionVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const pilotSigningHttpStatus = {
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  IDENTITY_MISMATCH: 422, IDENTITY_CONFLICT: 409, IDENTITY_NOT_VERIFIED: 409,
  ORGANIZATION_MISMATCH: 422, AUTHORITY_NOT_ACTIVE: 409, PRINCIPAL_NOT_APPROVED: 409,
  VERSION_CONFLICT: 409, CONTENT_MISMATCH: 409, IDEMPOTENCY_CONFLICT: 409,
  SESSION_EXPIRED: 409, SESSION_CANCELLED: 409, SESSION_ALREADY_COMMITTED: 409,
  SUPPORT_REQUIRED: 409, UNSUPPORTED_SUBJECT: 422, DOCUMENT_NOT_SIGNABLE: 409,
  INVALID_SIGNATURE: 422, CERTIFICATE_EXPIRED: 422, CERTIFICATE_REVOKED: 422,
  TRUST_INDETERMINATE: 503, VERIFIER_UNAVAILABLE: 503,
  PAYLOAD_TOO_LARGE: 413, RATE_LIMIT_EXCEEDED: 429, INTERNAL_SERVER_ERROR: 500,
} as const;
export const pilotSigningHttpErrorCodeSchema = z.enum(Object.keys(pilotSigningHttpStatus) as
  [keyof typeof pilotSigningHttpStatus, ...(keyof typeof pilotSigningHttpStatus)[]]);
// Compatible with the core envelope, with only explicitly safe details in this domain.
export const pilotSigningHttpErrorSchema = z.strictObject({
  statusCode: z.number().int(), code: pilotSigningHttpErrorCodeSchema,
  message: z.string(), error: z.string().optional(),
  path: z.string(), requestId: z.string().min(1), timestamp: z.iso.datetime(),
  details: z.strictObject({ sessionId: z.uuid().optional(),
    currentVersion: z.number().int().positive().optional() }).optional(),
}).refine(value => value.statusCode === pilotSigningHttpStatus[value.code], {
  path: ["statusCode"], message: "HTTP status must match the domain error",
});

const pageQuery = z.strictObject({ offset: z.number().int().min(0).max(100000),
  limit: z.number().int().min(1).max(50) });
const pageFields = { offset: z.number().int().nonnegative(), total: z.number().int().nonnegative() };
const identitySession = pilotSigningSessionViewSchema.and(z.object({ purpose: z.literal("BIND_IDENTITY") }));
const waybillSession = pilotSigningSessionViewSchema.and(z.object({ purpose: z.literal("SIGN_WAYBILL") }));
const preparedAuthority = z.strictObject({
  authority: pilotAuthorityViewSchema.and(z.object({ status: z.literal("AWAITING_PRINCIPAL_SIGNATURE") })),
  session: pilotSigningSessionViewSchema.and(z.object({ purpose: z.literal("AUTHORIZE_EMPLOYEE"), status: z.literal("AWAITING_USER") })),
}).refine(value => value.authority.sessionId === value.session.id, {
  path: ["authority", "sessionId"], message: "Authority must reference the returned signing session",
});
export const pilotSigningHttpSchemas = {
  Identity: pilotIdentityViewSchema,
  IdentityChallengeRequest: createPilotIdentityChallengeSchema,
  AdmissionRequest: submitPilotPrincipalAdmissionSchema,
  AdmissionReviewRequest: reviewPilotPrincipalAdmissionSchema,
  Admission: pilotPrincipalAdmissionViewSchema,
  CurrentAdmission: z.strictObject({ admission: pilotPrincipalAdmissionViewSchema.nullable() }),
  AdmissionPage: z.strictObject({ ...pageFields, items: z.array(pilotPrincipalAdmissionViewSchema).max(50) }),
  AuthorityPage: z.strictObject({ ...pageFields, items: z.array(pilotAuthorityViewSchema).max(50) }),
  Authority: pilotAuthorityViewSchema,
  PrepareAuthorityRequest: preparePilotEmployeeAuthoritySchema,
  PreparedAuthority: preparedAuthority,
  RevokeAuthorityRequest: revokePilotAuthoritySchema,
  PageQuery: pageQuery,
  WaybillProgress: pilotWaybillSignatureProgressSchema,
  StartWaybillRequest: createPilotWaybillSignatureSchema,
  Session: pilotSigningSessionViewSchema,
  IdentitySession: identitySession,
  WaybillSession: waybillSession,
  SubmitCmsRequest: submitPilotCmsSchema,
  CancelSessionRequest: cancelPilotSigningSessionSchema,
  Error: pilotSigningHttpErrorSchema,
} as const;

type SchemaName = keyof typeof pilotSigningHttpSchemas;
type Operation = {
  method: "GET" | "POST"; path: string; request: SchemaName | null; response: SchemaName;
  status: 200 | 201 | 202;
  access: "SELF" | "MEMBER" | "PRINCIPAL" | "OPERATOR" | "DOCUMENT_PARTY" | "SESSION_OWNER";
};
export const pilotSigningOperations = {
  identity: { method: "GET", path: "/identity/signing-binding", request: null, response: "Identity", status: 200, access: "SELF" },
  createIdentityChallenge: { method: "POST", path: "/identity/signing-binding/challenges", request: "IdentityChallengeRequest", response: "IdentitySession", status: 201, access: "SELF" },
  currentAdmission: { method: "GET", path: "/organizations/{organizationId}/signing/admission", request: null, response: "CurrentAdmission", status: 200, access: "MEMBER" },
  submitAdmission: { method: "POST", path: "/organizations/{organizationId}/signing/admission", request: "AdmissionRequest", response: "Admission", status: 201, access: "MEMBER" },
  admissionQueue: { method: "GET", path: "/operations/signing/admissions", request: "PageQuery", response: "AdmissionPage", status: 200, access: "OPERATOR" },
  admission: { method: "GET", path: "/operations/signing/admissions/{admissionId}", request: null, response: "Admission", status: 200, access: "OPERATOR" },
  reviewAdmission: { method: "POST", path: "/operations/signing/admissions/{admissionId}/review", request: "AdmissionReviewRequest", response: "Admission", status: 200, access: "OPERATOR" },
  authorities: { method: "GET", path: "/organizations/{organizationId}/signing/authorities", request: "PageQuery", response: "AuthorityPage", status: 200, access: "MEMBER" },
  prepareAuthority: { method: "POST", path: "/organizations/{organizationId}/signing/authorities", request: "PrepareAuthorityRequest", response: "PreparedAuthority", status: 201, access: "PRINCIPAL" },
  revokeAuthority: { method: "POST", path: "/organizations/{organizationId}/signing/authorities/{authorityId}/revoke", request: "RevokeAuthorityRequest", response: "Authority", status: 200, access: "PRINCIPAL" },
  waybillProgress: { method: "GET", path: "/documents/{documentId}/signing-plan", request: null, response: "WaybillProgress", status: 200, access: "DOCUMENT_PARTY" },
  startWaybill: { method: "POST", path: "/documents/{documentId}/signing-sessions", request: "StartWaybillRequest", response: "WaybillSession", status: 201, access: "DOCUMENT_PARTY" },
  session: { method: "GET", path: "/signing/sessions/{sessionId}", request: null, response: "Session", status: 200, access: "SESSION_OWNER" },
  submitCms: { method: "POST", path: "/signing/sessions/cms", request: "SubmitCmsRequest", response: "Session", status: 202, access: "SESSION_OWNER" },
  cancelSession: { method: "POST", path: "/signing/sessions/{sessionId}/cancel", request: "CancelSessionRequest", response: "Session", status: 200, access: "SESSION_OWNER" },
} as const satisfies Record<string, Operation>;

export type PilotSigningOperationName = keyof typeof pilotSigningOperations;
export type PilotSigningRequest<K extends PilotSigningOperationName> =
  (typeof pilotSigningOperations)[K]["request"] extends infer S extends SchemaName
    ? z.input<(typeof pilotSigningHttpSchemas)[S]> : undefined;
export type PilotSigningResponse<K extends PilotSigningOperationName> =
  z.output<(typeof pilotSigningHttpSchemas)[(typeof pilotSigningOperations)[K]["response"]]>;
type PathKeys<P extends string> = P extends `${string}{${infer Key}}${infer Rest}` ? Key | PathKeys<Rest> : never;
export type PilotSigningPathParams<K extends PilotSigningOperationName> =
  Record<PathKeys<(typeof pilotSigningOperations)[K]["path"]>, string>;
