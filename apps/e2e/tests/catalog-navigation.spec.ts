import { expect, test } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";
const base = "http://127.0.0.1:3001";

for (const width of [1280, 390]) test(`catalog navigation, categories and sticky panels ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(base + "/catalog?sort=PRICE_ASC");
  const cards = page.getByTestId("product-card"); await expect(cards).toHaveCount(24);
  const header = page.locator("header").first();
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(72);
  await expect(header.getByRole("search")).toHaveCount(0);
  const search = page.getByRole("combobox", { name: "Поиск по каталогу" });
  await search.click(); await expect(search).toHaveCSS("outline-style", "none");
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(search).toHaveCSS("outline-style", "solid");
  await search.fill("EQUIA"); await expect(page.getByRole("option").first()).toBeVisible(); await search.press("Escape");
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  const nav = page.getByRole("navigation", { name: "Крупные категории" });
  const buttons = nav.locator('button[aria-pressed]');
  expect(await buttons.count()).toBeGreaterThan(1);
  const category = width < 768 ? buttons.nth(1) : nav.locator('button[aria-pressed]:visible').nth(1);
  await category.click(); await expect(page).toHaveURL(/categoryId=/);
  await expect(category).toHaveAttribute("aria-pressed", "true");
  if (width >= 768) {
    const sidebar = page.getByRole("complementary", { name: "Фильтры каталога" });
    await expect(sidebar.getByRole("combobox", { name: "Категория", exact: true })).not.toHaveValue("");
  }
  await nav.getByRole("button", { name: "Все товары", exact: true }).click(); await expect(cards).toHaveCount(24);
  if (width >= 1280) {
    const positions = await cards.evaluateAll(nodes => nodes.slice(0, 5).map(n => n.getBoundingClientRect().y));
    expect(new Set(positions.slice(0,4)).size).toBe(1); expect(positions[4]).toBeGreaterThan(positions[0]);
  }
  await page.getByRole("button", { name: "Показать ещё" }).click(); await expect(cards).toHaveCount(48);
  await cards.first().getByRole("link").click(); await page.getByRole("link", { name: "← Вернуться в каталог" }).click(); await expect(cards).toHaveCount(48);
  await page.evaluate(() => window.scrollTo(0, 650));
  expect((await header.boundingBox())!.y).toBe(0);
  if (width >= 768) {
    const box = (await page.getByRole("complementary", { name: "Фильтры каталога" }).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual((await header.boundingBox())!.height); expect(box.y).toBeLessThan(100);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  } else {
    await page.getByRole("button", { name: /^Фильтры/ }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox", { name: "Наличие", exact: true }).selectOption("true");
    await expect(page).toHaveURL(/inStock=true/); await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Показать товары" }).click(); await expect(dialog).toHaveCount(0);
  }
  await header.locator("summary").first().click();
  await header.getByRole("combobox", { name: "Город доставки", exact: true }).click();
  await expect(header.getByRole("option").first()).toBeVisible();
  const dropdown = (await header.getByRole("listbox").boundingBox())!; expect(dropdown.y + dropdown.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`navigation-${width}.png`) });
});

test("clinic account remains accessible in the compact header", async ({ page }) => {
  const fixture = await installPilotWorkspace(page, "BUYER");
  try {
    await page.goto(base + "/catalog");
    await page.locator("header summary").filter({ hasText: "Личный кабинет" }).click();
    await expect(page.getByRole("link", { name: "Открыть личный кабинет", exact: true })).toBeVisible();
  } finally { await fixture.dispose(); }
});

for (const [name, url] of [["landing", "http://127.0.0.1:3003/login"], ["operator", "http://127.0.0.1:3000/login"]]) test(`${name} shared input modality`, async ({ page }) => {
  // Render the existing local operator form without enabling server-side login.
  // This test checks its controls only; it never submits credentials.
  if (name === "operator") await page.route("**/auth/client-options", route => route.fulfill({ json: { localOperatorPasswordEnabled: true, emailDelivery: "LOCAL_FILE" } }));
  await page.goto(url);
  const input = page.locator('input:not([type="hidden"])').first();
  await expect(input).toBeVisible(); await input.click(); await expect(input).toHaveCSS("outline-style", "none");
  await input.pressSequentially("text"); await expect(input).toHaveCSS("outline-style", "none");
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(input).toHaveCSS("outline-style", "none");
  await expect(input.locator("xpath=.." )).toHaveCSS("outline-width", "1px");
  await input.click(); await expect(input).toHaveCSS("outline-style", "none");
});
