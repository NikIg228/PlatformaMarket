import { localDevelopmentPermissions } from "./local-development-permissions.mjs";

export async function verifyLocalPermissions({ prisma, supplierId, offerId, createBuyer, request, runId, assert }) {
  const [fullUser, limitedUser, foreignUser] = await Promise.all([91, 92, 93].map(index => createBuyer(index)));
  const grant = async (user, organizationId, codes, suffix) => {
    const role = await prisma.role.create({ data: { organizationId, code: `${runId}-${suffix}`, name: "Scoped permission fixture",
      permissions: { create: codes.map(code => ({ permission: { connect: { code } } })) } } });
    const membership = await prisma.organizationMembership.upsert({ where: { userId_organizationId: { userId: user.userId, organizationId } }, update: {}, create: { userId: user.userId, organizationId, status: "ACTIVE" } });
    await prisma.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } });
    return { role, identity: { userId: user.userId, organizationId } };
  };
  const full = await grant(fullUser, supplierId, localDevelopmentPermissions.supplier, "full");
  const limited = await grant(limitedUser, supplierId, ["organization.view", "catalog.product.view"], "minimal");
  const foreign = await grant(foreignUser, foreignUser.organizationId, localDevelopmentPermissions.supplier, "foreign");
  for (const [profile, codes] of Object.entries(localDevelopmentPermissions)) {
    assert(new Set(codes).size === codes.length, `${profile} fixture has duplicate permissions`);
    assert(await prisma.permission.count({ where: { code: { in: codes } } }) === codes.length, `${profile} fixture references unavailable permission`);
    assert(!codes.some(code => /^(integration\.|payment\.merchant\.|organization\.roles\.)/.test(code)), `${profile} fixture grants unrelated external/admin power`);
  }
  const reads = [`/suppliers/${supplierId}/data-sources`, `/suppliers/${supplierId}/warehouses`, `/suppliers/${supplierId}/import-batches`, `/compliance/organizations/${supplierId}/credentials`, `/suppliers/${supplierId}/delivery-zones`];
  for (const route of reads) {
    assert((await request(route, { identity: full.identity })).status === 200, `Full fixture cannot read ${route}`);
    assert((await request(route, { identity: limited.identity })).status === 403, `Minimal fixture can read protected ${route}`);
  }
  const writes = [
    [`/suppliers/${supplierId}/offers/${offerId}/price`, "PUT"],
    [`/suppliers/${supplierId}/warehouses`, "POST"],
    [`/suppliers/${supplierId}/import-batches`, "POST"],
    [`/compliance/organizations/${supplierId}/credentials`, "POST"],
    [`/suppliers/${supplierId}/delivery-zones`, "POST"],
  ];
  // Invalid bodies deliberately stop after authorization: prove every guard
  // accepts the scoped full role without producing business mutations.
  for (const [route, method] of writes) {
    assert((await request(route, { method, identity: full.identity, body: {} })).status === 400, `Full fixture blocked before validation on ${route}`);
    assert((await request(route, { method, identity: limited.identity, body: {} })).status === 403, `Minimal fixture bypassed guard on ${route}`);
  }
  assert((await request(reads[0], { identity: foreign.identity })).status === 403, "Full foreign role escaped tenant boundary");
  const pricing = await prisma.permission.findUniqueOrThrow({ where: { code: "pricing.manage" } });
  await prisma.rolePermission.deleteMany({ where: { roleId: full.role.id, permissionId: pricing.id } });
  assert((await request(writes[0][0], { method: "PUT", identity: full.identity, body: {} })).status === 403, "Revoked pricing permission remains active");
  const effective = await request("/access-control/permissions", { identity: full.identity });
  assert(effective.status === 200 && !effective.body.includes("pricing.manage"), "Permission refresh missed revocation");
  console.log("Local permission profiles PASS: full/minimal, read/write guards, foreign tenant and revocation; no business writes");
}
