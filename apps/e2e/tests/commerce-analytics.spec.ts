import { expect, test } from "@playwright/test";
import { offerPromotionFixture } from "../fixtures/offer-promotion";

test("CORE07: supplier confirmation and three-role analytics at desktop/mobile", async ({ page, request }, testInfo) => {
  const fixture = await offerPromotionFixture();
  const { db, supplier, buyer, operator, main } = fixture;
  await db.organization.updateMany({ where: { id: { in: [buyer.organizationId, supplier.organizationId] } }, data: { commerceDataset: "TEST" } });
  await page.addInitScript(({ supplier, buyer, operator }) => {
    sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify(supplier));
    sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify(buyer));
    sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ ...operator, actorId: operator.userId, user: { id: operator.userId }, activeOrganizationId: operator.organizationId }));
  }, { supplier, buyer, operator });
  const post = async (path: string, body: unknown) => {
    const response = await request.post(`http://127.0.0.1:4012/api${path}`, { headers: { authorization: `Bearer ${buyer.accessToken}` }, data: body });
    expect(response.status(), await response.text()).toBe(201); return response.json();
  };
  try {
    const cart = await post(`/buyers/${buyer.organizationId}/carts`, { currency: "KZT" });
    await post(`/carts/${cart.id}/items`, { offerId: main.id, quantity: 3 });
    const checkout = await post(`/carts/${cart.id}/checkout`, { idempotencyKey: `analytics-${fixture.key}` });
    const order = checkout.supplierOrders[0];
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/supplier/orders/${order.id}`);
    await page.getByRole("button", { name: "Проверить и подтвердить", exact: true }).click();
    await page.getByLabel(`Подтверждаемое количество: ${main.name}`, { exact: true }).fill("2");
    await page.getByLabel(`Категория причины: ${main.name}`, { exact: true }).selectOption("STOCK");
    await page.getByLabel(`Причина изменения: ${main.name}`, { exact: true }).fill("В наличии осталось две упаковки");
    const confirm = page.getByRole("button", { name: "Подтвердить заказ", exact: true });
    await confirm.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(async () => db.commerceMetricEvent.count({ where: { supplierOrderId: order.id, kind: "REFUSED_STOCK" } })).toBe(1);
    for (const [role, width] of [["clinic", 1440], ["supplier", 390], ["admin", 1440]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(role === "admin" ? "/admin?section=analytics" : `/${role}/analytics`);
      const region = page.getByRole("region", { name: "Аналитика заказов и комиссии", exact: true });
      await region.getByLabel("Набор данных", { exact: true }).selectOption("TEST");
      await expect(region.getByRole("link", { name: order.orderNumber, exact: true }).first()).toBeVisible();
      await expect(region.getByText("Отказ: остаток", { exact: true })).toBeVisible();
      await expect(region.getByText("Не учитывается", { exact: true })).toHaveCount(2);
      await expect(region.locator("dt").filter({ hasText: /^Создано заказов$/ }).locator("..").locator("dd")).toHaveText("1");
      if (role !== "admin") await expect(region.getByRole("link", { name: order.orderNumber, exact: true }).first()).toHaveAttribute("href", `/${role}/orders/${order.id}`);
      await expect(page.locator("body")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`analytics-${role}-${width}.png`), fullPage: true });
      await region.getByRole("link", { name: order.orderNumber, exact: true }).first().click();
      if (role === "admin") {
        await expect(page.getByRole("region", { name: "Объект из очереди", exact: true }).getByRole("heading", { name: `Заказ ${order.orderNumber}`, exact: true })).toBeVisible();
        await page.goto("/admin?section=analytics");
        await region.getByLabel("Набор данных", { exact: true }).selectOption("TEST");
        await expect(region.getByRole("link", { name: order.orderNumber, exact: true }).first()).toBeVisible();
      } else {
        await expect(page).toHaveURL(new RegExp(`/${role}/orders/${order.id}$`));
        await expect(page.getByRole("heading", { name: new RegExp(order.orderNumber) })).toBeVisible();
      }
    }
    const region = page.getByRole("region", { name: "Аналитика заказов и комиссии", exact: true });
    const selectedFrom = await region.getByLabel("С даты", { exact: true }).inputValue();
    let fail = true;
    await page.route("**/commerce-analytics?**", async route => { if (fail) { fail = false; await route.abort("failed"); } else await route.continue(); });
    await region.getByRole("button", { name: "Обновить аналитику", exact: true }).click();
    await expect(region.getByRole("button", { name: "Повторить загрузку", exact: true })).toBeVisible();
    await expect(region.getByLabel("С даты", { exact: true })).toHaveValue(selectedFrom);
    const retry = region.getByRole("button", { name: "Повторить загрузку", exact: true });
    await retry.focus(); await page.keyboard.press("Enter");
    await expect(region.getByRole("link", { name: order.orderNumber, exact: true }).first()).toBeVisible();
    await region.getByLabel("Набор данных", { exact: true }).selectOption("BUSINESS");
    await expect(region.getByText("Нет событий за этот период", { exact: true })).toBeVisible();
  } finally {
    await page.goto("about:blank"); await fixture.dispose();
  }
});
