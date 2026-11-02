import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";

export async function verifyPersonalCartUpgrade(prisma, assert) {
  const schema = `personal_cart_upgrade_${process.pid}`;
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261030000000_personal_cart/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_PERSONAL_CART_UPGRADE");
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const table of ["User", "SupplierOffer", "Cart", "Checkout", "PaymentIntent"]) {
        await tx.$executeRawUnsafe(`CREATE TABLE "${table}" ("id" UUID PRIMARY KEY)`);
        await tx.$executeRawUnsafe(`INSERT INTO "${table}" VALUES ('10000000-0000-4000-8000-000000000001')`);
      }
      for (const statement of migration.split(";").map(value => value.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      for (const table of ["Cart", "Checkout", "PaymentIntent"]) {
        const [row] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
        assert(row.count === 1, `Personal migration altered ${table} history`);
      }
      const [row] = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "PersonalCart"');
      assert(row.count === 0, "Personal migration invented ownership");
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert((await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`).length === 0, "Personal upgrade fixture leaked");
  console.log("Personal cart additive upgrade preserves organization carts/checkout/payment history PASS");
}

export async function verifyPersonalCart({ prisma, apiBase, offerId, createBuyer, runId, assert }) {
  const users = [], sessions = [], carts = [];
  const trigger = `personal_cart_audit_${process.pid}`;
  const price = await prisma.offerPrice.findFirstOrThrow({ where: { offerId, status: "ACTIVE" } });
  const originalPrice = price.amountMinor;
  const originalPublication = await prisma.offerPublication.findUniqueOrThrow({ where: { offerId } });
  const beforeReservations = await prisma.inventoryReservation.count({ where: { inventoryBalance: { offerId } } });
  let contractId;
  async function login(userId) {
    const refresh = randomUUID() + randomUUID();
    const session = await prisma.authSession.create({ data: { userId, familyId: randomUUID(), refreshTokenHash: createHash("sha256").update(refresh).digest("hex"),
      organizationIds: [], activeOrganizationId: null, authMethods: ["password", "mfa"], expiresAt: new Date(Date.now() + 300000) } });
    sessions.push(session.id);
    const response = await fetch(`${apiBase}/auth/personal-current`, { headers: { cookie: `mp_refresh=${refresh}; mp_csrf=synthetic-personal-cart-csrf-cookie` } });
    const result = await response.json();
    assert(response.ok && result?.user.id === userId && result.mode === "PERSONAL", "Personal session cannot restore identity without membership");
    return { token: result.accessToken, sessionId: session.id };
  }
  async function request(path, identity, method = "GET", body) {
    const response = await fetch(`${apiBase}${path}`, { method, headers: { ...(identity ? { authorization: `Bearer ${identity.token}` } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    assert(text.length > 0, `${method} ${path} returned empty body (${response.status}); expected a JSON response`);
    return { status: response.status, body: JSON.parse(text) };
  }
  try {
    for (const label of ["a", "b"]) {
      users.push(await prisma.user.create({ data: { email: `${runId}-personal-${label}@example.invalid`, displayName: `Personal ${label}`, emailVerifiedAt: new Date() } }));
    }
    const a = await login(users[0].id), b = await login(users[1].id);
    assert((await request("/personal/carts/current", a)).body === null, "Empty personal cart should be null");
    const creations = await Promise.all([request("/personal/carts", a, "POST", {}), request("/personal/carts", a, "POST", {})]);
    assert(creations.every(result => result.status === 201) && creations[0].body.id === creations[1].body.id, "Concurrent creation did not converge");
    let cart = creations[0].body; carts.push(cart.id);
    assert(await prisma.auditLog.count({ where: { entityId: cart.id, action: "personal_cart.created" } }) === 1, "Creation replay duplicated audit");
    assert((await request(`/personal/carts/${cart.id}`, b)).status === 404, "Foreign user can read personal cart");
    assert((await request(`/personal/carts/${cart.id}/items`, b, "POST", { expectedVersion: 1, offerId, quantity: 1 })).status === 404, "Foreign user can write personal cart");
    assert((await request(`/personal/carts/${cart.id}/items`, a, "POST", { expectedVersion: 1, offerId, quantity: 0 })).status === 400, "Zero quantity accepted");
    const injected = await fetch(`${apiBase}/personal/carts/current`, { headers: { "x-user-id": users[0].id, "x-session-id": a.sessionId } });
    assert(injected.status === 401, "Development headers impersonate a personal owner");
    const added = await request(`/personal/carts/${cart.id}/items`, a, "POST", { expectedVersion: cart.version, offerId, quantity: 1 });
    assert(added.status === 201, `Personal add failed: ${JSON.stringify(added.body)}`); cart = added.body;
    const item = cart.items[0];
    const race = await Promise.all([2, 3].map(quantity => request(`/personal/carts/${cart.id}/items/${item.id}`, a, "PATCH", { expectedVersion: cart.version, quantity })));
    assert(race.filter(value => value.status === 200).length === 1 && race.filter(value => value.status === 409).length === 1, "Concurrent writes lost a quantity update");
    cart = race.find(value => value.status === 200).body;
    assert((await request(`/personal/carts/${cart.id}/items`, a, "POST", { expectedVersion: 1, offerId, quantity: 1 })).status === 409, "Stale add replay accepted");
    assert(await prisma.personalCartItem.count({ where: { cartId: cart.id } }) === 1, "Replay duplicated item");
    const stored = (await request(`/personal/carts/${cart.id}`, a)).body;
    assert(stored.version === cart.version && stored.items[0].snapshot.quantity === cart.items[0].snapshot.quantity, "Reload lost saved quantity");

    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger AS $$ BEGIN IF NEW."entityType" = 'PersonalCart' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    const failed = await request(`/personal/carts/${cart.id}/items/${item.id}`, a, "PATCH", { expectedVersion: cart.version, quantity: 4 });
    assert(failed.status === 500, "Audit failure fixture did not fail");
    const rolledBack = await prisma.personalCart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } });
    assert(rolledBack.version === cart.version && rolledBack.items[0].quantity.eq(cart.items[0].snapshot.quantity), "Audit failure did not roll back version and item");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);

    await prisma.offerPrice.update({ where: { id: price.id }, data: { amountMinor: originalPrice.plus(100) } });
    const shown = (await request(`/personal/carts/${cart.id}/validate`, a, "POST")).body;
    assert(shown.items[0].requiresAcceptance && shown.items[0].changes.includes("PRICE"), "Price change hidden");
    const accept = { expectedVersion: cart.version, acceptedItems: [{ cartItemId: item.id, snapshot: shown.items[0].current }] };
    await prisma.offerPrice.update({ where: { id: price.id }, data: { amountMinor: originalPrice.plus(200) } });
    assert((await request(`/personal/carts/${cart.id}/reprice`, a, "POST", accept)).status === 409, "Stale shown price accepted");
    const latest = (await request(`/personal/carts/${cart.id}/validate`, a, "POST")).body;
    const accepted = await request(`/personal/carts/${cart.id}/reprice`, a, "POST", { ...accept, acceptedItems: [{ cartItemId: item.id, snapshot: latest.items[0].current }] });
    assert(accepted.status === 201 && accepted.body.items[0].snapshot.unitPriceMinor === originalPrice.plus(200).toString(), "Current acceptance failed");
    cart = accepted.body;
    assert((await request(`/carts/${cart.id}/checkout`, a, "POST", { idempotencyKey: `${runId}-personal-forbidden` })).status === 401, "Personal bearer reached organizational checkout");
    // 98/99 are reserved for this fixture; 91-93 belong to local permissions.
    const orgA = await createBuyer(98), orgB = await createBuyer(99);
    await prisma.organizationMembership.create({ data: { userId: orgA.userId, organizationId: orgB.organizationId, status: "ACTIVE", acceptedAt: new Date() } });
    const member = await login(orgA.userId);
    const own = await request("/personal/carts", member, "POST", {}); carts.push(own.body.id);
    const supplier = await prisma.supplierOffer.findUniqueOrThrow({ where: { id: offerId } });
    const contract = await prisma.contractPrice.create({ data: { offerId, productVariantId: supplier.productVariantId, supplierOrganizationId: supplier.supplierOrganizationId, buyerOrganizationId: orgA.organizationId,
      amountMinor: 1, currency: "KZT", minimumQuantity: 1, validFrom: new Date(0), status: "ACTIVE" } }); contractId = contract.id;
    const memberAdded = await request(`/personal/carts/${own.body.id}/items`, member, "POST", { expectedVersion: own.body.version, offerId, quantity: 1 });
    assert(memberAdded.status === 201 && memberAdded.body.items[0].snapshot.source !== "CONTRACT", "Personal mode leaked organization contract price");
    await prisma.offerPublication.update({ where: { offerId }, data: { allowedBuyerIds: [orgA.organizationId] } });
    const privateValidation = await request(`/personal/carts/${own.body.id}/validate`, member, "POST");
    assert(privateValidation.body.items[0].current === null, "Membership leaked restricted offer conditions into personal mode");
    const organizationalCheckout = await fetch(`${apiBase}/carts/${cart.id}/checkout`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": orgA.userId, "x-organization-id": orgA.organizationId }, body: JSON.stringify({ idempotencyKey: `${runId}-personal-id` }) });
    assert(organizationalCheckout.status === 404, "Organization checkout accepted personal cart ID");
    assert(await prisma.inventoryReservation.count({ where: { inventoryBalance: { offerId } } }) === beforeReservations, "Personal cart reserved stock");
    const removed = await request(`/personal/carts/${cart.id}/items/${item.id}`, a, "DELETE", { expectedVersion: cart.version });
    assert(removed.status === 200 && removed.body.items.length === 0, "Explicit removal failed");
    await prisma.authSession.update({ where: { id: a.sessionId }, data: { status: "REVOKED" } });
    assert((await request("/personal/carts/current", a)).status === 401, "Revoked personal session accepted");
    console.log("Personal cart HTTP/PostgreSQL: no membership, owner denial, header forgery, concurrent create/CAS, replay, rollback, price acceptance, multi-org privacy, checkout denial, no reserve and revocation PASS");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    if (contractId) await prisma.contractPrice.delete({ where: { id: contractId } });
    await prisma.offerPrice.update({ where: { id: price.id }, data: { amountMinor: originalPrice } });
    await prisma.offerPublication.update({ where: { offerId }, data: { allowedBuyerIds: originalPublication.allowedBuyerIds ?? Prisma.DbNull } });
    await prisma.personalCart.deleteMany({ where: { id: { in: carts } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "PersonalCart", entityId: { in: carts } } });
    await prisma.authSession.deleteMany({ where: { id: { in: sessions } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  }
}
