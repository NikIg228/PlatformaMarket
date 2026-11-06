import { expect, test, type Page } from "@playwright/test";
import { comparison, productId, organizationId, cityId } from "./product-detail.fixture";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function purchaseFixture(page: Page, personal: boolean) {
  const writes: Array<Record<string, unknown>> = [];
  const state = { fail: false };
  await page.addInitScript(({ organizationId, personal }) => {
    sessionStorage.setItem("dentmarket:buyer-context", personal ? "personal" : "organization");
    sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify({ capability: "BUYER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "stock-fixture", accessTokenExpiresAt: Date.now() + 3600000 }));
  }, { organizationId, personal });
  await page.route("**/api/**", route => {
    const request = route.request(), path = new URL(request.url()).pathname.slice(4);
    if (path === "/auth/personal-current") return route.fulfill({ json: personal ? { user: { id: id(30), displayName: "Тестовый покупатель" }, sessionId: id(31), accessToken: "personal-stock-fixture", accessTokenExpiresIn: 3600, mode: "PERSONAL" } : null });
    if (path === "/auth/current") return route.fulfill({ json: null });
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId, organizationDisplayName: "Тестовая клиника", capabilities: ["BUYER"] } });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: cityId, nameRu: "Алматы" }] });
    if (path === "/organizations/current/profile") return route.fulfill({ json: { profile: { deliveryAddress: { cityId } } } });
    if (path.endsWith("/compare")) return route.fulfill({ json: { ...comparison, offers: [{ ...comparison.offers[0], offerId: id(32), supplier: { organizationId: id(33), name: "Тестовый поставщик" }, minimumOrderQuantity: "3", orderIncrement: "2" }] } });
    if (path === `/buyers/${organizationId}/carts`) return route.fulfill({ json: [{ id: id(34), status: "ACTIVE", currency: "KZT" }] });
    if (path === "/personal/carts/current") return route.fulfill({ json: { id: id(34), version: 1, ownerUserId: id(30), mode: "PERSONAL", currency: "KZT", items: [], totalAmountMinor: "0", checkoutAvailable: false } });
    if (path === `/${personal ? "personal/" : ""}carts/${id(34)}/items` && request.method() === "POST") {
      writes.push(request.postDataJSON());
      return route.fulfill({ status: state.fail ? 409 : 201, json: state.fail ? { message: "Недостаточно товара" } : { id: id(35) } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 400, json: { message: "Unexpected fixture write" } });
    return route.fulfill({ json: { items: [], total: 0, unreadCount: 0, hasMore: false, nextCursor: null } });
  });
  return { writes, state };
}

for (const personal of [false, true]) for (const width of [1440, 390]) test(`minimum offset purchase ${personal ? "personal" : "clinic"} ${width}`, async ({ page }, info) => {
  const { writes, state } = await purchaseFixture(page, personal);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/products/${productId}?deliveryCityId=${cityId}${width === 390 ? "&lang=kk" : ""}`);
  const row = page.getByRole("article", { name: "Предложение: Тестовый поставщик", exact: true });
  const quantity = row.getByRole("spinbutton"), add = row.getByRole("button", { name: "В корзину", exact: true });
  await expect(quantity).toHaveValue("3"); await expect(add).toBeEnabled();
  await quantity.focus(); await page.keyboard.press("ArrowUp"); await expect(quantity).toHaveValue("5");
  await row.getByRole("button", { name: /Уменьшить количество/ }).click(); await expect(quantity).toHaveValue("3");
  await row.getByRole("button", { name: /Увеличить количество/ }).click(); await expect(quantity).toHaveValue("5");
  await quantity.fill("4"); await expect(quantity).toHaveAttribute("aria-invalid", "true"); await expect(add).toBeDisabled();
  await expect(row.getByRole("alert")).toContainText("с шагом 2 от минимума");
  expect(writes).toHaveLength(0);
  await quantity.fill("99"); await expect(row.getByRole("button", { name: /Увеличить количество/ })).toBeDisabled();
  await quantity.fill("100"); await expect(add).toBeDisabled();
  await quantity.fill("5"); await add.focus(); await page.keyboard.press("Enter");
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ offerId: id(32), quantity: 5, ...(personal ? { expectedVersion: 1 } : {}) });
  await expect(page.locator(".dm-save-toast")).toContainText("Добавлено в корзину");
  state.fail = true; await add.click(); await expect(page.locator(".dm-save-toast")).toContainText("Недостаточно товара");
  await expect(quantity).toHaveValue("5");
  state.fail = false; await add.click(); await expect.poll(() => writes.length).toBe(3);
  await expect(page.locator(".dm-save-toast")).toContainText("Добавлено в корзину");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(row.getByRole("button", { name: /Увеличить количество/ })).toHaveCSS("height", "44px");
  await page.screenshot({ path: info.outputPath(`quantity-${personal ? "personal" : "clinic"}-${width}.png`), animations: "disabled" });
});

for (const width of [1440, 390]) test(`operator integer and fractional quantities ${width}`, async ({ page }, info) => {
  const supplier = id(41), operator = id(40), offerId = id(42), buyer = id(43);
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.addInitScript(({ operator }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "stock-admin-fixture", sessionId: "00000000-0000-4000-8000-000000000044", user: { id: "00000000-0000-4000-8000-000000000045", displayName: "Тестовый оператор" }, activeOrganizationId: operator, expiresAt: Date.now() + 3600000 })), { operator });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname.slice(4);
    if (route.request().method() !== "GET") {
      writes.push({ path, body: route.request().postDataJSON() });
      return route.fulfill({ status: 201, json: { id: id(46), source: "BASE", amountMinor: "100", currency: "KZT" } });
    }
    if (path === "/organizations") return route.fulfill({ json: [{ id: operator, displayName: "Оператор", capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }, { id: buyer, displayName: "Тестовая клиника", capabilities: [{ capability: "BUYER" }] }] });
    if (path === "/suppliers") return route.fulfill({ json: [{ organizationId: supplier, organization: { displayName: "Тестовый поставщик" } }] });
    if (path === `/suppliers/${supplier}/offers`) return route.fulfill({ json: [{ id: offerId, productVariant: { product: { canonicalName: "Тестовое предложение" } } }] });
    if (path.startsWith(`/suppliers/${supplier}/`)) return route.fulfill({ json: [] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: new Date().toISOString() } });
    return route.fulfill({ status: 503, json: { message: "Unrelated fixture endpoint" } });
  });
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin");
  const access = page.getByRole("link", { name: "Пользователи и права", exact: true });
  if (!await access.isVisible()) await page.getByRole("button", { name: /Открыть.*меню|Открыть.*навигацию|Меню/ }).first().click();
  await access.click();
  const controls = page.locator("#supplier-controls");
  const minimum = controls.getByRole("spinbutton", { name: "От количества", exact: true });
  await minimum.fill("20"); await controls.getByRole("spinbutton", { name: "До количества", exact: true }).fill("30.5");
  const tier = controls.locator("form").filter({ has: page.getByRole("spinbutton", { name: "От количества", exact: true }) });
  await tier.getByRole("spinbutton", { name: "Цена, тиын", exact: true }).fill("100");
  await tier.getByRole("button", { name: "Добавить ступень", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({ minimumQuantity: 20, maximumQuantity: 30.5 });
  const calculation = controls.getByRole("spinbutton", { name: "Количество", exact: true });
  await calculation.fill("0.25"); await controls.getByRole("button", { name: "Рассчитать", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2); expect(writes[1].body.quantity).toBe(0.25);
  const contract = controls.locator("form").filter({ has: page.getByRole("spinbutton", { name: "Минимальное количество", exact: true }) });
  await contract.getByRole("combobox", { name: "Покупатель", exact: true }).selectOption(buyer);
  await contract.getByRole("spinbutton", { name: "Минимальное количество", exact: true }).fill("1");
  await contract.getByRole("spinbutton", { name: "Цена, тиын", exact: true }).fill("100");
  await contract.getByRole("button", { name: "Активировать договорную цену", exact: true }).click();
  await expect.poll(() => writes.length).toBe(3); expect(writes[2].body.minimumQuantity).toBe(1);
  await calculation.fill("0"); await controls.getByRole("button", { name: "Рассчитать", exact: true }).click();
  expect(await calculation.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
  expect(writes).toHaveLength(3);
  await calculation.fill("1.0000001"); await controls.getByRole("button", { name: "Рассчитать", exact: true }).click();
  expect(await calculation.evaluate((input: HTMLInputElement) => input.validity.stepMismatch)).toBe(true);
  expect(writes).toHaveLength(3);
  await calculation.fill("20"); await controls.getByRole("button", { name: "Рассчитать", exact: true }).click();
  await expect.poll(() => writes.length).toBe(4); expect(writes[3].body.quantity).toBe(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await controls.screenshot({ path: info.outputPath(`operator-quantity-${width}.png`), animations: "disabled" });
});
