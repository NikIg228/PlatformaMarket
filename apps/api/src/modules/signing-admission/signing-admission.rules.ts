import { Injectable } from "@nestjs/common";
import { organizationRequisitesFieldsSchema, organizationRequisitesSourceSchema, type SubmitPilotPrincipalAdmission } from "@marketplace/schemas";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { SecurityCryptoService } from "../../platform/security/security-crypto.service";
import { identityError, identityHash, type IdentityActor, type IdentityDatabase } from "../identity-signing/identity-signing.store";
import { membershipPermission } from "../access-control/access-mode";
import { organizationRequisitesSource } from "../organizations/organization-requisites.service";
import { sameRequisitesSource } from "../organizations/organization-requisites.rules";

export const admissionDocument = (basis: SubmitPilotPrincipalAdmission["basis"]) =>
  basis.kind === "LEGAL_ENTITY_HEAD" ? basis.appointment : basis.registrationNotice;

@Injectable()
export class SigningAdmissionRules {
  constructor(private readonly storage: ObjectStorageService, private readonly crypto: SecurityCryptoService) {}

  async operator(db: IdentityDatabase, actor: IdentityActor) {
    const allowed = await db.organizationMembership.findFirst({ where: {
      userId: actor.actorId, organizationId: actor.organizationId, status: "ACTIVE",
      organization: { status: "ACTIVE", capabilities: { some: { capability: "MARKETPLACE_OPERATOR" } } },
      ...membershipPermission(actor.organizationId, "compliance.review"),
    } });
    if (!allowed) identityError("FORBIDDEN");
  }

  async subject(db: IdentityDatabase, organizationId: string, userId: string, input: SubmitPilotPrincipalAdmission) {
    await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR SHARE`;
    await db.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR SHARE`;
    await db.$queryRaw`SELECT "organizationId" FROM "OrganizationRequisites" WHERE "organizationId" = ${organizationId}::uuid FOR SHARE`;
    await db.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId}::uuid AND "userId" = ${userId}::uuid FOR SHARE`;
    await db.$queryRaw`SELECT "id" FROM "SigningIdentityBinding" WHERE "id" = ${input.identityBinding.id}::uuid FOR SHARE`;
    const member = await db.organizationMembership.findFirst({ where: { organizationId, userId, status: "ACTIVE",
      user: { status: "ACTIVE" }, organization: { status: "ACTIVE", capabilities: { some: { capability: { in: ["BUYER", "SUPPLIER"] } } } } },
      include: { user: true, organization: { include: { capabilities: true } } } });
    if (!member) identityError("FORBIDDEN");
    if (member.organization.version !== input.expectedOrganizationVersion) identityError("VERSION_CONFLICT");
    const binding = await db.signingIdentityBinding.findFirst({ where: { id: input.identityBinding.id, userId, status: "ACTIVE" } });
    if (!binding) identityError("IDENTITY_NOT_VERIFIED");
    if (binding.version !== input.identityBinding.version) identityError("VERSION_CONFLICT");
    const head = await db.organizationRequisites.findUnique({ where: { organizationId } });
    const revision = head && await db.organizationRequisitesRevision.findUnique({ where: { organizationId_version: { organizationId, version: head.version } } });
    if (!revision?.confirmedAt || !sameRequisitesSource(await organizationRequisitesSource(db, member.organization), organizationRequisitesSourceSchema.parse(revision.source))) identityError("VERSION_CONFLICT");
    const fields = organizationRequisitesFieldsSchema.parse(revision.fields);
    if (fields.legalForm !== (input.basis.kind === "LEGAL_ENTITY_HEAD" ? "LEGAL_ENTITY" : "INDIVIDUAL_ENTREPRENEUR")) identityError("UNSUPPORTED_SUBJECT");
    if (fields.legalForm === "INDIVIDUAL_ENTREPRENEUR" && binding.iinFingerprint !== this.crypto.fingerprint(member.organization.bin, "signing-identity-iin")) identityError("SUPPORT_REQUIRED");
    return { member, binding, revision };
  }

  async document(db: IdentityDatabase, organizationId: string, reference: { id: string; version: number }) {
    await db.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${reference.id}::uuid FOR SHARE`;
    const document = await db.document.findFirst({ where: { id: reference.id, ownerOrganizationId: organizationId } });
    if (!document) identityError("NOT_FOUND");
    if (document.version !== reference.version || await db.document.count({ where: { previousVersionId: document.id } })) identityError("VERSION_CONFLICT");
    if (!["GENERATED", "SIGNED"].includes(document.status) || !document.immutableAt || !document.storageKey || !document.checksumSha256 || !document.byteSize ||
      document.documentDate.getTime() > Date.now() || (document.expiresAt && document.expiresAt.getTime() <= Date.now())) identityError("DOCUMENT_NOT_SIGNABLE");
    let bytes: Buffer;
    try { bytes = await this.storage.get(document.storageKey); } catch { identityError("VERIFIER_UNAVAILABLE"); }
    if (bytes.length !== document.byteSize || identityHash(bytes) !== document.checksumSha256) identityError("CONTENT_MISMATCH");
    return document;
  }
}
