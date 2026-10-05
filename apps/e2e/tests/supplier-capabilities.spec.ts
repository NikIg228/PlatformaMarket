import { test, expect, type Page } from "@playwright/test";

const organizationId = "11111111-1111-4111-8111-111111111111";
const sections = [
  ["new", "Добавить товар"], ["import", "Загрузить из файла"],
  ["proposals", "Заявки на новые товары"], ["corrections", "Исправления карточек"],
  ["inventory", "Партии и резервы"], ["promotions", "Акции поставщика"],
] as const;
async function fixture(page: Page, permissions = ["catalog.offer.edit", "catalog.product.view", "inventory.view", "import.manage", "promotion.view", "promotion.manage"]) {
  const state = { unexpected: [] as string[], writes: [] as string[], reads: [] as string[] };
  await page.addInitScript(({ organizationId }) => { sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify({ capability: "SUPPLIER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "ui-fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000 })); }, { organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, "");
    state.reads.push(path);
    if (request.method() !== "GET") state.writes.push(path);
    let body: unknown;
    if (path === "/auth/workspace-context") body = { organizationId, organizationDisplayName: "Тестовый поставщик", capabilities: ["SUPPLIER"] };
    else if (path === "/conversations") body = { items: [], hasMore: false, unreadCount: 0 };
    else if (path === "/auth/current") body = null;
    else if (path === "/access-control/permissions") body = permissions;
    else if (path === "/access-control/policy") body = { mode: "ROLE_BASED", permissions };
    else if (path === "/workspaces/supplier/offers") body = { items: [], nextCursor: null };
    else if (path === `/suppliers/${organizationId}/data-sources`) body = [{ id: "source", name: "Основной прайс", type: "CSV", status: "ACTIVE" }];
    else { state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: `Unexpected fixture path ${path}` } }); }
    return route.fulfill({ json: body });
  });
  return state;
}
for (const width of [1440, 390]) test(`six product actions navigate to empty pages at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await fixture(page);
  await page.goto("/supplier/products");
  const actions = page.getByRole("group", { name: "Действия с товарами" });
  await expect(actions.getByRole("link")).toHaveCount(6);
  await expect(actions.getByRole("button")).toHaveCount(0);
  for (const [path, title] of sections) {
    const link = actions.locator(`a[href="/supplier/products/${path}"]`);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/supplier/products/${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.locator("#workspace-content")).toHaveText(title);
    await expect(page.locator("#workspace-content form, #workspace-content table")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("#workspace-content")).toHaveText(title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${path}-${width}.png`) });
    await page.goBack();
    await expect(actions).toBeVisible();
  }
  expect(state.unexpected).toEqual([]);
  expect(state.writes).toEqual([]);
  expect(state.reads.every(path => path.startsWith("/auth/") || path.startsWith("/access-control/") || (path === "/workspaces/supplier/offers" || path === "/conversations"))).toBe(true);
});

test("empty product pages retain permission boundaries", async ({ page }) => {
  const state = await fixture(page, []);
  for (const [path] of sections) {
    await page.goto(`/supplier/products/${path}`);
    await expect(page.getByText(/Этот раздел недоступен вашей роли/)).toBeVisible();
  }
  expect(state.unexpected).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("legacy product editor URLs and sources link lead to standalone pages", async ({ page }) => {
  const state = await fixture(page);
  for (const editor of ["new", "import"]) {
    await page.goto(`/supplier/products?editor=${editor}`);
    await expect(page).toHaveURL(new RegExp(`/supplier/products/${editor}$`));
    await expect(page.locator("#workspace-content form")).toHaveCount(0);
  }
  await page.goto("/supplier/settings/sources");
  await expect(page.getByText(/Основной прайс/)).toBeVisible();
  await page.getByRole("link", { name: "Загрузить прайс", exact: true }).click();
  await expect(page).toHaveURL(/\/supplier\/products\/import$/);
  await expect(page.locator("#workspace-content")).toHaveText("Загрузить из файла");
  expect(state.unexpected).toEqual([]);
  expect(state.writes).toEqual([]);
});
test("product row editing remains inline without creation or import panels", async ({ page }) => {
  const state = await fixture(page);
  await page.route("**/api/workspaces/supplier/offers*", route => route.fulfill({ json: {
    items: [{ id: "offer-existing", supplierSku: "EXISTING", sourceType: "ERP", status: "ACTIVE",
      productVariantId: "variant-existing", productVariant: { product: { id: "product-existing", canonicalName: "Существующее предложение" } },
      prices: [], inventoryBalances: [], packaging: null, publication: null,
      baseUnitsPerSaleUnit: "1", minimumOrderQuantity: "1", orderIncrement: "1" }], nextCursor: null,
  } }));
  await page.goto("/supplier/products");
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Редактирование предложения", exact: true })).toBeVisible();
  await expect(page.getByText(/Предложение управляется интеграцией/)).toBeVisible();
  await expect(page).toHaveURL(/\/supplier\/products$/);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Редактирование предложения", exact: true })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: /Существующее предложение/ })).toBeVisible();
  expect(state.unexpected).toEqual([]);
  expect(state.writes).toEqual([]);
});