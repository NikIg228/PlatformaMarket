import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { e2eJwtSecret } from "./workspace-session";

export async function installOperatorSession(page: Page, db: PrismaClient, actor: { userId: string; organizationId: string }) {
  const target = new URL(process.env.DATABASE_URL!);
  const name = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted" ? "marketplace" : "dentmarket_audit_20260914";
  assert(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === `/${name}`);
  const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  assert.equal(identity.name, name);
  await db.organizationMembership.findFirstOrThrow({ where: {
    ...actor, status: "ACTIVE", user: { status: "ACTIVE" },
    organization: { capabilities: { some: { capability: "MARKETPLACE_OPERATOR" } } },
  } });
  const id = randomUUID(), now = Math.floor(Date.now() / 1000);
  await db.authSession.create({ data: { id, userId: actor.userId, familyId: randomUUID(), refreshTokenHash: createHash("sha256").update(randomUUID()).digest("hex"), organizationIds: [actor.organizationId], activeOrganizationId: actor.organizationId, authMethods: ["password"], expiresAt: new Date(Date.now() + 1800000) } });
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: actor.userId, jti: id, organization_id: actor.organizationId, organization_ids: [actor.organizationId], amr: ["password"], iss: process.env.JWT_ISSUER ?? "dentmarket-kz", aud: process.env.JWT_AUDIENCE ?? "dentmarket-web", iat: now, exp: now + 1800 })}`;
  const accessToken = unsigned + "." + createHmac("sha256", e2eJwtSecret).update(unsigned).digest("base64url");
  await page.addInitScript(session => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify(session)), { accessToken, organizationId: actor.organizationId });
  return async () => { await db.authSession.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "flow_b3_fixture_finished" } }); };
}
