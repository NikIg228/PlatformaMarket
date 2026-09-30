import { test, expect, type Page } from "@playwright/test";

const organizationId = "11111111-1111-4111-8111-111111111111";
const candidate = { id: "33333333-3333-4333-8333-333333333333", proposedName: "Тестовая насадка", proposedSku: "SKU-1", proposedGtin: null, proposedBrand: "Тестовый бренд", status: "REJECTED", rejectionReason: "Уточните упаковку", approvedProductId: null, approvedVariantId: null, createdAt: "2026-09-29T09:00:00.000Z", decidedAt: "2026-09-30T09:00:00.000Z" };
async function fixture(page: Page, permissions = ["catalog.offer.edit", "catalog.product.view", "inventory.view", "inventory.freshness.manage", "import.manage"]) {
  const state = { fail: false, submitted: false, unexpected: [] as string[], writes: [] as unknown[], reads: [] as string[] };
  await page.addInitScript(({ organizationId }) => { sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify({ capability: "SUPPLIER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "ui-fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000 })); }, { organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, "");
    state.reads.push(path);
    let body: unknown;
    if (path === "/auth/workspace-context") body = { organizationId, organizationDisplayName: "Тестовый поставщик", capabilities: ["SUPPLIER"] };
    else if (path === "/auth/current") body = null;
    else if (path === "/access-control/permissions") body = permissions;
    else if (path === "/moderation/product-candidates/submissions") {
      if (state.fail) return route.fulfill({ status: 503, json: { code: "UNAVAILABLE", message: "Сервис недоступен" } });
      if (request.method() === "POST") { state.writes.push(request.postDataJSON()); state.submitted = true; body = { candidate: { ...candidate, id: "44444444-4444-4444-8444-444444444444", status: "PENDING" }, duplicateSuggestions: [] }; }
      else body = { items: [candidate, ...(state.submitted ? [{ ...candidate, id: "44444444-4444-4444-8444-444444444444", status: "PENDING", rejectionReason: null }] : [])], nextCursor: null };
    } else if (path === `/suppliers/${organizationId}/inventory/balances`) body = [{ id: "balance", offerId: null, quantityOnHand: "10", quantityAvailable: "8", quantityReserved: "2", safetyStock: "0", freshnessStatus: "FRESH", updatedAt: candidate.createdAt, warehouse: { name: "Основной склад" }, productVariant: { product: { canonicalName: "Тестовая насадка" } }, lots: [{ id: "lot", lotNumber: "LOT-7", status: "AVAILABLE", quantityAvailable: "8", expirationDate: "2027-09-30T00:00:00.000Z" }], reservations: [{ id: "reserve", quantity: "2", expiresAt: "2026-10-01T10:00:00.000Z" }] }];
    else if (path === `/suppliers/${organizationId}/inventory/overrides` || path === `/suppliers/${organizationId}/offers` || path === "/moderation/product-corrections") body = [];
    else if (["/workspaces/supplier/offers", "/workspaces/supplier/correction-offers", "/workspaces/supplier/inventory-overrides"].includes(path)) body = { items: [], nextCursor: null };
    else if (path === "/workspaces/supplier/inventory") body = { items: [{ id: "balance", offerId: null, quantityOnHand: "10", quantityAvailable: "8", quantityReserved: "2", safetyStock: "0", freshnessStatus: "FRESH", updatedAt: candidate.createdAt, warehouse: { name: "Основной склад" }, productVariant: { product: { canonicalName: "Тестовая насадка" } } }], nextCursor: null };
    else if (path === "/workspaces/supplier/inventory/balance/lots") body = { items: [{ id: "lot", lotNumber: "LOT-7", status: "AVAILABLE", quantityAvailable: "8", expirationDate: "2027-09-30T00:00:00.000Z" }], nextCursor: null };
    else if (path === `/suppliers/${organizationId}/data-sources`) body = [{ id: "source", name: "Основной прайс", type: "CSV", status: "ACTIVE" }];
    else { state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: `Unexpected fixture path ${path}` } }); }
    return route.fulfill({ json: body });
  });
  return state;
}
for (const width of [1440, 390]) test(`supplier restored functions and rejected proposal retry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await fixture(page);
  await page.goto("/supplier/products/proposals");
  await expect(page.getByRole("heading", { name: "Заявки на новые товары", exact: true }).first()).toBeVisible();
  await page.getByText("Тестовая насадка", { exact: true }).click();
  await expect(page.getByText(/Артикул: SKU-1/)).toBeVisible();
  await page.getByRole("button", { name: "Исправить и подать заново" }).click();
  await expect(page.getByRole("textbox", { name: "Товар, артикул или штрихкод" })).toHaveValue("Тестовая насадка");
  await page.getByRole("textbox", { name: "Описание, упаковка и ссылка на материалы" }).fill("Упаковка 10 штук, исправленные сведения");
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  await expect(page.getByText("На проверке", { exact: true })).toBeVisible();
  expect(state.writes).toEqual([{ proposedName: candidate.proposedName, proposedSku: "SKU-1", proposedBrand: candidate.proposedBrand, proposedGtin: null, rawSubmission: { description: "Упаковка 10 штук, исправленные сведения" } }]);
  await expect(page.getByRole("cell", { name: /Отклонено: Уточните упаковку/ })).toBeVisible();
  await page.getByRole("link", { name: "Партии и резервы", exact: true }).click();
  await page.getByRole("button", { name: "Показать партии", exact: true }).click();
  await expect(page.getByRole("cell", { name: /LOT-7/ })).toBeVisible();
  await expect(page.getByText("10 / 8 / 2", { exact: false })).toBeVisible();
  await page.goBack();
  await expect(page.getByText("На проверке", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Исправления карточек", exact: true }).click();
  await expect(page.getByText("Нет доступных карточек", { exact: true })).toBeVisible();
  await page.goto("/supplier/settings/sources");
  await expect(page.getByText(/Основной прайс/)).toBeVisible();
  await page.getByRole("link", { name: "Загрузить прайс", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Импорт товаров", exact: true })).toBeVisible();
  expect(state.unexpected).toEqual([]);
  await page.screenshot({ path: `../../outputs/workspace-audit-a07-import-${width}.png`, fullPage: true });
});
test("supplier new routes enforce capabilities and recover a list failure", async ({ page }) => {
  const limited = await fixture(page, []);
  await page.goto("/supplier/products/proposals");
  await expect(page.getByText(/Этот раздел недоступен вашей роли/)).toBeVisible();
  expect(limited.reads).not.toContain("/moderation/product-candidates/submissions");
  await page.unroute("**/api/**");
  const full = await fixture(page); full.fail = true;
  await page.reload();
  await expect(page.getByText(/Сервис недоступен/)).toBeVisible();
  full.fail = false;
  await page.getByRole("button", { name: "Обновить мои заявки" }).click();
  await expect(page.getByRole("cell", { name: /Отклонено: Уточните упаковку/ })).toBeVisible();
  expect(full.unexpected).toEqual([]);
});

test("A09 minimal role cannot activate import or creation", async ({ page }) => {
  const state = await fixture(page, ["catalog.product.view"]);
  await page.goto("/supplier/products");
  await expect(page.getByRole("button", { name: "Добавить товар", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Загрузить из файла", exact: true })).toBeDisabled();
  await page.goto("/supplier/products?editor=import");
  await expect(page.getByText(/Этот раздел недоступен вашей роли/)).toBeVisible();
  expect(state.reads).not.toContain(`/suppliers/${organizationId}/data-sources`);
  expect(state.writes).toEqual([]);
});

test("A09 revocation and server 403 preserve the proposal draft", async ({ page }) => {
  const permissions = ["catalog.product.view", "catalog.offer.edit"];
  await fixture(page, permissions);
  await page.goto("/supplier/products");
  await page.getByRole("button", { name: "Добавить товар", exact: true }).click();
  await page.getByRole("textbox", { name: "Товар, артикул или штрихкод" }).fill("Сохранённый черновик");
  await page.getByRole("button", { name: "Нет нужного товара — заявка модератору" }).click();
  const description = page.getByRole("textbox", { name: "Описание, упаковка и ссылка на материалы" });
  await description.fill("Данные сотрудника остаются в форме");
  await page.route("**/api/moderation/product-candidates/submissions", route => route.fulfill({ status: 403, json: { code: "FORBIDDEN", message: "Нет права отправить заявку" } }));
  await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  await expect(page.getByText("Нет права отправить заявку", { exact: true })).toBeVisible();
  let unavailable = true;
  await page.route("**/api/access-control/permissions", route => unavailable
    ? route.fulfill({ status: 503, json: { message: "Проверка прав недоступна" } })
    : route.fulfill({ json: ["catalog.product.view", "catalog.offer.edit"] }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Повторить проверку прав", exact: true })).toBeVisible();
  await expect(description).toHaveValue("Данные сотрудника остаются в форме");
  unavailable = false;
  await page.getByRole("button", { name: "Повторить проверку прав", exact: true }).click();
  await expect(page.getByRole("button", { name: "Отправить заявку", exact: true })).toBeEnabled();
  await page.unroute("**/api/access-control/permissions");
  await expect(description).toHaveValue("Данные сотрудника остаются в форме");
  permissions.splice(permissions.indexOf("catalog.offer.edit"), 1);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Отправить заявку", exact: true })).toBeDisabled();
  await expect(description).toHaveValue("Данные сотрудника остаются в форме");
  await expect(page.getByText("Нет права отправить заявку", { exact: true })).toBeVisible();
});
