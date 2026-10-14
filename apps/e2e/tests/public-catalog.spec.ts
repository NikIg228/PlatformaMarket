import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { offerComparisonResponseSchema } from "@marketplace/schemas";
import { createRequire } from "node:module";
import path from "node:path";
import { installPilotWorkspace } from "../fixtures/workspace-session";

for (const width of [390, 1440]) test(`semantic palette and keyboard states ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/catalog");
  await expect(page.getByTestId("product-card")).toHaveCount(24);
  const login = page.locator("header").getByRole("link", { name: "Войти", exact: true });
  await expect(login).toHaveCSS("background-color", "rgb(0, 122, 89)");
  await login.hover();
  await expect(login).toHaveCSS("background-color", "rgb(0, 102, 75)");
  await page.mouse.down();
  await expect(login).toHaveCSS("background-color", "rgb(0, 84, 62)");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  const filters = page.getByRole("button", { name: /^Все фильтры/ });
  await filters.click();
  const dialog = page.getByRole("dialog");
  const checkbox = dialog.getByRole("checkbox", { name: "Только в наличии", exact: true });
  await checkbox.check();
  await page.mouse.move(0, 0);
  await expect(checkbox.locator("..").locator(".fui-Checkbox__indicator")).toHaveCSS("background-color", "rgb(0, 122, 89)");
  const apply = dialog.getByRole("button", { name: "Показать товары", exact: true });
  await expect(apply).toBeEnabled();
  await page.mouse.move(0, 0);
  await expect(apply).toHaveCSS("background-color", "rgb(0, 122, 89)");
  await apply.hover();
  await expect(apply).toHaveCSS("background-color", "rgb(0, 102, 75)");
  await page.mouse.down();
  await expect(apply).toHaveCSS("background-color", "rgb(0, 84, 62)");
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.keyboard.press("Tab");
  await apply.focus();
  await expect(apply).toHaveCSS("outline-color", "rgb(0, 122, 89)");
  await expect(apply).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: testInfo.outputPath(`theme-focus-${width}.png`) });
  await page.keyboard.press("Escape");
  await expect(filters).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`theme-catalog-${width}.png`) });
});

for (const width of [390, 1440]) test(`catalog comparison, login return and cart retry preserve selection ${width}`, async ({ page, baseURL }) => {
  const fixture = await installPilotWorkspace(page, "BUYER");
  const db = new PrismaClient();
  const browser = await page.context().newPage();
  let releaseWrite: (() => void) | undefined;
  await browser.setViewportSize({ width, height: 900 });
  try {
    const { passwordHash } = createRequire(__filename)(path.resolve(__dirname, "../../api/dist/src/modules/identity/password-codec.js"));
    const password = "Synthetic-catalog-password-2026!";
    await db.user.update({ where: { id: fixture.userId }, data: { passwordHash: passwordHash(password) } });
    const city = await db.city.findFirstOrThrow({ select: { id: true }, orderBy: { id: "asc" } });
    const offerId = "77777777-7777-4777-8777-777777777777";
    await browser.route("**/api/catalog/products/*/compare?*", async route => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      const comparison = offerComparisonResponseSchema.parse(await response.json());
      const source = comparison.offers[0];
      expect(source).toBeDefined();
      const availability = { warehouseId: "99999999-9999-4999-8999-999999999999", warehouse: "Тестовый склад", cityId: city.id, updatedAt: null, freshnessExpiresAt: null };
      // The same endpoint feeds the dialog and the product page after login.
      // Keep the complete contract while controlling stock, price and cart IDs.
      const offers = [
        { ...source, offerId, supplier: { ...source.supplier, name: "Поставщик А" },
          price: { ...source.price, amountMinor: "120000", normalizedPriceMinor: "12000", baseUnits: "10", currency: "KZT" },
          packaging: { ...source.packaging, name: "Упаковка", quantityInBaseUnit: "10", unit: "шт" },
          availability: [{ ...availability, quantityAvailable: "20" }], delivery: [], minimumOrderQuantity: "2", orderIncrement: "2" },
        { ...source, offerId: "88888888-8888-4888-8888-888888888888", supplier: { ...source.supplier, name: "Поставщик Б" },
          price: { ...source.price, amountMinor: "150000" }, availability: [{ ...availability, quantityAvailable: "0" }], delivery: [] },
      ];
      await route.fulfill({ response, json: offerComparisonResponseSchema.parse({ ...comparison, offers }) });
    });
    await browser.goto(`/catalog?sort=PRICE_ASC&count=48&deliveryCityId=${city.id}`);
    const cards = browser.getByTestId("product-card");
    await expect(cards).toHaveCount(48);
    const productHref = await cards.first().getByRole("link", { name: /Открыть карточку/ }).getAttribute("href");
    const open = cards.first().getByRole("button", { name: /Выбрать поставщика/ });
    await test.step("Open guest supplier offers", () => open.click());
    const dialog = browser.getByRole("dialog");
    const offer = dialog.getByRole("article", { name: "Предложение: Поставщик А", exact: true });
    await expect(dialog.getByRole("article")).toHaveCount(2);
    await expect(offer.locator(".mp-status-success")).toHaveCSS("color", "rgb(35, 122, 74)");
    await expect(offer.locator(".mp-status-success")).toHaveCSS("background-color", "rgb(238, 248, 242)");
    await expect(dialog.locator(".mp-status-warning")).toHaveCSS("color", "rgb(154, 90, 19)");
    const disabledOffer = dialog.getByRole("article", { name: "Предложение: Поставщик Б", exact: true }).getByRole("button", { name: "Под заказ" });
    await expect(disabledOffer).toBeDisabled();
    await expect(disabledOffer).toHaveCSS("background-color", "rgb(238, 241, 239)");
    await expect(disabledOffer).toHaveCSS("color", "rgb(114, 128, 120)");
    const sessionReady = browser.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/current", { timeout: 15_000 });
    await test.step("Continue to login from the selected offer", () => offer.getByRole("button", { name: "Войти и купить", exact: true }).click());
    await expect(browser).toHaveURL(/\/login\?returnTo=/);
    expect(new URL(browser.url()).searchParams.get("returnTo")).toBe(productHref);
    // Session restoration runs after hydration; do not fill an inert server-rendered form.
    await test.step("Wait for login restoration", async () => expect((await sessionReady).ok()).toBe(true));
    await expect(browser.getByRole("button", { name: "Войти", exact: true })).toBeEnabled();
    await browser.locator('input[type="email"]').fill(fixture.email);
    await browser.locator('input[type="password"]').fill(password);
    await test.step("Submit password login", () => browser.getByRole("button", { name: "Войти", exact: true }).click());
    await expect(browser).toHaveURL(new URL(productHref!, baseURL!).href);
    await browser.getByRole("navigation", { name: "Навигация по каталогу" }).getByRole("link", { name: "← Каталог", exact: true }).click();
    await expect(cards).toHaveCount(48);
    expect(new URL(browser.url()).searchParams.get("sort")).toBe("PRICE_ASC");

    const writes: unknown[] = [];
    const heldWrite = new Promise<void>(resolve => { releaseWrite = resolve; });
    await browser.route(`**/api/buyers/${fixture.organizationId}/carts`, route => route.fulfill({ json: [{ id: "cart-fixture", status: "ACTIVE", currency: "KZT" }] }));
    await browser.route("**/api/carts/cart-fixture/items", async route => {
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      writes.push(route.request().postDataJSON());
      if (writes.length === 1) await heldWrite;
      return route.fulfill(writes.length === 1
        ? { status: 409, json: { message: "Повторите добавление товара" } }
        : writes.length === 2 ? { json: { id: "item-fixture" } }
          : { status: 503, json: { message: "Сервис временно недоступен" } });
    });
    await test.step("Reopen offers after login and return", () => open.click());
    await offer.getByRole("spinbutton", { name: "Количество у Поставщик А", exact: true }).fill("6");
    await test.step("Submit the first cart write", () => offer.getByRole("button", { name: "В корзину", exact: true }).click());
    const pending = offer.getByRole("button", { name: "Добавляем…", exact: true });
    await expect(pending).toBeDisabled();
    await expect(pending).toHaveCSS("background-color", "rgb(238, 241, 239)");
    await expect.poll(() => writes.length).toBe(1);
    await pending.evaluate((button: HTMLButtonElement) => button.click());
    expect(writes).toHaveLength(1);
    releaseWrite!();
    const feedback = browser.locator(".dm-save-toast");
    await expect(feedback).toContainText("Не удалось добавить товар");
    await expect(feedback).toContainText("Повторите добавление товара");
    expect(writes).toEqual([{ offerId, quantity: 6 }]);
    await expect(offer.getByRole("spinbutton")).toHaveValue("6");
    await offer.getByRole("button", { name: "В корзину", exact: true }).click();
    await expect(feedback).toContainText("Добавлено в корзину");
    await expect(feedback).toContainText("6 ед. продажи");
    expect(writes).toEqual([{ offerId, quantity: 6 }, { offerId, quantity: 6 }]);
    await offer.getByRole("button", { name: "В корзину", exact: true }).click();
    await expect(feedback).toContainText("Результат пока неизвестен");
    await expect(feedback).toContainText("Проверьте корзину перед повторным добавлением");
    await expect(dialog.getByRole("link", { name: "Перейти в корзину" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Перейти в корзину" })).toHaveAttribute("href", "/clinic/cart");
    expect(writes).toEqual(Array.from({ length: 3 }, () => ({ offerId, quantity: 6 })));
    await expect(offer.getByRole("spinbutton")).toHaveValue("6");
    await dialog.getByRole("button", { name: "Закрыть окно", exact: true }).press("Escape");
    await expect(open).toBeFocused();
  } finally { releaseWrite?.(); await browser.close(); await fixture.dispose(); await db.$disconnect(); }
});

for (const width of [390, 1440]) test(`public catalog restores pages and filters without workspace reads ${width}`, async ({ page }) => {
  const workspaceReads: string[] = [];
  page.on("request", request => { if (/\/api\/(?:buyers\/[^/]+\/(?:carts|orders)|documents|notifications\/organizations)/.test(request.url())) workspaceReads.push(request.url()); });
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/catalog?sort=PRICE_ASC");
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(24);
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(cards).toHaveCount(48);
  await expect(page).toHaveURL(/count=48/);
  await cards.first().getByRole("link", { name: /Открыть карточку/ }).click();
  await page.getByRole("navigation", { name: "Навигация по каталогу" }).getByRole("link", { name: "← Каталог", exact: true }).click();
  await expect(cards).toHaveCount(48);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("PRICE_ASC");

  const filters = page.getByRole("button", { name: /^Все фильтры/ });
  await filters.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Только в наличии", exact: true }).check();
  expect(new URL(page.url()).searchParams.has("inStock")).toBe(false);
  await page.keyboard.press("Escape");
  await expect(filters).toBeFocused();
  await filters.click();
  await expect(dialog.getByRole("checkbox", { name: "Только в наличии" })).not.toBeChecked();
  await dialog.getByRole("combobox", { name: "Сортировка", exact: true }).selectOption("NAME_ASC");
  await dialog.getByRole("button", { name: "Показать товары", exact: true }).click();
  await expect(page).toHaveURL(/sort=NAME_ASC/);
  await expect(cards).toHaveCount(24);
  expect(new URL(page.url()).searchParams.has("count")).toBe(false);
  await page.goBack();
  await expect(cards).toHaveCount(48);
  await expect(page).toHaveURL(/sort=PRICE_ASC/);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(async () => (await page.getByLabel("Поиск и фильтрация", { exact: true }).boundingBox())?.y).toBe(0);
  expect((await page.locator("header").first().boundingBox())!.y).toBeLessThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(workspaceReads).toEqual([]);
});

test("catalog cancels obsolete search and preserves the current URL after a late response", async ({ page, request }) => {
  const response = await request.get("/catalog-search?limit=1");
  expect(response.ok()).toBe(true);
  const fixture = await response.json();
  let finishOld: (() => void) | undefined;
  let oldStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { oldStarted = resolve; });
  const released = new Promise<void>(resolve => { finishOld = resolve; });
  await page.route("**/catalog-search?**", async route => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "old") { oldStarted?.(); await released; }
    await route.fulfill({ json: { ...fixture, total: 1, items: [{ ...fixture.items[0], name: q === "old" ? "Старый ответ" : "Текущий ответ", catalogName: null }] } }).catch(() => {});
  });
  await page.goto("/catalog?q=old");
  await started;
  await page.evaluate(() => { history.pushState(history.state, "", "/catalog?q=current"); dispatchEvent(new PopStateEvent("popstate")); });
  await expect(page.getByTestId("product-card").getByRole("heading")).toHaveText("Текущий ответ");
  finishOld?.();
  await expect(page).toHaveURL(/q=current/);
  await expect(page.getByTestId("product-card").getByRole("heading")).toHaveText("Текущий ответ");
});
