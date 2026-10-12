import { expect, test } from "@playwright/test";
import type { PublicPromotion } from "@marketplace/schemas";

const campaign = (index: number): PublicPromotion => ({
  id: `campaign-${index}`, supplierOrganizationId: "11111111-1111-4111-8111-111111111111", supplierName: "Dental Supply", offerName: `Композит ${index}`, productId: `product-${index}`, giftName: null,
  temporalStatus: "ACTIVE", unitPriceMinor: "80000", baseAmountMinor: "100000", currency: "KZT",
  terms: { offerId: `offer-${index}`, name: `Материалы для реставрации ${index}`, description: "На выбранные композиты", kind: "PERCENTAGE", percentageBasisPoints: 2000, fixedAmountMinor: null, buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "1", quantityLimit: "100", startsAt: new Date(Date.now() - 86400000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString() },
});
for (const [width, columns] of [[1440, 5], [834, 3], [390, 2]]) test(`hybrid catalog and promotions ${width}`, async ({ page }, info) => {
  let fail = false, empty = false;
  let releasePromotions: () => void = () => {};
  const pendingPromotions = new Promise<void>(resolve => { releasePromotions = resolve; });
  const campaigns = Array.from({ length: 15 }, (_, i) => campaign(i));
  const products = Array.from({ length: 30 }, (_, i) => ({ id: `product-${i}`, name: `Композит ${i}`, brand: "GC", manufacturer: "GC", categories: [], media: [], attributes: [], isAvailable: true, minNormalizedPriceMinor: null, offers: [{ id: `offer-${i}`, supplier: { id: "supplier", name: "Dental Supply" }, priceMinor: "100000", currency: "KZT", available: true, packaging: { name: "Шприц", quantityInBaseUnit: "4", unit: "г" }, normalizedPriceMinor: null, confirmationMode: "AUTO", deliveryMethods: [] }] }));
  await page.route("**/catalog-search?**", route => route.fulfill({ json: { items: products, total: 30, nextOffset: 30, facets: { categories: [], suppliers: [] }, filterOptions: { categories: [], brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } } }));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (path.endsWith("/auth/current")) return route.fulfill({ json: null });
    if (path.endsWith("/catalog/cities")) return route.fulfill({ json: [] });
    if (path.endsWith("/promotions/storefront")) {
      await pendingPromotions;
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 12);
      return route.fulfill({ status: fail ? 503 : 200, json: fail ? { message: "Unavailable" } : { items: empty ? [] : campaigns.slice(offset, offset + limit), total: empty ? 0 : campaigns.length, offset, limit } });
    }
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.setViewportSize({ width, height: 1050 });
  await page.goto("/catalog?sort=NAME_ASC&count=48");
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(30);
  await expect(cards.first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Загружаем акции" })).toBeVisible();
  releasePromotions();
  const banners = page.getByRole("article", { name: /^Акция:/ });
  await expect(banners).toHaveCount(2);
  const grid = cards.first().locator("..");
  expect(await grid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(columns);
  const before = await banners.first().locator("..").evaluate(node => Array.from(node.parentElement!.children).slice(0, Array.from(node.parentElement!.children).indexOf(node)).filter(child => child.getAttribute("data-testid") === "product-card").length);
  expect(before).toBe(columns * 2);
  const trigger = banners.first().getByRole("button", { name: "Смотреть акцию" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Минимальное количество: 1");
  await expect(dialog.getByRole("link", { name: "Выбрать предложение" })).toHaveAttribute("href", /offer=offer-0/);
  const productHref = await dialog.getByRole("link", { name: "Выбрать предложение" }).getAttribute("href");
  expect(new URL(productHref!, "http://127.0.0.1:3000").searchParams.get("returnTo")).toBe("/catalog?sort=NAME_ASC&count=30");
  await dialog.press("Escape");
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`hybrid-${width}.png`), fullPage: true });
  await page.getByRole("link", { name: "Все акции" }).click();
  await expect(page.getByRole("heading", { name: "Акции", exact: true })).toBeVisible();
  await expect(banners).toHaveCount(12);
  await page.getByRole("button", { name: "Показать ещё акции" }).click();
  await expect(banners).toHaveCount(15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`promotions-${width}.png`), fullPage: true });
  fail = true;
  await page.getByRole("button", { name: "Подарки за покупку" }).click();
  await expect(page.getByRole("main", { name: "Акции" }).getByRole("alert")).toContainText("Не удалось загрузить акции");
  fail = false; empty = true;
  await page.getByRole("button", { name: "Повторить загрузку акций" }).click();
  await expect(page.getByRole("main", { name: "Акции" }).getByText("Действующих акций нет", { exact: true })).toBeVisible();
  empty = false;
  await page.getByRole("button", { name: "Все акции", exact: true }).click();
  await expect(banners).toHaveCount(12);
  fail = true;
  await page.goto("/catalog");
  await expect(cards).toHaveCount(30);
  await expect(page.getByText("Акции временно недоступны. Товары можно просматривать.")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Повторить загрузку акций" }).click();
  await expect(cards).toHaveCount(30);
  await expect(banners).toHaveCount(2);
  await page.goto("/catalog?inStock=true");
  await expect(cards).toHaveCount(30);
  await expect(banners).toHaveCount(0);
});

for (const width of [1440, 834, 390]) test(`local campaign artwork and filters ${width}`, async ({ page }, info) => {
  await page.clock.install({ time: new Date("2026-10-13T09:00:00Z") });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/current")) return route.fulfill({ json: null });
    if (path.endsWith("/promotions/storefront")) return route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 12 } });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.route("**/catalog-search?**", route => route.fulfill({ json: { items: [], total: 0, facets: { categories: [], suppliers: [] }, filterOptions: { categories: [], brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } } }));
  await page.setViewportSize({ width, height: 1050 });
  await page.goto("/promotions");
  const banners = page.getByRole("article", { name: /^Акция:/ });
  await expect(banners).toHaveCount(8);
  for (const banner of await banners.all()) {
    await banner.scrollIntoViewIfNeeded();
    await expect.poll(() => banner.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  const trigger = banners.first().getByRole("button", { name: "Смотреть акцию" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toContainText("Скидка на выбранные реставрационные материалы");
  await expect(page.getByRole("dialog").getByRole("link", { name: "Выбрать предложение" })).toHaveCount(0);
  await page.getByRole("dialog").press("Escape");
  await expect(trigger).toBeFocused();
  const computed = await trigger.evaluate(node => { const style = getComputedStyle(node); return { height: node.getBoundingClientRect().height, radius: style.borderRadius, font: style.fontFamily }; });
  expect(computed.height).toBeGreaterThanOrEqual(44);
  expect(computed.radius).toBe("8px");
  expect(computed.font).toContain("Manrope");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`artwork-${width}.png`), fullPage: true });
  await page.getByLabel("Поставщик акций", { exact: true }).selectOption("d1000000-0000-4000-8000-000000000002");
  await expect(banners).toHaveCount(3);
  await page.getByRole("button", { name: "Подарки за покупку" }).click();
  await expect(banners).toHaveCount(1);
  await expect(banners).toContainText("Перчатки");
  await page.reload();
  await expect(banners).toHaveCount(1);
  await page.getByRole("button", { name: "Скидки в сумме" }).click();
  await expect(page.getByText("Действующих акций нет", { exact: true })).toBeVisible();
});

test("catalog supplier mark keeps price and expires", async ({ page }, info) => {
  const now = new Date("2026-10-13T09:00:00Z");
  await page.clock.install({ time: now });
  const offer = { id: "offer", supplier: { id: "supplier", name: "Dental Supply" }, priceMinor: "100000", currency: "KZT", available: true, packaging: { name: "Шприц", quantityInBaseUnit: "4", unit: "г" }, normalizedPriceMinor: null, confirmationMode: "AUTO", deliveryMethods: [], promotion: { label: "Композиты", percentage: 20, endsAt: new Date(now.getTime() + 20000).toISOString() } };
  const products = [{ id: "product", name: "Композит", brand: "GC", manufacturer: "GC", categories: [], media: [], isAvailable: true, minNormalizedPriceMinor: null, offers: [offer] }];
  await page.route("**/catalog-search?**", route => route.fulfill({ json: { items: products, total: 1, nextOffset: 1, facets: { categories: [], suppliers: [] }, filterOptions: { categories: [], brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } } }));
  await page.route("**/api/**", route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/auth/current") ? null : { items: [], total: 0, offset: 0, limit: 3 } }));
  await page.setViewportSize({ width: 390, height: 1050 });
  await page.goto("/catalog");
  const card = page.getByTestId("product-card");
  await expect(card.getByText("−20% у поставщика", { exact: true })).toBeVisible();
  await expect(card).toContainText(/1\s?000/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("supplier-mark-mobile.png"), fullPage: true });
  await page.clock.fastForward(31000);
  await expect(card.getByText("−20% у поставщика", { exact: true })).toHaveCount(0);
  await expect(card).toContainText(/1\s?000/);
});
