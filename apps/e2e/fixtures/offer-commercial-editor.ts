import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

export async function verifyCommercialEditor({ db, page, request, supplierId, token, offerId, variantId, unitId, warehouseA, warehouseB, warehouseC, key, width }: {
  db: PrismaClient; page: Page; request: APIRequestContext; supplierId: string; token: string; offerId: string; variantId: string; unitId: string;
  warehouseA: string; warehouseB: string; warehouseC: string; key: string; width: number;
}) {
  const packaging = await db.productPackaging.create({ data: { productVariantId: variantId, unitId, code: key, name: "Упаковка проверки", level: "BASE", quantityInBaseUnit: 10 } });
  await db.supplierOffer.update({ where: { id: offerId }, data: { packagingId: packaging.id } });
  await db.inventoryBalance.create({ data: { supplierOrganizationId: supplierId, warehouseId: warehouseB, productVariantId: variantId, offerId,
    quantityOnHand: 3, quantityAvailable: 3, availabilityStatus: "IN_STOCK", freshnessStatus: "FRESH", freshnessExpiresAt: new Date(Date.now() + 3600000) } });
  await db.warehouse.create({ data: { id: warehouseC, supplierOrganizationId: supplierId, code: `${key}-c`, name: "Новый склад проверки" } });
  await page.goto("/supplier/products");
  const row = page.getByRole("row").filter({ hasText: "Товар проверки согласия" });
  await row.getByRole("button", { name: "Изменить", exact: true }).click();
  const warehouse = page.getByLabel("Склад", { exact: true });
  const stock = page.getByLabel("Остаток, упаковок", { exact: true });
  const price = page.getByLabel("Цена за упаковку, ₸", { exact: true });
  const save = page.getByRole("button", { name: "Сохранить условия", exact: true });
  await expect(warehouse).toBeEnabled();
  await warehouse.selectOption(warehouseA);
  await expect(stock).toHaveValue("10");
  await stock.fill("11");
  await warehouse.selectOption(warehouseB);
  await expect(stock).toHaveValue("3");
  await stock.fill("4");
  await warehouse.selectOption(warehouseA);
  await expect(stock).toHaveValue("11");
  await warehouse.selectOption(warehouseB);
  await expect(stock).toHaveValue("4");
  await price.fill("140.00");
  const headers = { authorization: `Bearer ${token}` };
  const legacy = await request.put(`http://127.0.0.1:4012/api/suppliers/${supplierId}/inventory/balances`, { headers,
    data: { warehouseId: warehouseB, productVariantId: variantId, offerId, quantityOnHand: 2, source: "MANUAL" } });
  expect(legacy.status()).toBe(200);
  const conflict = page.waitForResponse(response => response.request().method() === "PUT" && response.url().endsWith(`/offers/${offerId}/commercial`));
  await save.click(); expect((await conflict).status()).toBe(409);
  await expect(page.getByRole("region", { name: "Конфликт условий" })).toBeVisible();
  await expect(stock).toHaveValue("4"); await expect(price).toHaveValue("140.00");
  expect((await db.offerPrice.findFirstOrThrow({ where: { offerId, status: "ACTIVE" } })).amountMinor.toString()).toBe("13000");
  await page.screenshot({ path: `../../outputs/workspace-audit-a05-conflict-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "Применить мои значения вместо текущих", exact: true }).click();
  await save.click();
  await expect(page.getByText("Цена и остаток сохранены. Предложение остаётся опубликованным.", { exact: true })).toBeVisible();
  await warehouse.selectOption(warehouseA); await expect(stock).toHaveValue("11");
  await save.click();
  await expect(save).toBeEnabled();
  await db.warehouse.update({ where: { id: warehouseB }, data: { status: "INACTIVE" } });
  await page.getByRole("button", { name: "Обновить склады", exact: true }).click();
  await expect(warehouse.locator(`option[value="${warehouseB}"]`)).toHaveCount(0);
  await db.warehouse.update({ where: { id: warehouseB }, data: { status: "ACTIVE" } });
  await page.getByRole("button", { name: "Обновить склады", exact: true }).click();
  await expect(warehouse.locator(`option[value="${warehouseB}"]`)).toHaveCount(1);
  await warehouse.selectOption(warehouseC); await expect(stock).toHaveValue("0");
  await stock.fill("2");
  const commands: unknown[] = [];
  await page.route(`**/offers/${offerId}/commercial`, async route => {
    if (route.request().method() !== "PUT") return route.continue();
    commands.push(route.request().postDataJSON());
    if (commands.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      return route.abort("failed");
    }
    return route.continue();
  });
  const lost = page.waitForEvent("requestfailed", req => req.method() === "PUT" && req.url().endsWith(`/offers/${offerId}/commercial`));
  await save.click(); await lost;
  await expect(stock).toBeDisabled();
  await page.getByRole("button", { name: "Повторить сохранение", exact: true }).click();
  await expect(stock).toBeEnabled();
  expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]);
  const created = await db.inventoryBalance.findUniqueOrThrow({ where: { supplierOrganizationId_warehouseId_productVariantId: {
    supplierOrganizationId: supplierId, warehouseId: warehouseC, productVariantId: variantId,
  } } });
  expect(created.version).toBe(1); expect(created.quantityOnHand.toString()).toBe("2");
  await stock.fill("9");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await row.getByRole("button", { name: "Изменить", exact: true }).click();
  await expect(warehouse).toBeEnabled(); await warehouse.selectOption(warehouseC);
  await expect(stock).toHaveValue("2");
  await db.offerPublication.update({ where: { offerId }, data: { status: "DRAFT", marketplaceVisible: false } });
  await stock.fill("3"); await save.click();
  await expect(page.getByText("Цена и остаток сохранены. Предложение не опубликовано.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Опубликовать предложение", exact: true })).toBeVisible();
}
