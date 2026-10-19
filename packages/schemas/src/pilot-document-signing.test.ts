import { describe, expect, it } from "vitest";
import {
  createPilotIdentityChallengeSchema, submitPilotCmsSchema, pilotIdentityViewSchema,
  preparePilotEmployeeAuthoritySchema, pilotAuthorityViewSchema,
  createPilotWaybillSignatureSchema, pilotWaybillSigningPlanSchema,
  pilotWaybillSignatureProgressSchema, pilotSigningSessionViewSchema,
  reviewPilotHeadAdmissionSchema, PILOT_CMS_MAX_BYTES,
} from "./pilot-document-signing";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ref = { id: id(1), version: 1 };
const time = "2026-10-19T10:00:00.000Z";
const later = "2026-10-19T10:05:00.000Z";
const hash = "a".repeat(64);
const basis = { description: "Synthetic appointment", document: ref };
const grant = { employeeUserId: id(2), employeeIdentityBinding: ref,
  expectedMembershipVersion: 1, headAdmission: ref, basis,
  validFrom: time, validUntil: later, documentKinds: ["WAYBILL"], idempotencyKey: "test-key-1" };
const plan = { version: 1, documentId: id(3), documentVersion: 1, checksumSha256: hash,
  parties: [{ role: "SUPPLIER", organizationId: id(4) }, { role: "BUYER", organizationId: id(5) }] };
const cms = { sessionId: id(6), expectedSessionVersion: 1, cmsBase64: "AQID", idempotencyKey: "test-key-2" };
const accepted = [{ party: "SUPPLIER", signatureId: id(7), evidenceId: id(8) },
  { party: "BUYER", signatureId: id(9), evidenceId: id(10) }];

describe("pilot signing request trust boundaries", () => {
  it("does not accept identity, tenant or lifetime assertions in identity requests", () => {
    const input = { idempotencyKey: "test-key-1" };
    expect(createPilotIdentityChallengeSchema.safeParse(input).success).toBe(true);
    for (const field of ["iin", "actorId", "organizationId", "expiresInMinutes", "verified"]) {
      expect(createPilotIdentityChallengeSchema.safeParse({ ...input, [field]: "untrusted" }).success).toBe(false);
    }
  });
  it("only accepts a versioned CMS submission, never a claimed verification result", () => {
    expect(submitPilotCmsSchema.safeParse(cms).success).toBe(true);
    for (const extra of [{ status: "SIGNED" }, { signerUserId: id(1) }, { evidence: {} }, { iin: "000000000000" }]) {
      expect(submitPilotCmsSchema.safeParse({ ...cms, ...extra }).success).toBe(false);
    }
    expect(submitPilotCmsSchema.safeParse({ ...cms, expectedSessionVersion: 0 }).success).toBe(false);
    expect(submitPilotCmsSchema.safeParse({ ...cms, idempotencyKey: "" }).success).toBe(false);
  });
  it("bounds decoded CMS and rejects malformed transport without claiming crypto validation", () => {
    for (const invalid of ["", "@@==", "AQI", "AQID\n", "-----BEGIN CMS-----AQID"]) {
      expect(submitPilotCmsSchema.safeParse({ ...cms, cmsBase64: invalid }).success).toBe(false);
    }
    const tooLarge = "AAAA".repeat(Math.ceil((PILOT_CMS_MAX_BYTES + 1) / 3));
    expect(submitPilotCmsSchema.safeParse({ ...cms, cmsBase64: tooLarge }).success).toBe(false);
  });
  it("returns a masked identity only after a binding and verification time exist", () => {
    const verified = { status: "VERIFIED", bindingId: id(1), version: 1, maskedIin: "********1234", verifiedAt: time };
    expect(pilotIdentityViewSchema.safeParse(verified).success).toBe(true);
    expect(pilotIdentityViewSchema.safeParse({ ...verified, maskedIin: "123456781234" }).success).toBe(false);
    expect(pilotIdentityViewSchema.safeParse({ ...verified, bindingId: undefined }).success).toBe(false);
  });
});

describe("authority preparation is not activation", () => {
  it("requires versioned head, employee binding, basis and a finite ordered term", () => {
    expect(preparePilotEmployeeAuthoritySchema.safeParse(grant).success).toBe(true);
    for (const patch of [{ validUntil: time }, { validUntil: null }, { headAdmission: undefined },
      { basis: { description: "text alone" } }, { documentKinds: ["ALL"] },
      { documentKinds: ["WAYBILL", "WAYBILL"] }, { expectedMembershipVersion: 0 }, { status: "ACTIVE" }]) {
      expect(preparePilotEmployeeAuthoritySchema.safeParse({ ...grant, ...patch }).success).toBe(false);
    }
  });
  it("requires operator review evidence and optimistic version without client actor IDs", () => {
    const review = { decision: "APPROVE", expectedVersion: 1, checkedBasis: basis,
      reviewNote: "Checked synthetic fixture", idempotencyKey: "review-key" };
    expect(reviewPilotHeadAdmissionSchema.safeParse(review).success).toBe(true);
    for (const patch of [{ checkedBasis: undefined }, { reviewerId: id(1) }, { expectedVersion: 0 }]) {
      expect(reviewPilotHeadAdmissionSchema.safeParse({ ...review, ...patch }).success).toBe(false);
    }
  });
  it("cannot label a pending grant ACTIVE without the required evidence", () => {
    const pending = { id: id(1), version: 1, status: "AWAITING_HEAD_SIGNATURE", challengeId: id(6) };
    expect(pilotAuthorityViewSchema.safeParse(pending).success).toBe(true);
    expect(pilotAuthorityViewSchema.safeParse({ ...pending, status: "ACTIVE" }).success).toBe(false);
    const active = { id: id(1), version: 1, status: "ACTIVE", organizationId: id(4), userId: id(2),
      identityBinding: ref, basis, validFrom: time, validUntil: later, documentKinds: ["WAYBILL"],
      approval: { kind: "HEAD_SIGNED_GRANT", headAdmission: ref, signatureEvidenceId: id(8) } };
    expect(pilotAuthorityViewSchema.safeParse(active).success).toBe(true);
    expect(pilotAuthorityViewSchema.safeParse({ ...active, validUntil: null }).success).toBe(false);
    expect(pilotAuthorityViewSchema.safeParse({ ...active, validUntil: null,
      approval: { kind: "OPERATOR_HEAD_REVIEW", reviewId: id(9) } }).success).toBe(true);
    expect(pilotAuthorityViewSchema.safeParse({ ...active, approval: { kind: "HEAD_SIGNED_GRANT", headAdmission: ref } }).success).toBe(false);
  });
});

describe("two-party immutable waybill contract", () => {
  it("requires both different organizations in supplier then buyer order", () => {
    expect(pilotWaybillSigningPlanSchema.safeParse(plan).success).toBe(true);
    expect(pilotWaybillSigningPlanSchema.safeParse({ ...plan, parties: [...plan.parties].reverse() }).success).toBe(false);
    expect(pilotWaybillSigningPlanSchema.safeParse({ ...plan, parties: [plan.parties[0], { ...plan.parties[1], organizationId: id(4) }] }).success).toBe(false);
  });
  it("requires original, plan and authority versions and derives actor/party on server", () => {
    const start = { expectedDocumentVersion: 1, expectedChecksumSha256: hash,
      expectedSigningPlanVersion: 1, authority: ref, idempotencyKey: "sign-key-1" };
    expect(createPilotWaybillSignatureSchema.safeParse(start).success).toBe(true);
    for (const patch of [{ expectedChecksumSha256: undefined }, { expectedSigningPlanVersion: 0 },
      { signerOrganizationId: id(5) }, { method: "MOCK" }]) {
      expect(createPilotWaybillSignatureSchema.safeParse({ ...start, ...patch }).success).toBe(false);
    }
  });
  it("rejects buyer-first, repeated sides and reused evidence", () => {
    expect(pilotWaybillSignatureProgressSchema.safeParse({ plan, accepted }).success).toBe(true);
    for (const bad of [[accepted[1]], [accepted[0], accepted[0]],
      [accepted[0], { ...accepted[1], evidenceId: accepted[0].evidenceId }]]) {
      expect(pilotWaybillSignatureProgressSchema.safeParse({ plan, accepted: bad }).success).toBe(false);
    }
  });
  it("distinguishes pending, evidence-only and committed results", () => {
    const session = { id: id(6), version: 1, purpose: "SIGN_WAYBILL" };
    expect(pilotSigningSessionViewSchema.safeParse({ ...session, status: "UNKNOWN" }).success).toBe(true);
    expect(pilotSigningSessionViewSchema.safeParse({ ...session, status: "COMMITTED" }).success).toBe(false);
    expect(pilotSigningSessionViewSchema.safeParse({ ...session, status: "EVIDENCE_ONLY", evidenceId: id(8), reasonCode: "AUTHORITY_NOT_ACTIVE" }).success).toBe(true);
    const awaiting = { ...session, status: "AWAITING_USER", challenge: { id: id(6), purpose: "SIGN_WAYBILL",
      contentBase64: "AQID", checksumSha256: hash, createdAt: time, expiresAt: later } };
    expect(pilotSigningSessionViewSchema.safeParse(awaiting).success).toBe(true);
    expect(pilotSigningSessionViewSchema.safeParse({ ...awaiting, challenge: { ...awaiting.challenge, purpose: "BIND_IDENTITY" } }).success).toBe(false);
    expect(pilotSigningSessionViewSchema.safeParse({ ...awaiting, challenge: { ...awaiting.challenge, expiresAt: time } }).success).toBe(false);
  });
});
