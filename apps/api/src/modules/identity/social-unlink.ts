import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../platform/prisma/prisma.service";

export async function unlinkSocialIdentity(prisma: PrismaService, userId: string | undefined, provider: "GOOGLE" | "APPLE") {
  if (typeof userId !== "string" || !userId.trim()) throw new UnauthorizedException("Войдите в аккаунт");
  return prisma.$transaction(async tx => {
    // Different providers still share the same last-sign-in-method invariant.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`);
    const identities = await tx.externalIdentity.findMany({ where: { userId } });
    if (identities.length <= 1) throw new ConflictException("The only sign-in method cannot be unlinked");
    const identity = identities.find(item => item.provider === provider);
    if (!identity) throw new NotFoundException("Social identity not found");
    await tx.externalIdentity.delete({ where: { id: identity.id } });
    await tx.authSession.updateMany({ where: { userId, authMethods: { has: provider.toLowerCase() }, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "identity_unlinked" } });
    await tx.auditLog.create({ data: { actorId: userId, action: "identity.social.unlinked", entityType: "ExternalIdentity", entityId: identity.id, before: { provider } } });
    return { unlinked: true, provider };
  });
}
