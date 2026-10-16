import { test, expect } from "@playwright/test";
import { operatorOrdersFixture } from "../fixtures/operator-orders";

test("real operator session reads registry, selected order and its documents", async ({ page }, info) => {
  const f = await operatorOrdersFixture();
  try {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(session => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify(session)), { accessToken: f.operator.session.accessToken, sessionId: f.operator.session.sessionId, activeOrganizationId: f.operator.org.id, user: { id: f.operator.user.id, displayName: "Оператор" }, expiresAt: Date.now() + 3600000 });
    await page.goto(`/admin?section=orders&orderQ=${f.prefix}-30`);
    await expect(page.getByText("Найдено заказов: 1", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `Открыть заказ ${f.prefix}-30`, exact: true }).click();
    await expect(page.getByRole("heading", { name: `Заказ ${f.prefix}-30`, exact: true })).toBeVisible();
    await expect(page.getByText("Получено восемь вместо десяти", { exact: true })).toBeVisible();
    await expect(page.getByText("PRIVATE_DRAFT_MUST_NOT_LEAK")).toHaveCount(0);
    await page.getByRole("button", { name: `Открыть документ ${f.prefix}-WAYBILL · 1`, exact: true }).click();
    await expect(page.getByRole("dialog").getByText("Подписи отсутствуют.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("real-order.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await f.dispose(); }
});
