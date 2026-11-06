import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { passwordHash } from "/workspace/apps/api/dist/src/modules/identity/password-codec.js";

const target = new URL(process.env.DATABASE_URL);
const credentialsFile = process.argv[2];
if (process.env.LIMITED_TEST_STAND !== "true" || target.hostname !== "postgres" || target.pathname !== "/market_stand" || !credentialsFile || existsSync(credentialsFile)) {
  throw new Error("Only a new limited Market stand credential file is allowed");
}
const prisma = new PrismaClient();
try {
  const operator = await prisma.user.findUniqueOrThrow({ where: { email: "operator@marketplace.local" } });
  if (operator.passwordHash || await prisma.user.count() !== 1) throw new Error("Expected pristine reference/operator seed; refusing to change existing accounts");
  const accounts = [];
  await prisma.$transaction(async tx => {
    const password = randomBytes(24).toString("base64url");
    await tx.user.update({ where: { id: operator.id }, data: { passwordHash: passwordHash(password), emailVerifiedAt: new Date(), displayName: "Тестовый оператор" } });
    await tx.organization.update({ where: { bin: "000000000001" }, data: { commerceDataset: "TEST", displayName: "Тестовый оператор Market", legalName: "Тестовый оператор Market" } });
    accounts.push({ role: "operator", email: operator.email, password, path: "/admin/login" });
    for (const [role, capability, bin] of [["buyer", "BUYER", "999999999911"], ["supplier", "SUPPLIER", "999999999912"]]) {
      const accountPassword = randomBytes(24).toString("base64url");
      const email = `${role}@stand.example.invalid`;
      const user = await tx.user.create({ data: { email, displayName: `Тестовый ${role}`, passwordHash: passwordHash(accountPassword), emailVerifiedAt: new Date() } });
      const organization = await tx.organization.create({ data: { bin, commerceDataset: "TEST", legalName: `Тестовая организация ${role}`, displayName: `Тестовая организация ${role}`, capabilities: { create: { capability } } } });
      if (role === "supplier") await tx.supplierProfile.create({ data: { organizationId: organization.id, regulatoryDetails: { source: "limited-test-stand", onboarding: "documents_required" } } });
      const codes = ["organization.view", "catalog.product.view", "notification.view", "document.view", "support.ticket.create", "support.ticket.view", ...(role === "buyer" ? ["order.create", "budget.view"] : ["inventory.view", "supplier.profile.manage", "supplier.warehouse.manage", "catalog.offer.edit", "pricing.manage"])];
      const memberRole = await tx.role.create({ data: { organizationId: organization.id, code: `test_${role}`, name: "Тестовый участник", permissions: { create: codes.map(code => ({ permission: { connect: { code } } })) } } });
      await tx.organizationMembership.create({ data: { userId: user.id, organizationId: organization.id, status: "ACTIVE", isPrimary: true, acceptedAt: new Date(), roles: { create: { roleId: memberRole.id } } } });
      accounts.push({ role, email, password: accountPassword, path: "/login", mfa: "Enroll authenticator on first login" });
    }
  });
  writeFileSync(credentialsFile, JSON.stringify({ mode: "synthetic-only; payments and external sends disabled", accounts }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Created three synthetic accounts; credentials saved privately, no agreements or compliance approvals fabricated");
} finally { await prisma.$disconnect(); }
