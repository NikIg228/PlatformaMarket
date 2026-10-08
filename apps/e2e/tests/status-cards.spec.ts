import { expect, test, type Page } from "@playwright/test";

const organizationId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const cityId = "33333333-3333-4333-8333-333333333333";
async function fixture(page: Page) {
  const state = { firstFail: false, moreFail: false, compareFail: false, filterFail: false, includeFilters: true, add: "success", writes: 0, probeOk: false, probes: 0 };
  await page.addInitScript(({ organizationId, sessionId }) => sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify({ capability: "BUYER", organizationId, sessionId, actorId: organizationId, accessToken: "fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Тестовый сотрудник", organizationDisplayName: "Клиника" })), { organizationId, sessionId });
  const offer = { id: "offer", supplier: { id: organizationId, name: "Поставщик" }, priceMinor: "120000", currency: "KZT", normalizedPriceMinor: null, packaging: { name: "Упаковка", quantityInBaseUnit: "1", unit: "шт" }, available: true, confirmationMode: "AUTO", deliveryMethods: [] };
  await page.route("**/catalog-search?**", route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? 0);
    if (state.filterFail && new URL(route.request().url()).searchParams.get("limit") === "1") return route.fulfill({ status: 503, json: {} });
    if (state.firstFail || offset > 0 && state.moreFail) return route.fulfill({ status: 503, json: { message: "Временно недоступно" } });
    const items = Array.from({ length: offset === 0 ? 24 : 1 }, (_, i) => ({ id: `product-${offset+i}`, name: `Тестовый товар ${offset+i}`, brand: null, manufacturer: null, categories: [], offers: [offer], isAvailable: true, minNormalizedPriceMinor: null }));
    return route.fulfill({ json: { items, total: 25, nextOffset: offset + items.length, facets: { categories: [], suppliers: [] }, filterOptions: state.includeFilters ? { brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } : undefined } });
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/health/ready") { state.probes++; return route.fulfill({ status: state.probeOk ? 200 : 503, json: { status: state.probeOk ? "ready" : "unavailable" } }); }
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId, organizationDisplayName: "Клиника", capabilities: ["BUYER"] } });
    if (path === "/auth/current") return route.fulfill({ json: null });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: cityId, nameRu: "Алматы" }] });
    if (path === "/organizations/current/profile") return route.fulfill({ json: { profile: { deliveryAddress: { cityId } } } });
    if (path.includes("/compare")) return route.fulfill({ status: state.compareFail ? 503 : 200, json: { offers: [{ offerId: "offer", supplier: offer.supplier, price: { amountMinor: "120000", currency: "KZT" }, packaging: offer.packaging, availability: [{ quantityAvailable: "10" }], delivery: [], markers: {}, minimumOrderQuantity: "1", orderIncrement: "1" }] } });
    if (path === `/buyers/${organizationId}/carts`) return route.fulfill({ json: [{ id: "cart", status: "ACTIVE", currency: "KZT" }] });
    if (path === "/carts/cart/items") {
      state.writes++;
      if (state.add === "unknown") return route.abort("failed");
      return route.fulfill({ status: state.add === "failure" ? 409 : 200, json: state.add === "failure" ? { message: "Недостаточно товара" } : { id: "item" } });
    }
    if (path === "/catalog/categories") return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], total: 0, unreadCount: 0, hasMore: false, nextCursor: null } });
  });
  return state;
}

for (const width of [390, 1440]) {
  test(`state cards catalog success, rejection, unknown result and modal close ${width}`, async ({ page }, info) => {
    const state = await fixture(page);
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Выбрать поставщика: Тестовый товар 0", exact: true }).click();
    const dialog = page.getByRole("dialog"), add = dialog.getByRole("button", { name: "В корзину", exact: true });
    await add.click(); const toast = page.locator(".dm-save-toast");
    await expect(toast).toContainText("Добавлено в корзину"); await expect(toast).toContainText("Тестовый товар 0");
    await expect(toast).toHaveCSS("background-color", "rgb(0, 122, 89)");
    await toast.getByRole("button", { name: "Закрыть уведомление" }).click(); await expect(toast).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Перейти в корзину" })).toHaveAttribute("href", "/clinic/cart");
    state.add = "failure"; await add.click(); await expect(toast).toContainText("Недостаточно товара"); await expect(toast).toHaveAttribute("data-tone", "error");
    state.add = "unknown"; await add.click(); await expect(toast).toContainText("Результат пока неизвестен");
    await expect(toast).toHaveCSS("background-color", "rgb(244, 197, 66)"); await expect(toast).toHaveCSS("color", "rgb(23, 32, 30)");
    await expect(dialog.getByRole("spinbutton")).toHaveValue("1"); expect(state.writes).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`unknown-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Tab"); await toast.getByRole("button", { name: "Закрыть уведомление" }).focus(); await page.keyboard.press("Enter");
    await expect(toast).toHaveCount(0); await expect(add).toBeFocused();
  });

  test(`state cards network deduplication, five seconds and verified recovery ${width}`, async ({ page, context }, info) => {
    const state = await fixture(page); await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/catalog"); await expect(page.getByTestId("product-card")).toHaveCount(24);
    await page.clock.install(); await context.setOffline(true);
    const toast = page.locator(".dm-save-toast"); await expect(toast).toContainText("Нет подключения к сети");
    await page.screenshot({ path: info.outputPath(`offline-${width}.png`), animations: "disabled" });
    await page.clock.runFor(4000); await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.clock.runFor(1300); await expect(toast).toHaveCount(0); await expect(page.locator(".dm-connection-status")).toContainText("Нет подключения");
    await context.setOffline(false); await expect.poll(() => state.probes).toBe(1); await expect(page.locator(".dm-connection-status")).toContainText("пока не восстановлена");
    await expect(toast).toHaveCount(0); state.probeOk = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(toast).toContainText("Связь восстановлена");
    await expect(page.locator(".dm-connection-status")).toHaveCount(0); await page.clock.runFor(5300); await expect(toast).toHaveCount(0);
  });
}

test("state cards catalog failures retain retry and already loaded products", async ({ page }) => {
  const state = await fixture(page); state.firstFail = true;
  await page.goto("/catalog"); const toast = page.locator(".dm-save-toast"); await expect(toast).toContainText("Не удалось загрузить каталог");
  await toast.getByRole("button", { name: "Закрыть уведомление" }).click();
  state.firstFail = false; await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click(); await expect(page.getByTestId("product-card")).toHaveCount(24);
  state.moreFail = true; await page.getByRole("button", { name: "Показать ещё", exact: true }).click(); await expect(toast).toContainText("Не удалось загрузить ещё товары");
  await expect(page.getByTestId("product-card")).toHaveCount(24);
  state.moreFail = false; await page.getByRole("button", { name: "Повторить загрузку товаров" }).click(); await expect(page.getByTestId("product-card")).toHaveCount(25);
  state.compareFail = true; await page.getByRole("button", { name: "Выбрать поставщика: Тестовый товар 0", exact: true }).click();
  await expect(toast).toContainText("Предложения недоступны"); await toast.getByRole("button", { name: "Закрыть уведомление" }).click();
  state.compareFail = false; await page.getByRole("dialog").getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "В корзину", exact: true })).toBeEnabled();
});

test("state cards filter retry and offline notice remain accessible in an open dialog", async ({ page, context }) => {
  const state = await fixture(page); state.includeFilters = false;
  await page.goto("/catalog"); await expect(page.getByTestId("product-card")).toHaveCount(24);
  state.filterFail = true;
  await page.getByRole("button", { name: "Все фильтры", exact: true }).click();
  const toast = page.locator(".dm-save-toast"), dialog = page.getByRole("dialog");
  await expect(toast).toContainText("Не удалось загрузить фильтры");
  await toast.getByRole("button", { name: "Закрыть уведомление" }).click();
  state.filterFail = false; state.includeFilters = true;
  await dialog.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Повторить", exact: true })).toHaveCount(0);
  await context.setOffline(true); await expect(toast).toContainText("Нет подключения к сети");
  await page.keyboard.press("Tab"); await toast.getByRole("button", { name: "Закрыть уведомление" }).focus(); await page.keyboard.press("Enter");
  await expect(toast).toHaveCount(0); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await context.setOffline(false);
});
