import { expect, test, type Page } from "@playwright/test";
import { productId, organizationId, cityId, secondCity, variantA, variantB, comparison } from "./product-detail.fixture";

async function fixture(page: Page, signedIn = true) {
  const state = { fail: false, empty: false, unavailable: false, addFail: false, holdAdd: false, releaseAdd: () => {}, delay: false, holdSecondCity: false, secondCityRequested: false, releaseSecondCity: () => {}, writes: [] as unknown[], release: () => {}, unexpectedWrites: [] as string[] };
  if (signedIn) await page.addInitScript(({ organizationId }) => sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify({ capability: "BUYER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", actorId: organizationId, accessToken: "fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Сотрудник", organizationDisplayName: "Клиника" })), { organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (request.method() !== "GET") {
      if (path === "/carts/cart/items" && request.method() === "POST") {
        state.writes.push(request.postDataJSON());
        if (state.holdAdd) await new Promise<void>(resolve => { state.releaseAdd = resolve; });
        return route.fulfill({ status: state.addFail ? 409 : 200, json: state.addFail ? { message: "Недостаточно товара" } : { id: "item" } });
      }
      state.unexpectedWrites.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 400, json: { message: "Unexpected fixture write" } });
    }
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId, organizationDisplayName: "Клиника", capabilities: ["BUYER"] } });
    if (path === "/auth/current") return route.fulfill({ json: null });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: cityId, nameRu: "Алматы", region: { nameRu: "Алматы" } }, { id: secondCity, nameRu: "Астана", region: { nameRu: "Астана" } }] });
    if (path === "/organizations/current/profile") return route.fulfill({ json: { profile: { deliveryAddress: { cityId } } } });
    if (path.endsWith("/compare")) {
      if (state.holdSecondCity && new URL(request.url()).searchParams.get("cityId") === secondCity) {
        state.secondCityRequested = true;
        await new Promise<void>(resolve => { state.releaseSecondCity = resolve; });
        return route.fulfill({ json: { ...comparison, offers: [] } });
      }
      if (state.delay) await new Promise<void>(resolve => { state.release = resolve; });
      return route.fulfill({ status: state.fail ? 503 : 200, json: state.fail ? { message: "Временно недоступно" } : { ...comparison, offers: state.empty ? [] : comparison.offers.map(item => state.unavailable ? { ...item, availability: [] } : item) } });
    }
    if (path === `/buyers/${organizationId}/carts`) return route.fulfill({ json: [{ id: "cart", status: "ACTIVE", currency: "KZT" }] });
    return route.fulfill({ json: { items: [], total: 0, unreadCount: 0, hasMore: false, nextCursor: null } });
  });
  return state;
}
const url = `/products/${productId}?${new URLSearchParams({ returnTo: `/catalog?q=Filtek&deliveryCityId=${cityId}` })}`;

for (const width of [1440, 390]) test(`product detail selection, purchase and keyboard ${width}`, async ({ page }, info) => {
  const state = await fixture(page);
  await page.setViewportSize({ width, height: 1050 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  const rows = page.locator("#supplier-offers article");
  await expect(rows).toHaveCount(2); await expect(rows.first()).toContainText("MedDent");
  await expect(page.getByText("от 12 800 ₸", { exact: true })).toBeVisible();
  const primary = page.getByRole("link", { name: "Выбрать поставщика", exact: true });
  await expect(primary).toHaveCSS("min-height", "44px"); await expect(primary).toHaveCSS("border-radius", "8px"); await expect(primary).toHaveCSS("background-color", "rgb(0, 122, 89)");
  await expect(page.locator("h1")).toHaveCSS("font-size", width === 390 ? "24px" : "32px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`product-${width}.png`), fullPage: true });
  await page.getByLabel("Сортировка предложений").selectOption("expensive"); await expect(rows.first()).toContainText("DentalPro");
  await page.getByRole("button", { name: "A3", exact: true }).click(); await expect(rows).toHaveCount(1); await expect(rows).toContainText("Поставщик A3");
  await expect(page).toHaveURL(new RegExp(`variant=${variantB}`));
  await page.goBack(); await expect(page.getByRole("button", { name: "A2", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Фасовка", { exact: true }).selectOption({ label: "Шприц · 2 г · KZT" }); await expect(rows).toHaveCount(1); await expect(rows).toContainText("Малая фасовка");
  await page.getByLabel("Фасовка", { exact: true }).selectOption({ label: "Шприц · 4 г · KZT" });
  const row = page.getByRole("article", { name: "Предложение: MedDent", exact: true });
  await row.getByRole("button", { name: "Увеличить количество у MedDent" }).click(); await expect(row.getByRole("spinbutton")).toHaveValue("4");
  await expect(row).toContainText("51 200 ₸");
  await row.getByRole("spinbutton").fill("3"); await expect(row.getByRole("button", { name: "В корзину", exact: true })).toBeDisabled();
  await row.getByRole("spinbutton").fill("4"); await row.getByRole("button", { name: "В корзину", exact: true }).click();
  await expect(page.locator(".dm-save-toast")).toContainText("Добавлено в корзину"); expect(state.writes).toEqual([{ offerId: "offer-a", quantity: 4 }]);
  await page.locator(".dm-save-toast").getByRole("button", { name: "Закрыть уведомление" }).click();
  state.addFail = true; await row.getByRole("button", { name: "В корзину", exact: true }).click(); await expect(page.locator(".dm-save-toast")).toContainText("Недостаточно товара");
  await page.locator(".dm-save-toast").getByRole("button", { name: "Закрыть уведомление" }).click();
  await expect(row.getByRole("spinbutton")).toHaveValue("4");
  const zoom = page.getByRole("button", { name: "Увеличить фото товара" });
  await zoom.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("dialog")).toBeVisible(); await page.keyboard.press("Escape"); await expect(zoom).toBeFocused();
  await page.getByRole("tab", { name: "Описание", exact: true }).click(); await expect(page.getByRole("tabpanel")).toContainText("Описание товара");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter"); await expect(page.getByRole("tabpanel")).toContainText("Файлы документов пока не опубликованы");
  expect(state.unexpectedWrites).toEqual([]);
});

test("product detail loading, failure, retry and empty", async ({ page }) => {
  const state = await fixture(page); state.delay = true;
  await page.goto(url); await expect(page.getByText("Загружаем актуальные предложения", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "В корзину", exact: true })).toHaveCount(0);
  state.fail = true; state.delay = false; state.release();
  await expect(page.locator(".dm-save-toast")).toContainText("Не удалось загрузить предложения");
  await page.locator(".dm-save-toast").getByRole("button", { name: "Закрыть уведомление" }).click();
  await expect(page.getByRole("button", { name: "Повторить загрузку", exact: true })).toBeVisible();
  state.fail = false; state.empty = true;
  await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click(); await expect(page.locator("#supplier-offers")).toContainText("Предложений пока нет");
  await expect(page.getByRole("button", { name: "В корзину", exact: true })).toHaveCount(0); expect(state.writes).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test("product detail guest login retains exact variant and package", async ({ page }) => {
  const state = await fixture(page, false); await page.goto(url);
  await page.getByRole("button", { name: "A3", exact: true }).click();
  await page.getByRole("button", { name: "Войти и купить", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?/);
  const destination = new URL(page.url()).searchParams.get("returnTo") ?? "";
  expect(destination).toContain(variantB); expect(destination).toContain("packaging=");
  expect(state.writes).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test("product detail city changes retain selection and discard late responses", async ({ page }) => {
  const state = await fixture(page); await page.goto(url);
  await page.getByRole("button", { name: "A3", exact: true }).click();
  await expect(page.locator("#supplier-offers article")).toContainText("Поставщик A3");
  // Explicit package choice must survive the header's Next navigation too.
  await page.getByLabel("Фасовка", { exact: true }).selectOption({ label: "Шприц · 4 г · KZT" });
  const savedPackage = new URL(page.url()).searchParams.get("packaging");
  state.holdSecondCity = true;
  await page.getByLabel("Город: Алматы", { exact: true }).click();
  await page.getByRole("combobox", { name: "Город доставки", exact: true }).click();
  await page.getByRole("option", { name: "Астана", exact: true }).click();
  await expect.poll(() => state.secondCityRequested).toBe(true);
  await expect(page.locator("#supplier-offers article")).toHaveCount(0);
  await expect(page.getByText("Загружаем актуальные предложения", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Город доставки", exact: true }).click();
  await page.getByRole("option", { name: "Алматы", exact: true }).click();
  await expect(page.locator("#supplier-offers article")).toContainText("Поставщик A3");
  const lateResponse = page.waitForResponse(response => response.url().includes("/compare") && new URL(response.url()).searchParams.get("cityId") === secondCity);
  state.releaseSecondCity(); await lateResponse;
  await expect(page).toHaveURL(new RegExp(cityId));
  await expect(page.getByRole("button", { name: "A3", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("packaging")).toBe(savedPackage);
  await expect(page.locator("#supplier-offers article")).toContainText("Поставщик A3");
  state.unavailable = true; state.holdSecondCity = false; await page.reload();
  await expect(page.getByRole("button", { name: "Недоступно", exact: true })).toBeDisabled();
  await expect(page.getByText("Нет доступных предложений", { exact: true })).toBeVisible();
  expect(state.writes).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test("product detail does not duplicate a pending cart write after changing variant", async ({ page }) => {
  const state = await fixture(page); state.holdAdd = true; await page.goto(url);
  const row = page.getByRole("article", { name: "Предложение: MedDent", exact: true });
  await row.getByRole("button", { name: "В корзину", exact: true }).click(); await expect.poll(() => state.writes.length).toBe(1);
  await page.getByRole("button", { name: "A3", exact: true }).click();
  await expect(page.getByRole("button", { name: "В корзину", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "A2", exact: true }).click();
  await expect(row.getByRole("button", { name: "Добавляем…", exact: true })).toBeDisabled();
  state.releaseAdd(); await expect(page.locator(".dm-save-toast")).toContainText("Добавлено в корзину");
  await expect(row.getByRole("button", { name: "В корзину", exact: true })).toBeEnabled();
  expect(state.writes).toEqual([{ offerId: "offer-a", quantity: 2 }]); expect(state.unexpectedWrites).toEqual([]);
});
