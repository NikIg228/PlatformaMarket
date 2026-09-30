import { expect, test } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";
const base = "http://127.0.0.1:3001";
for (const width of [1280, 1600, 390]) test(`compact catalogue, live filters and sticky header ${width}`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(base + "/catalog?sort=PRICE_ASC");
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(24);
  const boxes = await cards.evaluateAll(nodes => nodes.slice(0, 5).map(n => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, height: b.height }; }));
  if (width >= 1280) { expect(new Set(boxes.slice(0, 4).map(b => b.y)).size).toBe(1); expect(boxes[4]!.y).toBeGreaterThan(boxes[0]!.y); expect(new Set(boxes.slice(0, 4).map(b => b.height)).size).toBe(1); await expect(page.getByRole("complementary", { name: "Фильтры каталога" })).toBeVisible(); }
  await expect(cards.first().getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "Показать ещё" }).click(); await expect(cards).toHaveCount(48);
  await cards.first().getByRole("link").click(); await expect(page).toHaveURL(/\/products\//);
  await page.getByRole("link", { name: "← Вернуться в каталог" }).click(); await expect(cards).toHaveCount(48);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("PRICE_ASC");
  await page.evaluate(() => window.scrollTo(0, 800));
  const header = page.locator("header").first();
  expect((await header.boundingBox())!.y).toBe(0);
  await header.locator("summary").first().click(); await expect(header.getByText("Город доставки", { exact: true })).toBeVisible();
  const panel = await header.getByText("Город доставки", { exact: true }).locator("..").boundingBox(); expect(panel!.y + panel!.height).toBeLessThanOrEqual(900);
  await page.keyboard.press("Escape");
  if (width < 768) { await page.getByRole("button", { name: /^Фильтры/ }).click(); await expect(page.getByRole("dialog")).toBeVisible(); }
  const surface = width < 768 ? page.getByRole("dialog") : page.getByRole("complementary", { name: "Фильтры каталога" });
  const brand = surface.getByRole("combobox", { name: "Бренд", exact: true }); const option = await brand.locator("option").nth(1).getAttribute("value"); expect(option).toBeTruthy();
  await brand.selectOption(option!);
  if (width < 768) await page.getByRole("button", { name: "Показать товары" }).click();
  await expect(page).toHaveURL(/brandId=/); await expect(cards.first()).toBeVisible();
  const filtered = await request.get(`http://127.0.0.1:4012/api/catalog/search?brandId=${option}&priceBasis=SALE_UNIT&limit=100`); expect(filtered.ok()).toBeTruthy(); const json = await filtered.json(); await expect(cards).toHaveCount(Math.min(json.total, 24));
  await page.getByRole("button", { name: "Сбросить всё", exact: true }).click(); await expect(cards).toHaveCount(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`catalog-${width}.png`), fullPage: false });
});

test("API sale price sorting, range, supplier and pagination agree", async ({ request }) => {
  const get = async (extra = "") => { const r = await request.get(`http://127.0.0.1:4012/api/catalog/search?priceBasis=SALE_UNIT&sort=PRICE_ASC&limit=100${extra}`); expect(r.ok()).toBeTruthy(); return r.json(); };
  const all = await get("&includeFilterOptions=true"); expect(all.total).toBeGreaterThan(24); expect(all.filterOptions.brands.length).toBeGreaterThan(0);
  const price = (p: any) => { const priced = p.offers.filter((o: any) => o.priceMinor !== null), available = priced.filter((o: any) => o.available); return (available.length ? available : priced).map((o: any) => BigInt(o.priceMinor)).sort((a: bigint,b: bigint) => a < b ? -1 : a > b ? 1 : 0)[0]; };
  const values = all.items.map(price).filter((v: unknown) => v !== undefined); expect(values).toEqual([...values].sort((a: bigint,b: bigint) => a < b ? -1 : a > b ? 1 : 0));
  const threshold = values[Math.floor(values.length / 2)].toString(); const range = await get(`&minSalePriceMinor=${threshold}`); expect(range.items.every((p: any) => price(p) >= BigInt(threshold))).toBe(true);
  const supplierId = all.filterOptions.suppliers[0].id; const supplier = await get(`&supplierOrganizationId=${supplierId}`); expect(supplier.items.every((p: any) => p.offers.every((o: any) => o.supplier.id === supplierId))).toBe(true);
  const first = await request.get("http://127.0.0.1:4012/api/catalog/search?priceBasis=SALE_UNIT&sort=PRICE_ASC&limit=24&offset=0"); const second = await request.get("http://127.0.0.1:4012/api/catalog/search?priceBasis=SALE_UNIT&sort=PRICE_ASC&limit=24&offset=24");
  expect([...(await first.json()).items, ...(await second.json()).items].map((p: any) => p.id)).toEqual(all.items.slice(0,48).map((p: any) => p.id));
});

test("long names and categories, missing media/SKU/price, distinct API error", async ({ page, request }) => {
  const response = await request.get("http://127.0.0.1:4012/api/catalog/search?limit=1"); expect(response.ok()).toBe(true);
  const live = await response.json(); const name = "GC EQUIA Forte HT Полное исходное наименование товара с важными отличиями оттенок A2 комплектация 100 капсул и дополнительные принадлежности";
  await page.route("**/catalog-search?**", route => route.fulfill({ json: { ...live, total: 1, items: [{ ...live.items[0], name, catalogName: null, manufacturerSku: null, media: [], offers: [], categories: [{ id: live.items[0].id, name: "Очень длинная категория стоматологических материалов" }] }] } }));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + "/catalog"); const card = page.getByTestId("product-card");
  await expect(card.getByRole("heading")).toHaveText(name); await expect(card.getByText("Фото пока нет")).toBeVisible(); await expect(card.getByText("Цена уточняется")).toBeVisible(); await expect(card.getByText(/Артикул:/)).toHaveCount(0);
  expect(await card.getByRole("heading").evaluate(el => el.scrollHeight <= el.clientHeight + 1 && getComputedStyle(el).webkitLineClamp === "none")).toBe(true);
  await card.getByRole("link").focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab"); await expect(card.getByRole("link")).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: test.info().outputPath("catalog-long-mobile.png") });
  await page.unroute("**/catalog-search?**"); await page.route("**/catalog-search?**", route => route.fulfill({ status: 503, json: { message: "Unavailable" } })); await page.reload(); await expect(page.getByRole("region", { name: "Каталог товаров" }).getByRole("alert")).toContainText("Не удалось загрузить каталог"); await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toHaveCount(0);
  await page.unroute("**/catalog-search?**"); await page.route("**/catalog-search?**", route => route.fulfill({ json: { ...live, total: 0, items: [] } })); await page.getByRole("button", { name: "Повторить загрузку" }).click(); await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
});

for (const width of [1280, 390]) test(`sticky header controls and clinic filter panel ${width}`, async ({ page }) => {
  const fixture = await installPilotWorkspace(page, "BUYER");
  try {
    await page.setViewportSize({ width, height: 844 }); await page.goto(base + "/catalog"); await expect(page.getByTestId("product-card").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 600)); const header = page.locator("header").first(); expect((await header.boundingBox())!.y).toBe(0);
    const search = page.getByRole("combobox", { name: "Поиск по каталогу" }); await search.fill("EQUIA"); await expect(page.getByRole("search").getByRole("option").first()).toBeVisible();
    const box = await page.getByRole("search").getByRole("listbox").boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(844); await search.press("Escape");
    await header.locator("summary").first().click(); await header.getByRole("combobox", { name: "Город доставки", exact: true }).click(); await expect(header.getByRole("option").first()).toBeVisible(); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    await header.locator("summary").filter({ hasText: "Личный кабинет" }).click(); await expect(header.getByRole("link", { name: "Открыть личный кабинет", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
    if (width === 390) {
      await page.getByRole("button", { name: /^Фильтры/ }).click(); const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
      await dialog.getByRole("combobox", { name: "Наличие", exact: true }).selectOption("true"); await expect(dialog).toBeVisible(); await expect(page).toHaveURL(/inStock=true/); await page.getByRole("button", { name: "Показать товары" }).click();
    }
    await page.setViewportSize({ width: width === 390 ? 1280 : 390, height: 844 }); expect((await header.boundingBox())!.y).toBe(0); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await fixture.dispose(); }
});
