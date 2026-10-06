import { test, expect } from "@playwright/test";
import { productFixture, sampleOffer, noOverflow, permissions, organizationId, offerId, warehouseId, id } from "./supplier-products.fixture";

for (const width of [1440, 390]) test(`offer inspector reference, menu and dirty navigation ${width}`, async ({ page }, testInfo) => {
  const state = await productFixture(page);
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/supplier/products");
  const opener = page.getByRole("button", { name: "Композит для реставрации", exact: true });
  await opener.click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "Предложение", exact: true })).toBeVisible();
  await expect(panel).toHaveCSS("width", `${Math.min(640, width)}px`);
  await expect(panel.getByRole("region", { name: "Остатки по складам" })).toContainText("28 уп.");
  await expect(panel.getByRole("region", { name: "Остатки по складам" })).toContainText("3 уп.");
  await expect(panel.getByRole("region", { name: "Остатки по складам" })).toContainText("25 уп.");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath(`inspector-${width}.png`), animations: "disabled", fullPage: true });
  const menu = panel.getByRole("button", { name: "Действия с предложением" });
  await menu.focus(); await menu.press("Enter");
  const preview = page.getByRole("menuitem", { name: /Открыть карточку каталога/ });
  await expect(preview).toHaveAttribute("target", "_blank");
  await expect(preview).toHaveAttribute("href", `/products/${sampleOffer.productVariant.product.id}`);
  await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
  await panel.getByRole("button", { name: "Изменить цену" }).click();
  const field = panel.getByRole("textbox", { name: "Цена за упаковку, ₸", exact: true });
  await expect(field).toBeEnabled(); await field.fill("1250");
  page.once("dialog", dialog => dialog.dismiss()); await panel.getByRole("button", { name: "Закрыть предложение" }).click();
  await expect(field).toHaveValue("1250");
  page.once("dialog", dialog => dialog.dismiss()); await panel.getByRole("link", { name: "Обновить остатки", exact: true }).click();
  await expect(field).toHaveValue("1250");
  page.once("dialog", dialog => dialog.accept()); await panel.getByRole("button", { name: "← К предложению" }).click();
  await panel.getByRole("link", { name: "Предложить исправление карточки", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`corrections\\?mode=new&offer=${offerId}`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("offer inspector warehouse recovery, delivery save and no unsaved warning after save", async ({ page }) => {
  const state = await productFixture(page);
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  let fail = true;
  await page.route(`**/api/suppliers/${organizationId}/warehouses`, route => route.fulfill(fail ? { status: 503, json: { message: "Склады временно недоступны" } } : { json: [{ id: warehouseId, name: "Основной склад", status: "ACTIVE" }] }));
  const writes: unknown[] = [];
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/delivery-options`, route => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    const input = route.request().postDataJSON(); writes.push(input);
    return route.fulfill({ json: { ...input, id: id(40), offerId } });
  });
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  await page.getByRole("button", { name: "Настроить доставку", exact: true }).click();
  await expect(page.getByText("Склады временно недоступны")).toBeVisible(); fail = false;
  await page.getByRole("button", { name: "Повторить загрузку редактора" }).click();
  const minimum = page.getByRole("textbox", { name: "Минимальный срок, часов", exact: true });
  await expect(minimum).toBeVisible(); await minimum.fill("3");
  await page.getByRole("button", { name: "Сохранить доставку", exact: true }).click();
  await expect(page.getByText(/Условия доставки сохранены/)).toBeVisible();
  expect(writes).toEqual([expect.objectContaining({ warehouseId, minLeadTimeHours: 3 })]);
  let prompted = false; page.on("dialog", async dialog => { prompted = true; await dialog.dismiss(); });
  await page.getByRole("button", { name: "← К предложению" }).click();
  await expect(page.getByRole("button", { name: "Изменить цену" })).toBeVisible();
  expect(prompted).toBe(false); expect(state.unexpected).toEqual([]);
});

test("offer inspector missing data and restricted actions", async ({ page }) => {
  const state = await productFixture(page, permissions.filter(value => !["pricing.manage", "delivery.manage", "promotion.manage"].includes(value)));
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  state.offers = [{ ...sampleOffer, prices: [], inventoryBalances: [] }];
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Остатки ещё не указаны.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Изменить цену" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Настроить доставку" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Создать акцию" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Обновить остатки", exact: true })).toHaveAttribute("href", `/supplier/products/inventory?offer=${offerId}&edit=1`);
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Композит для реставрации", exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});
