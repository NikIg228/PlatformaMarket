import { test, expect } from "@playwright/test";
import { productFixture, noOverflow, sampleOffer, id, warehouseId } from "./supplier-products.fixture";

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const width of [1920, 390]) test(`refinement empty pages share search and compact filters ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const state = await productFixture(page); state.submissions = []; state.promotions = [];
  const routes = [
    ["new", "Товар, артикул или штрихкод"], ["import", ""], ["proposals", "Найти заявку"],
    ["new?request=1", ""], ["corrections", "Поиск исправления"], ["inventory", "Поиск товара"],
    ["promotions", "Поиск акций"], ["promotions?mode=new", "Поиск: Товар акции"],
  ];
  for (const [route, label] of routes) {
    await page.goto(`/supplier/products/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("list", { name: /Этапы|Путь акции/ })).toHaveCount(0);
    if (label) {
      const input = page.getByRole("textbox", { name: label, exact: true });
      await expect(input).toBeVisible(); await expect(input).toHaveAttribute("placeholder", /^Найти /);
      await expect(page.getByRole("button", { name: "Найти", exact: true })).toHaveCount(0);
      const field = input.locator("xpath=..");
      if (width === 1920) expect(Math.round((await field.boundingBox())!.width)).toBe(440);
      await input.fill("Материал");
      const button = field.getByRole("button", { name: "Найти", exact: true });
      await expect(button).toBeVisible(); await expect(field.locator("svg")).toHaveCount(0);
      await field.getByRole("button", { name: "Очистить поиск" }).click(); await expect(input).toHaveValue("");
    }
    if (width === 1920 && ["proposals", "corrections", "promotions"].includes(route!)) {
      const search = page.getByRole("textbox").first();
      const select = page.getByRole("combobox").first();
      expect(Math.abs((await search.boundingBox())!.y - (await select.boundingBox())!.y)).toBeLessThan(8);
    }
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${route!.replace(/[?=]/g, "-")}-${width}.png`), fullPage: true });
  }
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("refinement search submits once, clears and preserves IME composition", async ({ page }) => {
  const state = await productFixture(page);
  await page.goto("/supplier/products/promotions");
  await expect(page.getByRole("table", { name: "Акции поставщика" })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Поиск акций" });
  await search.fill("Несуществующая акция");
  const before = state.reads.length;
  await search.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  expect(state.reads.length).toBe(before);
  await search.press("Enter");
  await expect.poll(() => state.reads.filter(path => path.startsWith("/promotions?") && new URL(path, "http://test").searchParams.get("q") === "Несуществующая акция").length).toBe(1);
  await expect(page.getByText("Акции не найдены", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(search).toBeFocused(); await expect(search).toHaveValue("");
  await expect.poll(() => new URL(state.reads.filter(path => path.startsWith("/promotions?")).at(-1)!, "http://test").searchParams.get("q") ?? "").toBe("");
  await expect(page.getByRole("table", { name: "Акции поставщика" })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("refinement inventory appends pages, retries and cancels stale filters", async ({ page }) => {
  await productFixture(page);
  let failMore = true, release: (() => void) | undefined;
  const reads: string[] = [];
  const balance = (name: string, index: number) => ({ ...sampleOffer.inventoryBalances[0], id: id(index), offer: { saleUnit: sampleOffer.saleUnit, packaging: sampleOffer.packaging }, warehouse: { id: warehouseId, name: "Основной склад" }, productVariant: { ...sampleOffer.productVariant, product: { ...sampleOffer.productVariant.product, canonicalName: name } }, safetyStock: "0" });
  await page.route("**/api/workspaces/supplier/inventory?**", async route => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get("q"), cursor = params.get("cursor"); reads.push(route.request().url());
    if (q === "Старый") { await new Promise<void>(resolve => { release = resolve; }); await route.fulfill({ json: { items: [balance("Старый ответ", 90)], nextCursor: null } }).catch(() => {}); return; }
    if (q === "Новый") return route.fulfill({ json: { items: [balance("Новый результат", 91)], nextCursor: null } });
    if (cursor && failMore) return route.fulfill({ status: 503, json: { message: "Продолжение временно недоступно" } });
    return route.fulfill({ json: cursor ? { items: [balance("Первая позиция", 80), balance("Последняя позиция", 81)], nextCursor: null } : { items: [balance("Первая позиция", 80)], nextCursor: "next-inventory" } });
  });
  await page.goto("/supplier/products/inventory");
  await expect(page.getByRole("cell", { name: /Первая позиция/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Повторить загрузку остатков" })).toBeVisible();
  failMore = false; await page.getByRole("button", { name: "Повторить загрузку остатков" }).click();
  await expect(page.getByRole("cell", { name: /Последняя позиция/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Первая позиция/ })).toHaveCount(1);
  const search = page.getByRole("textbox", { name: "Поиск товара" });
  await search.fill("Старый"); await search.press("Enter");
  await expect.poll(() => Boolean(release)).toBe(true);
  await search.fill("Новый"); await search.press("Enter");
  await expect(page.getByRole("cell", { name: /Новый результат/ })).toBeVisible();
  release!();
  await expect(page.getByRole("cell", { name: /Старый ответ|Первая позиция/ })).toHaveCount(0);
  expect(reads.filter(url => new URL(url).searchParams.has("cursor"))).toHaveLength(2);
});

for (const width of [1440, 390]) test(`refinement catalog search keeps suggestions and keyboard submission ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/auth/current") ? null : path.endsWith("/promotions/storefront") ? { items: [], total: 0, offset: 0, limit: 4 } : [] });
  });
  await page.route("**/catalog-search?**", route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: params.get("limit") === "6" ? { items: [{ id: id(4), name: "Композит тестовый", brand: "Бренд" }] } : { items: [], total: 0, limit: 24, offset: 0, nextOffset: null, facets: { categories: [], suppliers: [] } } });
  });
  await page.goto("/catalog");
  const input = page.getByRole("combobox", { name: "Поиск по каталогу", exact: true });
  await expect(input).toBeVisible();
  if (width === 1440) expect(Math.round((await input.locator("xpath=..").boundingBox())!.width)).toBe(440);
  await input.fill("Композит");
  await expect(page.getByRole("option", { name: /Композит тестовый/ })).toBeVisible();
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /-0$/);
  await input.press("Escape"); await expect(input).toHaveAttribute("aria-expanded", "false");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Композит");
  await page.getByRole("button", { name: "Очистить поиск", exact: true }).click();
  await expect(input).toHaveValue(""); await expect(input).toBeFocused();
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`) });
});
