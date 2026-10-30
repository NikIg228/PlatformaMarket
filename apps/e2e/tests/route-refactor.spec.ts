import { expect, test } from "@playwright/test";

const productId = "a88f8867-9a19-4703-aadf-e40ca4487b9b";
const cityId = "33333333-3333-4333-8333-333333333333";

test.beforeEach(async ({ page }) => {
  await page.route(/\/(?:api\/|catalog-search(?:\?|$))/, async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (route.request().method() !== "GET") throw new Error(`Unexpected write: ${path}`);
    if (path === "/auth/current" || path === "/auth/personal-current") return route.fulfill({ json: null });
    if (path === "/auth/workspaces") return route.fulfill({ json: [] });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: cityId, nameRu: "Алматы", region: { nameRu: "Алматы" } }] });
    if (path.endsWith("/compare")) {
      if (process.env.REFACTOR_SSR_FIXTURE !== "1") throw new Error("Isolated SSR fixture required");
      return route.continue();
    }
    if (path.endsWith("/catalog-search")) return route.fulfill({ json: { items: [{ id: productId, name: "Filtek Ultimate", brand: "Solventum", manufacturer: "Solventum", categories: [], attributes: [], media: [], isAvailable: true, minNormalizedPriceMinor: null, offers: [] }], total: 1, nextOffset: 1, facets: { categories: [], suppliers: [] }, filterOptions: { categories: [], brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } } });
    return route.fulfill({ status: 503, json: { message: "Explicit route fixture unavailable" } });
  });
});

for (const width of [1440, 390]) test(`public and auth route wrappers retain navigation and forms ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 950 });
  await page.goto("/catalog");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(page.locator("footer")).toContainText("PlatformaMarket");
  await expect(page.getByRole("link", { name: "Войти", exact: true })).toHaveAttribute("href", "/login?returnTo=%2Fcatalog");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: info.outputPath(`catalog-refactor-${width}.png`), fullPage: true });
  for (const route of ["/about", "/suppliers", "/legal/privacy", "/legal/terms"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/register?role=BUYER&returnTo=%2Fcatalog");
  const owner = page.getByRole("textbox", { name: "ФИО владельца" });
  await owner.fill("Проверка маршрута");
  await owner.press("Tab");
  await expect(page.getByRole("textbox", { name: "Рабочий email" })).toBeFocused();
  await expect(owner).toHaveValue("Проверка маршрута");
  await page.goto("/register/resume");
  await expect(page.getByRole("heading", { name: "Продолжить регистрацию" })).toBeVisible();
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Сохранить|Изменить/ })).toBeDisabled();
});

test("product route retains server metadata, deep link and client selection", async ({ page }, info) => {
  test.skip(process.env.REFACTOR_SSR_FIXTURE !== "1", "Requires Next INTERNAL_API_URL pointing to the read-only local comparison fixture");
  const returnTo = `/catalog?q=Filtek&deliveryCityId=${cityId}`;
  await page.goto(`/products/${productId}?${new URLSearchParams({ returnTo })}`);
  await expect(page).toHaveTitle(/Filtek Ultimate.*PlatformaMarket/);
  await expect(page.getByRole("heading", { level: 1, name: /Filtek Ultimate/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Навигация по каталогу" }).getByRole("link", { name: "← Каталог", exact: true })).toHaveAttribute("href", returnTo);
  await page.getByRole("button", { name: "A3", exact: true }).click();
  await expect(page).toHaveURL(/variant=55555555-5555-4555-8555-555555555555/);
  await page.reload();
  await expect(page.getByRole("button", { name: "A3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("product-refactor.png"), fullPage: true });
});
