import { expect, test, type Page } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";
let disposeWorkspace: (() => Promise<void>) | undefined;
test.afterEach(async () => { await disposeWorkspace?.(); disposeWorkspace = undefined; });

const buyerUrl = process.env.E2E_BUYER_URL ?? "http://127.0.0.1:3001";
const supplierUrl = process.env.E2E_SUPPLIER_URL ?? "http://127.0.0.1:3002";

async function clickEmptyMargin(page: Page, width: number) {
  // The heading can be covered by a legitimate popup at 390px. Use the empty
  // page margin below the header, not a covered element or a forced click.
  if (width === 390) await page.touchscreen.tap(2, 700);
  else await page.mouse.click(2, 700);
}

// Browser-local fixtures only: these regressions never write organization data.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("dentmarket:search-history", JSON.stringify(["расходные материалы", "инструменты"]));
    localStorage.setItem("dentmarket:city", JSON.stringify({ id: null, name: "Алматы" }));
  });
});

for (const width of [1280, 390]) {
  test.describe(`dropdown dismissal at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: width === 390 });

    test("public catalog ignores stale city and closes the new city menu", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("dentmarket:city", JSON.stringify({ id: "retired-city", name: "Алматы" })));
      const request = page.waitForRequest(r => r.url().includes("/catalog-search?"));
      await page.goto(buyerUrl);
      expect(new URL((await request).url()).searchParams.has("cityId")).toBe(false);
      await expect(page.getByRole("heading", { name: "Каталог для стоматологий" })).toBeVisible();
      await expect(page.getByLabel("Выберите город", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: "Поиск по каталогу" })).toBeVisible();
      const city = page.locator('header summary[aria-label="Город"]');
      await city.click();
      await expect(page.getByLabel("Город доставки", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByLabel("Город доставки", { exact: true })).toBeHidden();
      await city.click();
      await clickEmptyMargin(page, width);
      await expect(page.getByLabel("Город доставки", { exact: true })).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Популярные категории" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Фильтры", exact: true })).toBeVisible();
    });
    test("supplier Fluent menu keeps outside and Escape dismissal", async ({ page }) => {
      const workspace = await installPilotWorkspace(page, "SUPPLIER"); disposeWorkspace = workspace.dispose;
      await page.goto(supplierUrl);
      await expect(page.getByRole("heading", { name: `Добрый день, ${workspace.displayName}` })).toBeVisible();
      const trigger = page.getByRole("button", { name: "Ещё", exact: true });
      if (width === 390) await trigger.tap();
      else await trigger.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await clickEmptyMargin(page, width);
      await expect(menu).toBeHidden();
      if (width === 390) await trigger.tap();
      else await trigger.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  });
}
