import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const media = JSON.parse(readFileSync(resolve(__dirname, "../../buyer-web/app/data/public-catalog-media.json"), "utf8")) as { entries: Record<string, { altText?: string }> };

const samples = [
  ["3M", "Clinpro White Varnish", "Лак", "50 × 0,5 мл", 2490000, 3, "уп."],
  ["3M", "RelyX Universal Resin Cement", "Цемент", "шприц 3,4 г", 3850000, 4, "шт."],
  ["NSK", "ENDO-MATE TC2", "Эндомотор", "комплект", 28900000, 2, "комплект"],
  ["Kerr", "Harmonize", "Композит", "A2 · шприц 4 г", 1250000, 3, "шприц"],
  ["VOCO", "Admira Fusion", "Композит", "A2 · шприц 3 г", 1690000, 3, "шприц"],
] as const;

for (const width of [1440, 390]) test(`catalog reference layout and navigation ${width}`, async ({ page }, info) => {
  let failed = false, empty = false;
  const items = samples.map(([brand, name, category, parameters, price, count, unit], index) => ({
    id: `reference-${index}`, name, brand, manufacturer: brand, categories: [{ id: "materials", name: category }],
    attributes: [[parameters]], media: Object.values(media.entries).filter(item => item.altText?.includes(name)).slice(0, 1),
    isAvailable: true, minNormalizedPriceMinor: null,
    offers: Array.from({ length: count }, (_, supplier) => ({ id: `offer-${index}-${supplier}`, supplier: { id: `supplier-${supplier}`, name: `Поставщик ${supplier}` }, priceMinor: String(price), currency: "KZT", available: true, packaging: { name: unit, quantityInBaseUnit: "1", unit }, normalizedPriceMinor: null, confirmationMode: "AUTO", deliveryMethods: [] })),
  }));
  await page.route("**/catalog-search?**", route => route.fulfill({ status: failed ? 503 : 200, json: failed ? {} : { items: empty ? [] : items, total: empty ? 0 : 5, nextOffset: 5, facets: { categories: [], suppliers: [] }, filterOptions: { categories: [], brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } } }));
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/current")) return route.fulfill({ json: null });
    if (path.endsWith("/catalog/cities")) return route.fulfill({ json: [{ id: "33333333-3333-4333-8333-333333333333", nameRu: "Алматы" }] });
    if (path.endsWith("/compare")) return route.fulfill({ json: { offers: [] } });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.setViewportSize({ width, height: 1050 });
  await page.goto("/catalog");
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText("3 поставщика");
  await expect(cards.first()).toContainText("В наличии");
  await expect(page.getByRole("link", { name: "Все акции" })).toHaveAttribute("href", "/promotions");
  await page.getByRole("combobox", { name: "Сортировка товаров" }).click();
  await page.getByRole("option", { name: "Сначала дешевле", exact: true }).click();
  await expect(page).toHaveURL(/sort=PRICE_ASC/);
  await expect(cards).toHaveCount(5);
  await page.getByRole("button", { name: "Все фильтры", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("button", { name: "Все фильтры", exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath(`catalog-${width}.png`), fullPage: true });
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, toolbar: getComputedStyle(document.querySelector('[aria-label="Поиск и фильтрация"]')!).position, header: getComputedStyle(document.querySelector("header")!).position }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.toolbar).toBe("sticky"); expect(dimensions.header).toBe("relative");
  await page.evaluate(() => window.scrollTo(0, 500));
  expect(await page.locator('[aria-label="Поиск и фильтрация"]').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(-1);
  await cards.first().getByRole("button", { name: /Выбрать поставщика/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(cards.first().getByRole("button")).toBeFocused();
  empty = true;
  await page.getByRole("combobox", { name: "Сортировка товаров" }).click();
  await page.getByRole("option", { name: "По названию", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
  empty = false; failed = true;
  await page.getByRole("combobox", { name: "Сортировка товаров" }).click();
  await page.getByRole("option", { name: "Сначала дороже", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Не удалось загрузить каталог", exact: true })).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await expect(cards).toHaveCount(5);
});
