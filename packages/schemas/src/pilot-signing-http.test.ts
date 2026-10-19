import { describe, expect, it } from "vitest";
import {
  pilotSigningChallengeSchema, pilotSigningDocumentInputSchema,
  pilotSigningSessionViewSchema, submitPilotPrincipalAdmissionSchema,
  reviewPilotPrincipalAdmissionSchema, PILOT_SIGNING_CHALLENGE_TTL_MS,
} from "./pilot-document-signing";
import { errorResponseSchema } from "./core-api";
import { pilotSigningHttpErrorSchema, pilotSigningHttpStatus, pilotSigningHttpSchemas, pilotSigningOperations } from "./pilot-signing-http";
import { createPilotSigningOpenApi } from "./pilot-signing-openapi";

const id = "00000000-0000-4000-8000-000000000001";
const ref = { id, version: 1 };
const basis = { description: "Synthetic evidence", document: ref };
const createdAt = "2026-10-20T00:00:00.000Z";
const expiresAt = "2026-10-20T00:10:00.000Z";

describe("principal admission and challenge decisions of 20 October", () => {
  it("admits an IP basis without a director appointment and rejects a standalone natural person", () => {
    const request = { expectedOrganizationVersion: 1, identityBinding: ref,
      basis: { kind: "INDIVIDUAL_ENTREPRENEUR", registrationNotice: basis }, idempotencyKey: "admission-1" };
    expect(submitPilotPrincipalAdmissionSchema.safeParse(request).success).toBe(true);
    for (const input of [
      { ...request, basis: { kind: "NATURAL_PERSON" } },
      { ...request, basis: { kind: "INDIVIDUAL_ENTREPRENEUR", appointment: basis } },
      { ...request, basis: { kind: "LEGAL_ENTITY_HEAD", registrationNotice: basis } },
      { ...request, replacePrincipal: true }, { ...request, iin: "000000000001" },
    ]) expect(submitPilotPrincipalAdmissionSchema.safeParse(input).success).toBe(false);
  });
  it("requires a source, evidence and date for an operator approval, not just a note", () => {
    const approval = { decision: "APPROVE", expectedVersion: 1,
      checkedBasis: { kind: "INDIVIDUAL_ENTREPRENEUR", registrationNotice: basis },
      verification: { source: "OFFICIAL_REGISTER", evidenceDocument: ref, checkedAt: createdAt },
      reviewNote: "Synthetic check", idempotencyKey: "review-1" };
    expect(reviewPilotPrincipalAdmissionSchema.safeParse(approval).success).toBe(true);
    expect(reviewPilotPrincipalAdmissionSchema.safeParse({ ...approval, verification: undefined }).success).toBe(false);
    expect(reviewPilotPrincipalAdmissionSchema.safeParse({ ...approval, verification: { verified: true } }).success).toBe(false);
    expect(reviewPilotPrincipalAdmissionSchema.safeParse({ decision: "REJECT", expectedVersion: 1,
      reason: "Missing evidence", idempotencyKey: "review-1" }).success).toBe(true);
  });
  it("enforces exactly ten minutes and separates inline identity challenges from document bytes", () => {
    expect(PILOT_SIGNING_CHALLENGE_TTL_MS).toBe(600000);
    const challenge = { kind: "CHALLENGE", id, purpose: "BIND_IDENTITY", contentBase64: "AQID",
      checksumSha256: "a".repeat(64), createdAt, expiresAt };
    expect(pilotSigningChallengeSchema.safeParse(challenge).success).toBe(true);
    expect(pilotSigningChallengeSchema.safeParse({ ...challenge, contentBase64: "@@@@" }).success).toBe(false);
    for (const offset of [-1, 0, 599999, 600001]) {
      expect(pilotSigningChallengeSchema.safeParse({ ...challenge,
        expiresAt: new Date(Date.parse(createdAt) + offset).toISOString() }).success).toBe(false);
    }
    expect(pilotSigningChallengeSchema.safeParse({ ...challenge, purpose: "SIGN_WAYBILL" }).success).toBe(false);
    const signingInput = { kind: "DOCUMENT", purpose: "SIGN_WAYBILL", document: ref,
      checksumSha256: "b".repeat(64), createdAt, expiresAt };
    expect(pilotSigningDocumentInputSchema.safeParse(signingInput).success).toBe(true);
    const session = { id, version: 1, status: "AWAITING_USER", purpose: "SIGN_WAYBILL", signingInput };
    expect(pilotSigningSessionViewSchema.safeParse(session).success).toBe(true);
    expect(pilotSigningSessionViewSchema.safeParse({ ...session, purpose: "BIND_IDENTITY" }).success).toBe(false);
    expect(pilotSigningDocumentInputSchema.safeParse({ ...signingInput, downloadUrl: "https://untrusted.example/file" }).success).toBe(false);
  });
});

describe("HTTP contract and safe errors", () => {
  it("ties prepared authority to its own grant-signing session, not an identity proof", () => {
    const authority = { id, version: 1, status: "AWAITING_PRINCIPAL_SIGNATURE", sessionId: id };
    const session = { id, version: 1, purpose: "AUTHORIZE_EMPLOYEE", status: "AWAITING_USER",
      signingInput: { kind: "CHALLENGE", id, purpose: "AUTHORIZE_EMPLOYEE", contentBase64: "AQID",
        checksumSha256: "a".repeat(64), createdAt, expiresAt } };
    expect(pilotSigningHttpSchemas.PreparedAuthority.safeParse({ authority, session }).success).toBe(true);
    expect(pilotSigningHttpSchemas.PreparedAuthority.safeParse({ authority: { ...authority,
      sessionId: "00000000-0000-4000-8000-000000000002" }, session }).success).toBe(false);
    expect(pilotSigningHttpSchemas.IdentitySession.safeParse(session).success).toBe(false);
    expect(pilotSigningHttpSchemas.WaybillSession.safeParse(session).success).toBe(false);
  });
  it("maps indeterminate trust to unavailable, and checks safe core-envelope compatibility", () => {
    expect(pilotSigningHttpStatus.TRUST_INDETERMINATE).toBe(503);
    expect(pilotSigningHttpStatus.INVALID_SIGNATURE).toBe(422);
    for (const [code, statusCode] of Object.entries(pilotSigningHttpStatus)) {
      const error = { statusCode, code, message: "Safe message", path: "/signing/sessions/cms",
        requestId: "request-1", timestamp: createdAt };
      expect(pilotSigningHttpErrorSchema.safeParse(error).success).toBe(true);
      expect(errorResponseSchema.safeParse(error).success).toBe(true);
      expect(pilotSigningHttpErrorSchema.safeParse({ ...error, statusCode: 200 }).success).toBe(false);
      expect(pilotSigningHttpErrorSchema.safeParse({ ...error, details: { iin: "000000000001", cmsBase64: "AQID" } }).success).toBe(false);
    }
  });
  it("declares operator-only review and exposes no self-service change-principal or IIN replacement", () => {
    expect(pilotSigningOperations.reviewAdmission.access).toBe("OPERATOR");
    expect(pilotSigningOperations.prepareAuthority.access).toBe("PRINCIPAL");
    expect(pilotSigningOperations.submitCms.status).toBe(202);
    expect(Object.values(pilotSigningOperations).every(op => op.method === "GET" || op.method === "POST")).toBe(true);
    expect(Object.values(pilotSigningOperations).some(op => /replace|rebind|change-principal/.test(op.path))).toBe(false);
  });
  it("generates only marked contract routes with valid schema refs, auth and path/query parameters", () => {
    const api = createPilotSigningOpenApi();
    expect(api["x-implementation-status"]).toBe("CONTRACT_ONLY");
    expect(api.openapi).toBe("3.1.0");
    const operations = Object.values(api.paths).flatMap(path => Object.values(path)) as Array<Record<string, unknown>>;
    expect(operations).toHaveLength(Object.keys(pilotSigningOperations).length);
    expect(new Set(operations.map(op => op.operationId)).size).toBe(operations.length);
    for (const operation of operations) {
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation["x-implementation-status"]).toBe("CONTRACT_ONLY");
    }
    const serialized = JSON.stringify(api);
    for (const match of serialized.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)) {
      expect(api.components.schemas).toHaveProperty(match[1]);
    }
    expect(serialized).not.toContain('"servers"');
    const queue = api.paths["/operations/signing/admissions"].get as { parameters: Array<{ name: string; in: string }> };
    expect(queue.parameters.map(p => `${p.in}:${p.name}`)).toEqual(["query:offset", "query:limit"]);
  });
});
