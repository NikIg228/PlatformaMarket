import { expect, test } from "@playwright/test";
import { offerPromotionFixture } from "../fixtures/offer-promotion";

for (const width of [1366, 390]) test(`real promotion moderation and gift checkout at ${width}px`, async ({ page, request }, testInfo) => {
  const fixture = await offerPromotionFixture();
  const { db, supplier, buyer, operator, main, gift } = fixture;
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ supplier, buyer, operator }) => {
    sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify(supplier));
    sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify(buyer));
    sessionStorage.setItem("dentmarket_admin_session", JSON.stringify(operator));
  }, { supplier, buyer, operator });
  const name = `Подарок к покупке ${fixture.key.slice(0, 8)}`;
  try {
    await page.goto("/supplier/products/promotions");
    await expect(page.getByRole("heading", { name: "Акции поставщика", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Новая акция", exact: true })).toHaveCount(0);
    // Supplier page is intentionally empty during the owner-approved redesign.
    // Seed through the existing API so moderation and gift checkout remain covered.
    const supplierHeaders = { authorization: `Bearer ${supplier.accessToken}` };
    const created = await request.post("http://127.0.0.1:4012/api/promotions", {
      headers: supplierHeaders,
      data: { idempotencyKey: `create-${fixture.key}`, terms: {
        offerId: main.id, name, kind: "BUY_X_GET_Y", buyQuantity: "5",
        giftOfferId: gift.id, giftQuantity: "2", minimumQuantity: "1", quantityLimit: "100",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      } },
    });
    expect(created.status()).toBe(201);
    const draft = await created.json();
    const submitted = await request.post(`http://127.0.0.1:4012/api/promotions/${draft.id}/commands`, {
      headers: supplierHeaders,
      data: { action: "SUBMIT", expectedVersion: draft.version, idempotencyKey: `submit-${fixture.key}` },
    });
    expect(submitted.status()).toBe(201);
    expect((await submitted.json()).moderationStatus).toBe("PENDING");
    const p = await db.promotion.findFirstOrThrow({ where: { supplierOrganizationId: supplier.organizationId, name } });
    const denied = await request.post(`http://127.0.0.1:4012/api/promotions/${p.id}/commands`, { headers: { authorization: `Bearer ${supplier.accessToken}` }, data: { action: "APPROVE", reason: "Self approval must fail", expectedVersion: p.version, idempotencyKey: `deny-${fixture.key}` } });
    expect(denied.status()).toBe(403);
    const hidden = await request.get(`http://127.0.0.1:4012/api/promotions/storefront?q=${encodeURIComponent(name)}`);
    expect(hidden.status()).toBe(200); expect((await hidden.json()).items).toHaveLength(0);
    await page.goto("/admin?section=catalog");
    if (width < 760) await page.getByRole("combobox", { name: "Раздел админки", exact: true }).selectOption("catalog");
    else await page.getByRole("button", { name: "Каталог", exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByText(/Минимум за последние 30 дней/)).toBeVisible();
    await page.getByRole("textbox", { name: "Причина решения", exact: true }).fill("Исходная цена и подарок проверены на тестовой акции");
    await page.getByRole("button", { name: "Согласовать версию", exact: true }).click();
    await expect(page.getByRole("button", { name: "Разместить на витрине", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Разместить на витрине", exact: true }).click();
    await expect(page.getByRole("button", { name: "Снять с витрины", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`operator-${width}.png`), fullPage: true });
    await page.goto(`/promotions?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`подарок ${gift.name}`))).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Категория", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Поставщик", exact: true })).toBeVisible();
    await page.getByLabel("Механика", { exact: true }).selectOption("PERCENTAGE");
    await expect(page.getByText("Действующих акций нет", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`storefront-${width}.png`), fullPage: true });
    const headers = { authorization: `Bearer ${buyer.accessToken}` };
    const cartResponse = await request.post(`http://127.0.0.1:4012/api/buyers/${buyer.organizationId}/carts`, { headers, data: { currency: "KZT" } });
    expect(cartResponse.status()).toBe(201);
    const cart = await cartResponse.json();
    const line = await request.post(`http://127.0.0.1:4012/api/carts/${cart.id}/items`, { headers, data: { offerId: main.id, quantity: 10 } });
    expect(line.status()).toBe(201);
    await page.goto("/clinic/cart");
    await expect(page.getByText(new RegExp(`Подарок: ${gift.name} × 4`))).toBeVisible();
    await page.getByRole("button", { name: "Оформить заказ", exact: true }).click();
    await expect(page).toHaveURL(/\/clinic\/orders$/);
    const order = await db.supplierOrder.findFirstOrThrow({ where: { buyerOrganizationId: buyer.organizationId }, include: { items: true } });
    expect(order.items.filter(item => item.giftForItemId)).toHaveLength(1);
    await page.goto(`/clinic/orders/${order.id}`);
    await expect(page.getByText(/Обещанный подарок:/)).toBeVisible();
    await expect(page.getByText(/Подарок ·/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`gift-order-${width}.png`), fullPage: true });
  } finally { await fixture.dispose(); }
});
