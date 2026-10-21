import { Injectable } from "@nestjs/common";
import { pilotPrincipalAdmissionViewSchema } from "@marketplace/schemas";
import type { Prisma } from "@prisma/client";
import { identityHash, identityError, type IdentityActor, type IdentityDatabase } from "../identity-signing/identity-signing.store";

export const admissionInclude = { review: true, authority: true } as const;
type Admission = Prisma.SigningPrincipalAdmissionGetPayload<{ include: typeof admissionInclude }>;
export function admissionView(row: Admission) {
  return pilotPrincipalAdmissionViewSchema.parse({ id: row.id, version: row.version, organizationId: row.organizationId,
    applicant: { userId: row.userId, displayName: row.applicantName, maskedIin: row.maskedIin },
    application: row.application, createdAt: row.createdAt.toISOString(), status: row.status,
    ...(row.review ? { reviewId: row.review.id, reviewedAt: row.review.createdAt.toISOString(),
      ...(row.status === "APPROVED" ? { authority: { id: row.authority!.id, version: row.authority!.version } } : { reason: row.review.reason }) } : {}),
  });
}

@Injectable()
export class SigningAdmissionStore {
  async replay(db: IdentityDatabase, actor: IdentityActor, scope: string, key: string, input: unknown) {
    const command = await db.signingAdmissionCommand.findUnique({ where: { actorId_scope_key: { actorId: actor.actorId, scope, key } } });
    if (!command) return null;
    if (command.requestSha256 !== identityHash(JSON.stringify(input))) identityError("IDEMPOTENCY_CONFLICT");
    return pilotPrincipalAdmissionViewSchema.parse(command.response);
  }

  async save(db: IdentityDatabase, actor: IdentityActor, scope: string, key: string, input: unknown, row: Admission) {
    const response = admissionView(row);
    await db.signingAdmissionCommand.create({ data: { actorId: actor.actorId, scope, key,
      requestSha256: identityHash(JSON.stringify(input)), response } });
    await db.auditLog.create({ data: { actorId: actor.actorId, organizationId: row.organizationId,
      action: `signing.admission.${row.status.toLowerCase()}`, entityType: "SigningPrincipalAdmission", entityId: row.id,
      after: { status: row.status, version: row.version, reviewId: row.review?.id ?? null,
        authorityId: row.authority?.id ?? null, operatorOrganizationId: row.review?.operatorOrganizationId ?? null } } });
    return response;
  }
}
