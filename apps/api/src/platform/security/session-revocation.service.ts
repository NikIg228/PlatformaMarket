import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type RevokedCacheEntry = { expiresAt: number };

const DENY_CACHE_TTL_MS = 5_000;
const MAX_DENY_CACHE_ENTRIES = 10_000;

@Injectable()
export class SessionRevocationService {
  private readonly revoked = new Map<string, RevokedCacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async assertActive(sessionId: string, userId: string) {
    const now = Date.now();
    const cached = this.revoked.get(sessionId);
    if (cached) {
      if (cached.expiresAt > now) throw new UnauthorizedException("Authentication session is revoked or expired");
      this.revoked.delete(sessionId);
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId, user: { status: "ACTIVE" } },
      select: { userId: true, status: true, expiresAt: true, authMethods: true, activeOrganizationId: true },
    });
    if (!session || session.userId !== userId || session.status !== "ACTIVE" || session.expiresAt.getTime() <= now) {
      this.rememberRevoked(sessionId, now);
      throw new UnauthorizedException("Authentication session is revoked or expired");
    }
    if (session.authMethods?.includes("operator_password")) {
      const membership = session.activeOrganizationId && await this.prisma.organizationMembership.findFirst({
        where: { userId, organizationId: session.activeOrganizationId, status: "ACTIVE", organization: { status: "ACTIVE", capabilities: { some: { capability: "MARKETPLACE_OPERATOR" } } } }, select: { id: true },
      });
      if (!membership) throw new UnauthorizedException("Доступ оператора отозван. Войдите заново.");
    }
  }

  invalidate(sessionId: string) {
    this.rememberRevoked(sessionId, Date.now());
  }

  private rememberRevoked(sessionId: string, now: number) {
    if (this.revoked.size >= MAX_DENY_CACHE_ENTRIES && !this.revoked.has(sessionId)) {
      const oldest = this.revoked.keys().next().value;
      if (oldest) this.revoked.delete(oldest);
    }
    this.revoked.set(sessionId, { expiresAt: now + DENY_CACHE_TTL_MS });
  }
}
