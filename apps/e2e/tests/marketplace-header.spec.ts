import { expect, test } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";
const base = "http://127.0.0.1:3001";
for (const width of [1280, 390]) test(`header guest search, city and product return at ${width}`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => localStorage.setItem("dentmarket:city", JSON.stringify({ id: "obsolete", name: "Алматы" })));
  const cities = await (await request.get("http://127.0.0.1:4012/api/catalog/cities")).json();
  const city = cities.find((c: { nameRu: string }) => c.nameRu === "Алматы");
  await page.goto(base + "/catalog?sort=PRICE_ASC");
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
  await expect(header.getByRole("img", { name: "Platforma Market", exact: true })).toBeVisible();
  await header.locator('summary[aria-label="Город"]').click();
  await expect(header.getByRole("alert")).toContainText("Выберите город заново");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  const unfiltered = page.waitForRequest(r => r.url().includes("/catalog-search?") && !new URL(r.url()).searchParams.has("cityId"));
  await header.getByRole("combobox", { name: "Город доставки", exact: true }).click();
  await header.getByRole("option", { name: "Алматы", exact: true }).click();
  await unfiltered; await expect(page).toHaveURL(/deliveryCityId=/);
  await header.locator('summary[aria-label="Город: Алматы"]').click();
  const filtered = page.waitForRequest(r => r.url().includes("/catalog-search?") && new URL(r.url()).searchParams.get("cityId") === city.id);
  await header.getByLabel("Доступно в выбранном городе").check(); await filtered;
  const input = page.getByRole("combobox", { name: "Поиск по каталогу" });
  await input.click();
  await expect(input).toHaveCSS("outline-style", "none");
  await input.press("Shift+Tab"); await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS("outline-style", "solid");
  await input.fill("EQUIA");
  await expect(page.getByRole("search").getByRole("option").first()).toContainText("EQUIA");
  await input.press("Escape"); await expect(input).toHaveValue("EQUIA"); await expect(page.getByRole("search").getByRole("listbox")).toHaveCount(0);
  await input.press("Enter"); await expect(page).toHaveURL(/q=EQUIA/);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("PRICE_ASC");
  const before = page.url();
  await page.getByTestId("product-card").first().getByRole("link", { name: /Открыть карточку/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("EQUIA");
  await page.getByRole("link", { name: "← Вернуться в каталог" }).click();
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  // Query ordering is canonicalized during hydration; all values must survive.
  await expect(page).toHaveURL(url => url.pathname === new URL(before).pathname && JSON.stringify([...url.searchParams].sort()) === JSON.stringify([...new URL(before).searchParams].sort()));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`header-${width}.png`) });
});
test("suggestions ignore delayed responses, distinguish errors and open the selected product", async ({ page }) => {
  await page.goto(base + "/catalog");
  let release!: () => void; let seen!: () => void;
  const held = new Promise<void>(r => release = r), started = new Promise<void>(r => seen = r);
  await page.route("**/catalog-search?**", async route => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "old") { seen(); await held; await route.fulfill({ json: { items: [{ id: "old", name: "Old response", brand: null }] } }).catch(() => {}); return; }
    if (q === "failed") { await route.fulfill({ status: 503, json: {} }); return; }
    if (q === "empty") { await route.fulfill({ json: { items: [] } }); return; }
    await route.continue();
  });
  const input = page.getByRole("combobox", { name: "Поиск по каталогу" });
  await input.fill("old"); await started; await input.fill("EQUIA");
  await expect(page.getByRole("option").first()).toContainText("EQUIA"); release();
  await expect(page.getByText("Old response", { exact: true })).toHaveCount(0);
  await input.fill("failed"); await expect(page.getByRole("search").getByRole("alert")).toContainText("Не удалось загрузить");
  await input.fill("empty"); await expect(page.getByRole("search").getByText("Ничего не найдено", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Очистить поиск" }).click(); await expect(input).toHaveValue("");
  await input.fill("EQUIA"); await expect(page.getByRole("option").first()).toBeVisible();
  await input.press("ArrowDown"); await input.press("Enter");
  await expect(page).toHaveURL(/\/products\//); await expect(page.getByRole("heading", { level: 1 })).toContainText("EQUIA");
});
test("verified clinic uses its delivery address and server organization name", async ({ page }) => {
  const fixture = await installPilotWorkspace(page, "BUYER");
  try {
    await page.goto(base + "/catalog");
    const header = page.locator("header").first();
    const account = header.getByRole("link", { name: `${fixture.displayName} · Клиника · Личный кабинет`, exact: true });
    await expect(account).toHaveAttribute("aria-label", `${fixture.displayName} · Клиника · Личный кабинет`);
    await expect(account).toHaveText(fixture.displayName);
    await expect(account).toHaveAttribute("href", /^(?:\/clinic)?\/?(?:\?.*)?$/);
    await expect(header.getByRole("link", { name: "Войти", exact: true })).toHaveCount(0);
    await expect(header.locator("summary").first()).toHaveAttribute("aria-label", /^Город: /);
    await expect(page).toHaveURL(/deliveryCityId=/);
  } finally { await fixture.dispose(); }
});
