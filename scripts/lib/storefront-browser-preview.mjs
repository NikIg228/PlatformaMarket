import { writeFile, unlink, access } from "node:fs/promises";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { completeFixtureOrganization } from "./organization-profile-fixture.mjs";

/** Owned disposable fixture, with a bounded lifetime and the verifier's normal cleanup. */
export async function storefrontBrowserPreview({ prisma, fixture, runId, apiBase, jwtSecret }) {
  const target = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/dentmarket_audit_20260914") throw new Error("Storefront preview requires the approved disposable database");
  const supplierId = fixture.supplierId;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: `${runId}-storefront-editor@example.invalid` } });
  await completeFixtureOrganization(prisma, supplierId);
  await prisma.organization.update({ where: { id: supplierId }, data: { displayName: "Дентал Снаб · тестовая витрина" } });
  await prisma.supplierProfile.update({ where: { organizationId: supplierId }, data: { storefrontContent: {
    ru: { description: "Материалы и инструменты для стоматологических клиник. Демонстрационные сведения из изолированного теста.", location: "Алматы, тестовый адрес", hours: "Пн–Пт, 09:00–18:00", delivery: "Самовывоз со склада. Доставка по Казахстану по согласованию." },
    kk: { description: "Стоматологиялық клиникаларға арналған материалдар мен құралдар. Оқшауланған сынақ деректері.", location: "Алматы, сынақ мекенжайы", hours: "Дс–Жм, 09:00–18:00", delivery: "Қоймадан алып кету. Қазақстан бойынша жеткізу — келісім бойынша." },
  } } });
  await prisma.product.update({ where: { id: fixture.productId }, data: { canonicalName: "Стоматологический материал A2 · тестовый товар", externalMetadata: { importedAsCanonicalDraft: true } } });
  const { SearchProjectionService } = await import("../../apps/api/dist/src/modules/search/search-projection.service.js");
  await new SearchProjectionService(prisma, {}).rebuildProduct(fixture.productId);
  const sessionId = randomUUID(), now = Math.floor(Date.now() / 1000);
  await prisma.authSession.create({ data: { id: sessionId, userId: user.id, familyId: randomUUID(), refreshTokenHash: createHash("sha256").update(randomUUID()).digest("hex"), organizationIds: [supplierId], activeOrganizationId: supplierId, authMethods: ["password"], expiresAt: new Date(Date.now() + 3_600_000) } });
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, jti: sessionId, organization_id: supplierId, organization_ids: [supplierId], amr: ["password"], iss: "dentmarket-kz", aud: "dentmarket-web", iat: now, exp: now + 3600 })}`;
  const session = { sessionId, capability: "SUPPLIER", organizationId: supplierId, organizationDisplayName: "Дентал Снаб · тестовая витрина", displayName: user.displayName, accessToken: `${unsigned}.${createHmac("sha256", jwtSecret).update(unsigned).digest("base64url")}`, accessTokenExpiresAt: Date.now() + 3_600_000 };
  const directory = new URL("../../.tmp/", import.meta.url), manifest = new URL("storefront-preview.json", directory), stop = new URL("storefront-preview.stop", directory);
  await unlink(stop).catch(() => {});
  await writeFile(manifest, JSON.stringify({ supplierId, productId: fixture.productId, apiBase, session }));
  console.log(`Storefront browser fixture READY: ${apiBase}; manifest .tmp/storefront-preview.json; bounded to 20 minutes`);
  try {
    const deadline = Date.now() + 20 * 60_000;
    while (Date.now() < deadline) {
      if (await access(stop).then(() => true, () => false)) return;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally {
    await prisma.authSession.deleteMany({ where: { id: sessionId } });
    await prisma.uploadAsset.deleteMany({ where: { organizationId: supplierId, purpose: "supplier-storefront-logo" } });
    await prisma.securityEvent.deleteMany({ where: { organizationId: supplierId, type: "upload.policy.rejected" } });
    await unlink(manifest).catch(() => {}); await unlink(stop).catch(() => {});
  }
}
