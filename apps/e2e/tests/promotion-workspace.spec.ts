import { test, expect } from "@playwright/test";
import { productFixture, choose, noOverflow, id, offerId, samplePromotion } from "./supplier-products.fixture";

// Enabled-module scenarios run with a go_live web build, never the pilot artifact.
test.use({ contextOptions: { reducedMotion: "reduce" } });

test("enabled promotions keep permission denial before business reads", async ({ page }) => {
  const state = await productFixture(page, []);
  await page.goto("/supplier/products/promotions");
  await expect(page.getByText(/Этот раздел недоступен вашей роли/)).toBeVisible();
  expect(state.reads.some(path => path.startsWith("/promotions"))).toBe(false);
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("shared promotion workspace keeps operator review and keyboard filtering", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "admin-ui-fixture" })));
  let approved = false;
  const filters: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path === "/promotions") {
      filters.push(new URL(request.url()).searchParams.get("moderationStatus") ?? "");
      return route.fulfill({ json: { items: [{ ...samplePromotion, moderationStatus: approved ? "APPROVED" : "PENDING", temporalStatus: approved ? "ACTIVE" : "DRAFT" }], total: 1, offset: 0, limit: 10 } });
    }
    if (path === `/promotions/${samplePromotion.id}/commands`) {
      const body = request.postDataJSON(); writes.push(body); approved = true;
      return route.fulfill({ json: { ...samplePromotion, version: 2 } });
    }
    // Unrelated operator panels are intentionally unavailable in this focused test.
    return route.fulfill({ status: 503, json: { message: "Панель не участвует в проверке" } });
  });
  await page.goto("/admin?section=catalog");
  await expect(page.getByRole("heading", { name: "Согласование акций", exact: true })).toBeVisible();
  const filter = page.getByRole("combobox", { name: "Статус согласования", exact: true });
  await filter.focus(); await filter.press("Enter");
  await filter.press("Home"); await filter.press("ArrowDown"); await filter.press("ArrowDown"); await filter.press("Enter");
  await expect(filter).toHaveText("На проверке");
  await expect.poll(() => filters.at(-1)).toBe("PENDING");
  await filter.press("Enter"); await filter.press("Home"); await filter.press("Enter");
  await expect(filter).toHaveText("Все статусы");
  await expect.poll(() => filters.at(-1)).toBe("");
  await expect(filter).toBeFocused();
  await page.getByRole("textbox", { name: "Причина решения", exact: true }).fill("Условия и цена проверены");
  await page.getByRole("button", { name: "Согласовать версию", exact: true }).click();
  await expect(page.getByRole("button", { name: "Разместить на витрине", exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ action: "APPROVE", expectedVersion: 1, reason: "Условия и цена проверены" });
});

test("promotion draft previews the lower price and requires separate moderation submission", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await productFixture(page); state.failPromotions = true;
  await page.goto("/supplier/products");
  const actions = page.getByRole("group", { name: "Действия с товарами" });
  await expect(actions).toHaveAttribute("data-promotions", "true");
  await expect(actions.getByRole("link")).toHaveCount(6);
  await actions.getByRole("link", { name: "Акции", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/supplier\/products\/promotions$/);
  await page.getByRole("tab", { name: "Архив", exact: true }).click(); await expect(page.getByText("Акции не найдены", { exact: true })).toBeVisible();
  expect(state.reads.some(path => path.includes("phase=ENDED"))).toBe(true);
  await page.getByRole("tab", { name: "Все", exact: true }).click();
  await page.getByRole("button", { name: "Новая акция", exact: true }).click();
  await page.getByRole("textbox", { name: "Поиск: Товар акции", exact: true }).fill("Композит");
  await page.getByRole("textbox", { name: "Поиск: Товар акции", exact: true }).press("Enter");
  await choose(page, "Товар акции", "Композит для реставрации · COMP-10");
  await page.getByRole("button", { name: "Далее", exact: true }).click(); await page.getByRole("textbox", { name: "Название акции", exact: true }).fill("Скидка для клиник");
  await page.getByRole("textbox", { name: "Акционная цена, ₸", exact: true }).fill("800");
  await expect(page.getByRole("complementary", { name: "Предпросмотр акции" })).toContainText(/800/);
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("promotion-preview-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Далее", exact: true }).click(); await page.getByRole("button", { name: "Далее", exact: true }).click(); await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByText("Не удалось сохранить акцию", { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Предпросмотр акции" })).toContainText("800");
  state.failPromotions = false; await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("table", { name: "Акции поставщика" })).toContainText("Скидка для клиник");
  const writes = state.writes.filter(item => item.path === "/promotions");
  expect(writes).toHaveLength(2); expect(writes[0]!.body).toEqual(writes[1]!.body);
  expect(writes[1]!.body).toMatchObject({ terms: { offerId, kind: "FIXED_AMOUNT", fixedAmountMinor: "20000" } });
  expect(state.writes.some(item => item.path.endsWith("/commands"))).toBe(false);
  await page.getByRole("row").filter({ hasText: "Скидка для клиник" }).getByRole("button", { name: "Подробнее" }).click(); await page.getByRole("button", { name: "Отправить на согласование", exact: true }).click();
  expect(state.writes.at(-1)).toMatchObject({ path: `/promotions/${id(31)}/commands`, body: { action: "SUBMIT" } });
  expect(state.unexpected).toEqual([]);
});

test("promotion submission retry reuses the saved draft and protects unsaved input", async ({ page }, testInfo) => {
  const state = await productFixture(page); state.failPromotionSubmit = true;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/supplier/products/promotions?mode=new&offer=${offerId}`);
  await expect(page.getByRole("textbox", { name: "Обычная цена, ₸", exact: true })).toHaveValue("1000.00");
  await page.getByRole("textbox", { name: "Акционная цена, ₸", exact: true }).fill("850");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("navigation", { name: "Навигационный путь" }).getByRole("link", { name: "Акции", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Акционная цена, ₸", exact: true })).toHaveValue("850");
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("promotion-conditions-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await page.getByRole("button", { name: "Отправить на согласование", exact: true }).click();
  await expect(page.getByText(/Черновик сохранён. Не удалось отправить акцию/)).toBeVisible();
  state.failPromotionSubmit = false;
  await page.getByRole("button", { name: "Отправить на согласование", exact: true }).click();
  await expect(page.getByRole("table", { name: "Акции поставщика" })).toBeVisible();
  expect(state.writes.filter(item => item.path === "/promotions")).toHaveLength(1);
  const commands = state.writes.filter(item => item.path.endsWith("/commands"));
  expect(commands).toHaveLength(2); expect(commands[0]!.body).toEqual(commands[1]!.body);
  expect(state.unexpected).toEqual([]);
});
