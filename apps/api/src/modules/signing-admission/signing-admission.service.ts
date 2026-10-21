import { Injectable } from "@nestjs/common";
import { pilotSigningHttpSchemas, reviewPilotPrincipalAdmissionSchema, submitPilotPrincipalAdmissionSchema } from "@marketplace/schemas";
import { z } from "zod";
import { IdentitySigningStore, identityError, type IdentityActor } from "../identity-signing/identity-signing.store";
import { SigningAdmissionRules, admissionDocument } from "./signing-admission.rules";
import { SigningAdmissionStore, admissionInclude, admissionView } from "./signing-admission.store";

@Injectable()
export class SigningAdmissionService {
  constructor(private readonly transactions: IdentitySigningStore, private readonly store: SigningAdmissionStore,
    private readonly rules: SigningAdmissionRules) {}

  private target(actor: IdentityActor, organizationId: string) {
    if (!z.uuid().safeParse(organizationId).success) identityError("BAD_REQUEST");
    if (actor.organizationId !== organizationId) identityError("NOT_FOUND");
  }

  async current(actor: IdentityActor, organizationId: string) {
    return this.transactions.transaction(async db => {
      await this.transactions.authorize(db, actor);
      this.target(actor, organizationId);
      const row = await db.signingPrincipalAdmission.findFirst({ where: { organizationId, userId: actor.actorId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: admissionInclude });
      return { admission: row ? admissionView(row) : null };
    });
  }

  async submit(actor: IdentityActor, organizationId: string, body: unknown) {
    const parsed = submitPilotPrincipalAdmissionSchema.safeParse(body);
    if (!parsed.success) identityError("BAD_REQUEST");
    const input = parsed.data;
    return this.transactions.transaction(async db => {
      await this.transactions.authorize(db, actor);
      this.target(actor, organizationId);
      const scope = `submit:${organizationId}`;
      const replay = await this.store.replay(db, actor, scope, input.idempotencyKey, input);
      if (replay) return replay;
      if (await db.signingPrincipalAuthority.findFirst({ where: { organizationId, status: "ACTIVE" } })) identityError("SUPPORT_REQUIRED");
      if (await db.signingPrincipalAdmission.findFirst({ where: { organizationId, userId: actor.actorId, status: "PENDING_REVIEW" } })) identityError("VERSION_CONFLICT");
      const { member, binding, revision } = await this.rules.subject(db, organizationId, actor.actorId, input);
      const basis = await this.rules.document(db, organizationId, admissionDocument(input.basis).document);
      const { idempotencyKey: key, ...application } = input;
      const row = await db.signingPrincipalAdmission.create({ data: { organizationId, userId: actor.actorId,
        identityBindingId: binding.id, identityBindingVersion: binding.version,
        membershipId: member.id, membershipUpdatedAt: member.updatedAt,
        organizationVersion: member.organization.version, requisitesVersion: revision.version,
        application, applicantName: member.user.displayName, maskedIin: binding.maskedIin,
        basisDocumentId: basis.id, basisDocumentVersion: basis.version, basisChecksum: basis.checksumSha256!,
      }, include: admissionInclude });
      return this.store.save(db, actor, scope, key, input, row);
    });
  }

  async queue(actor: IdentityActor, query: unknown) {
    const parsed = pilotSigningHttpSchemas.PageQuery.safeParse(query);
    if (!parsed.success) identityError("BAD_REQUEST");
    return this.transactions.transaction(async db => {
      await this.transactions.authorize(db, actor);
      await this.rules.operator(db, actor);
      const { offset, limit } = parsed.data;
      const where = { status: "PENDING_REVIEW" };
      const items = await db.signingPrincipalAdmission.findMany({ where, skip: offset, take: limit,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: admissionInclude });
      return { items: items.map(admissionView), offset, total: await db.signingPrincipalAdmission.count({ where }) };
    });
  }

  async detail(actor: IdentityActor, id: string) {
    if (!z.uuid().safeParse(id).success) identityError("BAD_REQUEST");
    return this.transactions.transaction(async db => {
      await this.transactions.authorize(db, actor);
      await this.rules.operator(db, actor);
      const row = await db.signingPrincipalAdmission.findUnique({ where: { id }, include: admissionInclude });
      if (!row) identityError("NOT_FOUND");
      return admissionView(row);
    });
  }

  async review(actor: IdentityActor, id: string, body: unknown) {
    const parsed = reviewPilotPrincipalAdmissionSchema.safeParse(body);
    if (!parsed.success || !z.uuid().safeParse(id).success) identityError("BAD_REQUEST");
    const input = parsed.data;
    return this.transactions.transaction(async db => {
      await this.transactions.authorize(db, actor);
      await this.rules.operator(db, actor);
      const scope = `review:${actor.organizationId}:${id}`;
      const replay = await this.store.replay(db, actor, scope, input.idempotencyKey, input);
      if (replay) return replay;
      await db.$queryRaw`SELECT "id" FROM "SigningPrincipalAdmission" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await db.signingPrincipalAdmission.findUnique({ where: { id } });
      if (!row) identityError("NOT_FOUND");
      if (row.status !== "PENDING_REVIEW" || row.version !== input.expectedVersion) identityError("VERSION_CONFLICT");
      let evidence: Awaited<ReturnType<SigningAdmissionRules["document"]>> | null = null;
      if (input.decision === "APPROVE") {
        const application = submitPilotPrincipalAdmissionSchema.parse({ ...row.application as object, idempotencyKey: input.idempotencyKey });
        if (JSON.stringify(input.checkedBasis) !== JSON.stringify(application.basis)) identityError("CONTENT_MISMATCH");
        if (Date.parse(input.verification.checkedAt) > Date.now()) identityError("BAD_REQUEST");
        const { member, revision } = await this.rules.subject(db, row.organizationId, row.userId, application);
        if (member.id !== row.membershipId || member.updatedAt.getTime() !== row.membershipUpdatedAt.getTime() || revision.version !== row.requisitesVersion) identityError("VERSION_CONFLICT");
        const basis = await this.rules.document(db, row.organizationId, admissionDocument(application.basis).document);
        if (basis.checksumSha256 !== row.basisChecksum) identityError("CONTENT_MISMATCH");
        evidence = await this.rules.document(db, actor.organizationId, input.verification.evidenceDocument);
        if (await db.signingPrincipalAuthority.findFirst({ where: { organizationId: row.organizationId, status: "ACTIVE" } })) identityError("SUPPORT_REQUIRED");
      }
      await db.signingPrincipalReview.create({ data: { admissionId: id, operatorOrganizationId: actor.organizationId, reviewerId: actor.actorId,
        decision: input.decision, reason: input.decision === "REJECT" ? input.reason : input.reviewNote,
        ...(input.decision === "APPROVE" ? { verification: input.verification, evidenceDocumentId: evidence!.id, evidenceChecksum: evidence!.checksumSha256! } : {}),
      } });
      if (input.decision === "APPROVE") await db.signingPrincipalAuthority.create({ data: { admissionId: id,
        organizationId: row.organizationId, userId: row.userId, identityBindingId: row.identityBindingId } });
      const result = await db.signingPrincipalAdmission.update({ where: { id }, data: {
        status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", version: { increment: 1 },
      }, include: admissionInclude });
      return this.store.save(db, actor, scope, input.idempotencyKey, input, result);
    });
  }
}
