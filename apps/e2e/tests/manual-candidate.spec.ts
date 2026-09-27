import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { installPilotWorkspace } from "../fixtures/workspace-session";

test("manual proposal is reviewed by the operator, configured by supplier and shown to buyer", async ({ page, browser, request }) => {
  test.setTimeout(120000);
  const target = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(target.hostname);
  expect(target.pathname).toBe(process.env.GITHUB_ACTIONS === "true" ? "/marketplace" : "/dentmarket_audit_20260914");
  const db = new PrismaClient();
  let workspace: Awaited<ReturnType<typeof installPilotWorkspace>> | undefined;
  const products: string[] = [], proposals: string[] = [];
  const operatorPage = await browser.newPage();
  const buyerPage = await browser.newPage();
  try {
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity.name).toBe(target.pathname.slice(1));
    workspace = await installPilotWorkspace(page, "SUPPLIER", ["catalog.offer.edit", "pricing.manage", "inventory.adjust", "catalog.offer.publish"]);
    const name = `Proposal ${randomUUID()}`;
    await page.goto("http://127.0.0.1:3002");
    await page.getByRole("button", { name: "Предложения", exact: true }).click();
    await page.getByRole("button", { name: "Добавить предложение вручную", exact: true }).click();
    await page.getByLabel("Товар, артикул или штрихкод", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Нет нужного товара — заявка модератору", exact: true }).click();
    await page.getByLabel("Описание, упаковка и ссылка на материалы", { exact: true }).fill("Проверяемый новый материал; упаковка 10 штук.");
    await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("отправлена на модерацию");
    const candidate = await db.productCandidate.findFirstOrThrow({ where: { supplierOrganizationId: workspace.organizationId, proposedName: name } });
    proposals.push(candidate.id);
    await page.getByRole("button", { name: "Обновить мои заявки", exact: true }).click();
    await expect(page.getByRole("table", { name: "Мои заявки на товары" }).getByRole("row").filter({ hasText: name })).toContainText("На проверке");

    const category = await db.category.findFirstOrThrow({ where: { status: "ACTIVE", industry: { status: "ACTIVE" } } });
    const unit = await db.unitOfMeasure.findFirstOrThrow();
    await operatorPage.goto("http://127.0.0.1:3010");
    await operatorPage.getByRole("button", { name: "Каталог", exact: true }).click();
    await expect(operatorPage.getByRole("button", { name: "Обновить очередь заявок", exact: true })).toBeEnabled();
    const card = operatorPage.locator("section").filter({ has: operatorPage.getByRole("heading", { name, exact: true }) }).last();
    for (let index = 0; index < 20 && !(await card.isVisible()); index++) {
      const next = operatorPage.getByRole("button", { name: "Следующие заявки", exact: true });
      if (!(await next.isVisible())) break;
      await next.click();
    }
    await expect(card).toBeVisible();
    await expect(card).toContainText("упаковка 10 штук");
    await card.getByLabel("Индустрия").selectOption(category.industryId);
    await card.getByLabel("Категория").selectOption(category.id);
    await card.getByLabel("Базовая единица").selectOption(unit.id);
    await card.getByLabel("Базовых единиц в упаковке").fill("10");
    await card.getByRole("button", { name: "Утвердить товар и создать черновик предложения", exact: true }).click();
    await expect.poll(async () => (await db.productCandidate.findUniqueOrThrow({ where: { id: candidate.id } })).status).toBe("APPROVED");
    const decided = await db.productCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    products.push(decided.approvedProductId!);
    const offer = await db.supplierOffer.findFirstOrThrow({ where: { productVariantId: decided.approvedVariantId!, supplierOrganizationId: workspace.organizationId }, include: { publication: true, packaging: true, prices: true } });
    expect(offer.publication?.marketplaceVisible).toBe(false);
    expect(offer.packaging?.quantityInBaseUnit.toString()).toBe("10");
    expect(offer.prices).toHaveLength(0);

    await page.getByRole("button", { name: "Обновить мои заявки", exact: true }).click();
    await expect(page.getByRole("table", { name: "Мои заявки на товары" }).getByRole("row").filter({ hasText: name })).toContainText("Одобрено");
    await page.getByRole("row").filter({ has: page.getByRole("button", { name: "Настроить предложение" }) }).filter({ hasText: name }).getByRole("button", { name: "Настроить предложение" }).click();
    await page.getByLabel("Цена за упаковку, ₸", { exact: true }).fill("1000");
    const warehouse = await db.warehouse.findFirstOrThrow({ where: { supplierOrganizationId: workspace.organizationId, status: "ACTIVE" } });
    await page.getByLabel("Склад", { exact: true }).selectOption(warehouse.id);
    await page.getByLabel("Остаток, упаковок", { exact: true }).fill("50");
    await page.getByRole("button", { name: "Сохранить условия", exact: true }).click();
    await expect(page.getByText("Условия сохранены. Предложение ещё не опубликовано.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Опубликовать предложение", exact: true }).click();
    await expect(page.getByText("Предложение опубликовано. Оно доступно клиникам при актуальной цене и остатке.", { exact: true })).toBeVisible();
    await buyerPage.goto(`http://127.0.0.1:3001/products/${decided.approvedProductId}`);
    await expect(buyerPage.getByRole("heading", { name, exact: true })).toBeVisible();

    // Real PostgreSQL race on another owned proposal: one decision and one master.
    const operator = await db.organizationMembership.findFirstOrThrow({ where: { status: "ACTIVE", organization: { capabilities: { some: { capability: "MARKETPLACE_OPERATOR" } } } } });
    const raceName = `Concurrency ${randomUUID()}`;
    const external = await db.supplierExternalItem.create({ data: { supplierOrganizationId: workspace.organizationId, sourceId: (await db.supplierExternalItem.findUniqueOrThrow({ where: { id: candidate.externalItemId } })).sourceId, externalId: randomUUID(), name: raceName, normalizedName: raceName.toLowerCase(), rawData: {} } });
    const race = await db.productCandidate.create({ data: { supplierOrganizationId: workspace.organizationId, externalItemId: external.id, proposedName: raceName } });
    proposals.push(race.id);
    const data = { canonicalName: raceName, slug: raceName.toLowerCase().replaceAll(" ", "-"), productType: "MATERIAL", industryIds: [category.industryId], categoryIds: [category.id], saleUnitId: unit.id, packageQuantity: 1 };
    const headers = { "x-user-id": operator.userId, "x-organization-id": operator.organizationId };
    const outcomes = await Promise.all([1, 2].map(() => request.post(`http://127.0.0.1:4012/api/moderation/product-candidates/${race.id}/approve`, { headers, data })));
    expect(outcomes.map(response => response.status()).sort()).toEqual([201, 409]);
    const raceResult = await db.productCandidate.findUniqueOrThrow({ where: { id: race.id } });
    products.push(raceResult.approvedProductId!);
    expect(await db.product.count({ where: { canonicalName: raceName } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: race.id, action: "moderation.product_candidate.approved" } })).toBe(1);
  } finally {
    // Archive only this run's synthetic masters; retain their audit history.
    const approved = await db.productCandidate.findMany({ where: { id: { in: proposals } }, select: { approvedProductId: true } });
    const ownedProducts = [...new Set([...products, ...approved.flatMap(item => item.approvedProductId ? [item.approvedProductId] : [])])];
    await db.product.updateMany({ where: { id: { in: ownedProducts } }, data: { status: "ARCHIVED" } });
    await db.productCandidate.updateMany({ where: { id: { in: proposals }, status: "PENDING" }, data: { status: "REJECTED", rejectionReason: "Isolated browser fixture finished" } });
    await workspace?.dispose(); await operatorPage.close(); await buyerPage.close(); await db.$disconnect();
  }
});
