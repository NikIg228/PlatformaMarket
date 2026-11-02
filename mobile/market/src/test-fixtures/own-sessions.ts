import { identitySessionsSchema, type IdentitySession } from "../../../../packages/schemas/src/identity-management";
import { api, org, otherOrg, user, sessionId } from "./market-session";
import type { ReadScope } from "../read-controller";
export const ownSessionScope: ReadScope = { product: "market", environment: api, userId: user.id, organizationId: org, generation: 1 };
export const ownSessionId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const currentOwnSessionId = sessionId;
export function ownSession(n: number, overrides: Partial<IdentitySession> = {}): IdentitySession { return identitySessionsSchema.element.parse({ id: ownSessionId(n), activeOrganizationId: org, authMethods: ["password"], ipAddress: "192.0.2.12", userAgent: `SYNTHETIC client ${n}`, lastUsedAt: "2026-10-31T00:00:00.000Z", createdAt: "2026-10-20T00:00:00.000Z", expiresAt: "2099-11-01T00:00:00.000Z", ...overrides }); }
export const ownSessions = () => [ownSession(5, { userAgent: "SYNTHETIC captured current client" }), ownSession(160002, { activeOrganizationId: otherOrg, userAgent: "SYNTHETIC other-context client", authMethods: ["google", "totp"] }), ownSession(160003, { activeOrganizationId: null, userAgent: null, ipAddress: null, lastUsedAt: null, authMethods: [] })];
