import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { installPilotWorkspace } from "../fixtures/workspace-session";

test("supplier creates and resumes a manual draft, then publishes it into the clinic catalogue", async ({ page, browser }) => {
  test.setTimeout(90000);
  const url = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.pathname).toBe(process.env.GITHUB_ACTIONS === "true" ? "/marketplace" : "/dentmarket_audit_20260914");
  const db = new PrismaClient();
  let workspace: Awaited<ReturnType<typeof installPilotWorkspace>> | undefined;
  let productId: string | undefined;
  try {
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity.name).toBe(url.pathname.slice(1));
    workspace = await installPilotWorkspace(page, "SUPPLIER", ["catalog.offer.edit", "pricing.manage", "inventory.adjust", "catalog.offer.publish"]);
    const unit = await db.unitOfMeasure.findFirstOrThrow();
    const category = await db.category.findFirstOrThrow({ where: { status: "ACTIVE" } });
    const industry = await db.industry.findFirstOrThrow();
    const name = `Manual browser ${randomUUID()}`;
    const product = await db.product.create({ data: { canonicalName: name, slug: name.toLowerCase().replaceAll(" ", "-"), productType: "CONSUMABLE", status: "ACTIVE", baseUnitId: unit.id,
      categories: { create: { categoryId: category.id } }, industries: { create: { industryId: industry.id } },
      variants: { create: { status: "ACTIVE", sku: name, saleUnitId: unit.id, packagings: { create: { code: "UNIT", name: "Пробная упаковка", level: "SALE", unitId: unit.id, quantityInBaseUnit: 1 } } } },
    }, include: { variants: true } });
    productId = product.id;
    await page.goto("http://127.0.0.1:3002");
    await page.getByRole("button", { name: "Предложения", exact: true }).click();
    await page.getByRole("button", { name: "Добавить предложение вручную", exact: true }).click();
    await page.getByLabel("Товар, артикул или штрихкод").fill(name);
    await page.getByRole("button", { name: "Найти в мастер-каталоге", exact: true }).click();
    await page.getByRole("button", { name: `Выбрать ${name}`, exact: true }).click();
    await page.getByLabel("Цена за упаковку, ₸", { exact: true }).fill("123,45");
    await page.getByLabel("Ставка НДС, % (если применима)").fill("12");
    const warehouse = await db.warehouse.findFirstOrThrow({ where: { supplierOrganizationId: workspace.organizationId, status: "ACTIVE" } });
    await page.getByLabel("Склад", { exact: true }).selectOption(warehouse.id);
    // Zero stock intentionally fails publication, independent of supplier admission.
    await page.getByLabel("Остаток, базовых единиц").fill("0");
    await page.getByRole("button", { name: "Сохранить условия", exact: true }).click();
    await expect(page.getByText("Условия сохранены. Предложение ещё не опубликовано.", { exact: true })).toBeVisible();
    const offer = await db.supplierOffer.findFirstOrThrow({ where: { supplierOrganizationId: workspace.organizationId, productVariantId: product.variants[0]!.id }, include: { prices: true } });
    expect(offer.prices.find(price => price.status === "ACTIVE")?.amountMinor.toString()).toBe("12345");
    await page.getByRole("button", { name: "Опубликовать предложение", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(await db.supplierOffer.count({ where: { supplierOrganizationId: workspace.organizationId, productVariantId: product.variants[0]!.id } })).toBe(1);
    const publication = await db.offerPublication.findUniqueOrThrow({ where: { offerId: offer.id } });
    expect(publication.marketplaceVisible).toBe(false);
    await page.reload();
    await page.getByRole("button", { name: "Предложения", exact: true }).click();
    await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Настроить предложение" }).click();
    await expect(page.getByLabel("Цена за упаковку, ₸", { exact: true })).toHaveValue("123.45");
    await expect(page.getByLabel("Ставка НДС, % (если применима)")).toHaveValue("12");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Сохранить условия", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByLabel("Остаток, базовых единиц").fill("10");
    await page.getByRole("button", { name: "Сохранить условия", exact: true }).click();
    await expect(page.getByText("Условия сохранены. Предложение ещё не опубликовано.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Опубликовать предложение", exact: true }).click();
    await expect(page.getByText("Предложение опубликовано. Оно доступно клиникам при актуальной цене и остатке.", { exact: true })).toBeVisible();
    const buyerPage = await browser.newPage();
    try {
      await buyerPage.goto(`http://127.0.0.1:3001/products/${product.id}`);
      await expect(buyerPage.getByRole("heading", { name, exact: true })).toBeVisible();
      await expect(buyerPage.getByRole("button", { name: "Сравнить и заказать", exact: true })).toBeVisible();
    } finally { await buyerPage.close(); }
  } finally {
    if (productId) await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
    await workspace?.dispose(); await db.$disconnect();
  }
});
