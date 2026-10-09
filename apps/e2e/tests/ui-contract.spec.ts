import { test, expect } from "@playwright/test";
import { productFixture } from "./supplier-products.fixture";

for (const width of [1440, 390]) test(`component contract and native interactions: neutral states ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/ui-kit");
  const heading = page.getByRole("heading", { name: "Компоненты Market", exact: true });
  const secondary = page.getByRole("button", { name: "Вторичное действие" });
  const controls = [
    secondary,
    page.getByRole("button", { name: "Контурный вариант" }),
    page.getByRole("link", { name: "Перейти к полям" }),
    page.getByRole("textbox", { name: "Организация", exact: true }).locator(".."),
    page.getByRole("textbox", { name: "Комментарий" }).locator(".."),
    page.getByRole("combobox", { name: "Нативная форма" }).locator(".."),
    page.getByRole("combobox", { name: "Выпадающий список" }).locator(".."),
    page.getByRole("combobox", { name: "Поиск варианта" }).locator(".."),
  ];
  for (const control of controls) {
    await heading.click();
    await expect(control).toHaveCSS("background-color", "rgb(240, 244, 242)");
    await expect(control).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await control.hover();
    await expect(control).toHaveCSS("background-color", "rgb(234, 240, 237)");
    await page.mouse.down();
    await expect(control).toHaveCSS("background-color", "rgb(228, 243, 237)");
    await expect(control).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(control).toHaveCSS("transform", "none");
    await page.mouse.move(0, 0); await page.mouse.up(); await page.keyboard.press("Escape");
  }
  const dropdown = page.getByRole("combobox", { name: "Выпадающий список" });
  await dropdown.click(); await page.mouse.move(0, 0);
  await expect(dropdown).toHaveAttribute("aria-expanded", "true");
  await expect(dropdown.locator("..")).toHaveCSS("background-color", "rgb(228, 243, 237)");
  await page.keyboard.press("Escape");
  await expect(dropdown).toBeFocused();
  const choice = page.getByRole("button", { name: "Выбрать вариант" });
  await choice.click(); await heading.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(choice).toHaveCSS("background-color", "rgb(228, 243, 237)");
  await expect(choice).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await choice.click(); await heading.click();
  await expect(choice).toHaveCSS("background-color", "rgb(240, 244, 242)");
  for (const disabled of [page.getByRole("button", { name: "Недоступно", exact: true }), page.getByRole("textbox", { name: "Недоступное поле" }).locator(".."), page.getByRole("combobox", { name: "Недоступный список" }).locator("..")]) {
    await disabled.hover();
    await expect(disabled).toHaveCSS("background-color", "rgb(238, 241, 239)");
  }
  const readonly = page.getByRole("textbox", { name: "Только чтение" });
  await readonly.hover();
  await expect(readonly.locator("..")).toHaveCSS("background-color", "rgb(240, 244, 242)");
  const invalid = page.getByRole("textbox", { name: "Поле с ошибкой" });
  await invalid.click();
  await expect(invalid.locator("..")).toHaveCSS("border-top-color", "rgb(163, 59, 53)");
  await page.keyboard.press("Tab"); await invalid.focus();
  await expect(invalid.locator("..")).toHaveCSS("outline-style", "solid");
  await expect(invalid.locator("..")).toHaveCSS("outline-width", "1px");
  await expect(invalid.locator("..")).toHaveCSS("border-top-color", "rgb(163, 59, 53)");
  await page.screenshot({ path: testInfo.outputPath(`neutral-${width}.png`), fullPage: true });
  await page.emulateMedia({ forcedColors: "active" });
  await expect(invalid.locator("..")).toHaveCSS("outline-style", "solid");
});

for (const width of [1440, 390]) test(`visual audit public auth and supplier surfaces ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await productFixture(page);
  for (const route of ["/login", "/register", "/supplier/products", "/supplier/products/new", "/supplier/products/import", "/supplier/products/proposals", "/supplier/products/inventory", "/supplier/products/promotions"]) {
    await page.goto(route);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator(".dm-button:visible, .dm-control:visible").first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${route.slice(1).replaceAll("/", "-")}-${width}.png`), fullPage: true, animations: "disabled" });
  }
  expect(state.writes).toEqual([]);
});

for (const width of [1440, 390]) test(`visual audit admin recovery surfaces ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "admin-ui-fixture" })));
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { message: "Временная ошибка: повторите загрузку" } }));
  await page.goto("/admin");
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`admin-${width}.png`), fullPage: true, animations: "disabled" });
});

for (const width of [1440, 390]) test(`component contract and native interactions ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/dev/ui-kit");
  const primary = page.getByRole("button", { name: "Основное действие", exact: true });
  await expect(primary).toBeVisible();
  await expect(primary).toHaveCSS("min-height", "44px");
  await expect(primary).toHaveCSS("border-radius", "8px");
  await expect(primary).toHaveCSS("background-color", "rgb(0, 122, 89)");
  await expect(page.getByRole("button", { name: "Компактное", exact: true })).toHaveCSS("min-height", "32px");
  await expect(page.getByRole("button", { name: "Недоступно", exact: true })).toBeDisabled();
  await primary.focus(); await page.keyboard.press("Tab");
  const secondary = page.getByRole("button", { name: "Вторичное действие" });
  await expect(secondary).toBeFocused();
  await expect(secondary).toHaveCSS("outline-width", "1px");
  await expect(secondary).toHaveCSS("outline-offset", "2px");
  await expect(secondary).toHaveCSS("box-shadow", "none");
  await page.getByRole("textbox", { name: "Организация", exact: true }).fill("Клиника — проверка" );
  await page.getByRole("combobox", { name: "Нативная форма" }).selectOption("two");
  const dropdown = page.getByRole("combobox", { name: "Выпадающий список" });
  await dropdown.click(); await page.getByRole("listbox").getByRole("option", { name: "Второй вариант" }).click();
  await expect(dropdown).toHaveText("Второй вариант");
  const combo = page.getByRole("combobox", { name: "Поиск варианта" });
  await combo.fill("Алматы"); await combo.press("ArrowDown"); await combo.press("Enter");
  await page.getByRole("checkbox", { name: "Подтверждаю выбор" }).check();
  await page.getByRole("button", { name: "Проверить форму" }).click();
  await expect(page.getByLabel("Результат формы")).toHaveText("Клиника — проверка");
  const search = page.getByRole("textbox", { name: "Поиск примеров" });
  await search.fill("Пример"); await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(search).toBeFocused(); await expect(search).toHaveValue("");
  const open = page.getByRole("button", { name: "Открыть диалог" });
  await open.click(); await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`components-${width}.png`), fullPage: true });
});
