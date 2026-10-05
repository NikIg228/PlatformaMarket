import { test, expect } from "@playwright/test";
import { productFixture, choose, noOverflow, id, offerId, samplePromotion } from "./supplier-products.fixture";
test.use({ contextOptions: { reducedMotion: "reduce" } });
const sections = [
  ["new", "Добавить товар", "Найти"], ["import", "Загрузить из файла", "Настроить столбцы"],
  ["proposals", "Заявки на новые товары", "Найти заявку"], ["corrections", "Исправления карточек", "Предложить исправление"],
  ["inventory", "Партии и резервы", "Найти"], ["promotions", "Акции", "Новая акция"],
] as const;
for (const width of [1440, 390]) test(`six product pages are reachable and usable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await productFixture(page);
  await page.goto("/supplier/products");
  const actions = page.getByRole("group", { name: "Действия с товарами" });
  await expect(actions.getByRole("link")).toHaveCount(6);
  for (const [path, title, action] of sections) {
    await actions.locator(`a[href="/supplier/products/${path}"]`).focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/supplier/products/${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${path}-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: width === 390 ? "Вернуться: Товары" : "Товары", exact: true }).last().click();
    await expect(actions).toBeVisible();
  }
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("product pages keep permission boundaries before business reads", async ({ page }) => {
  const state = await productFixture(page, []);
  for (const [path] of sections) {
    await page.goto(`/supplier/products/${path}`);
    await expect(page.getByText(/Этот раздел недоступен вашей роли/)).toBeVisible();
  }
  expect(state.reads.every(path => path.startsWith("/auth/") || path.startsWith("/access-control/") || path.startsWith("/conversations"))).toBe(true);
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("legacy product URLs and sources link lead to complete standalone pages", async ({ page }) => {
  const state = await productFixture(page);
  for (const editor of ["new", "import"]) {
    await page.goto(`/supplier/products?editor=${editor}`);
    await expect(page).toHaveURL(new RegExp(`/supplier/products/${editor}$`));
    await expect(page.getByRole("navigation", { name: "Навигационный путь" }).getByRole("link", { name: "Товары", exact: true })).toBeVisible();
  }
  await page.goto("/supplier/settings/sources");
  await expect(page.getByText(/Основной прайс/)).toBeVisible();
  await page.getByRole("link", { name: "Загрузить прайс", exact: true }).click();
  await expect(page).toHaveURL(/\/supplier\/products\/import$/);
  await expect(page.getByRole("button", { name: "Настроить столбцы" })).toBeVisible();
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

for (const width of [1440, 390]) test(`compact list filters and offer drawer at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await productFixture(page);
  await page.goto("/supplier/products");
  const product = page.getByRole("button", { name: "Композит для реставрации", exact: true });
  await expect(product).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`list-${width}.png`) });
  await page.getByRole("tab", { name: "Требуют внимания" }).click();
  await expect(product).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Адгезив универсальный", exact: true })).toBeVisible();
  expect(state.reads.some(path => path.includes("attention=required"))).toBe(true);
  if (width === 390) await page.getByRole("button", { name: "Фильтр публикации" }).click();
  await choose(page, "Публикация", "Не опубликованы");
  await expect(page.getByText("Товары не найдены", { exact: true })).toBeVisible();
  await choose(page, "Публикация", "Все статусы");
  await page.getByRole("tab", { name: "Все товары", exact: true }).click();
  await product.focus(); await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer).toHaveCSS("opacity", "1");
  if (width === 390) await expect.poll(async () => Math.round((await drawer.boundingBox())!.x)).toBe(0);
  await expect(drawer.getByRole("button", { name: "Закрыть предложение", exact: true })).toBeInViewport();
  await expect(drawer.getByRole("heading", { name: "Композит для реставрации" })).toBeVisible();
  await expect(drawer.getByText("25 уп.", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Минимальный заказ", { exact: true })).toBeVisible(); await expect(drawer.getByText("2 уп.", { exact: true })).toBeVisible();
  await drawer.getByText("Источники и актуальность данных", { exact: true }).click(); await expect(drawer).toContainText("Источник цены: ручной ввод");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath(`drawer-${width}.png`) });
  await page.keyboard.press("Escape"); await expect(drawer).toHaveCount(0); await expect(product).toBeFocused();
  state.failOffers = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Повторить обновление" })).toBeVisible();
  await expect(product).toBeVisible();
  state.failOffers = false;
  await page.getByRole("button", { name: "Повторить обновление" }).click();
  await expect(page.getByRole("button", { name: "Повторить обновление" })).toHaveCount(0);
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("shared promotion workspace keeps operator review and keyboard filtering", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "admin-ui-fixture" })));
  let approved = false;
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path === "/promotions") return route.fulfill({ json: { items: [{ ...samplePromotion, moderationStatus: approved ? "APPROVED" : "PENDING", temporalStatus: approved ? "ACTIVE" : "DRAFT" }], total: 1, offset: 0, limit: 10 } });
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
  await filter.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "На проверке", exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(filter).toBeFocused();
  await page.getByRole("textbox", { name: "Причина решения", exact: true }).fill("Условия и цена проверены");
  await page.getByRole("button", { name: "Согласовать версию", exact: true }).click();
  await expect(page.getByRole("button", { name: "Разместить на витрине", exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ action: "APPROVE", expectedVersion: 1, reason: "Условия и цена проверены" });
});

test("ERP offer keeps its source authority in the editor", async ({ page }) => {
  const state = await productFixture(page); state.offers[0] = { ...state.offers[0]!, sourceType: "ERP" };
  await page.goto("/supplier/products");
  await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  await page.getByRole("button", { name: "Изменить условия", exact: true }).click();
  await expect(page.getByText(/Предложение управляется интеграцией/)).toBeVisible();
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("manual offer creation keeps conditions and idempotency through retry, then publishes explicitly", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await productFixture(page); state.failCommercial = true;
  await page.goto("/supplier/products/new");
  await page.getByLabel("Товар, артикул или штрихкод", { exact: true }).fill("Композит");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: "Выбрать COMP", exact: true }).click();
  await page.getByRole("button", { name: "Условия продажи", exact: true }).click(); await page.getByLabel("Ваш артикул", { exact: true }).fill("SUP-1");

  await choose(page, "Склад", "Основной склад");
  await page.getByLabel("Цена за упаковку, ₸", { exact: true }).fill("1234,56");
  await page.getByLabel("Количество упаковок", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Проверить предложение", exact: true }).click();
  await expect(page.getByText("Повторите сохранение условий", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Цена за упаковку, ₸", { exact: true })).toHaveValue("1234,56");
  state.failCommercial = false;
  await page.getByRole("button", { name: "Повторить сохранение", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Проверьте перед публикацией" })).toBeVisible();
  const writes = state.writes.filter(item => item.path.endsWith("/commercial"));
  expect(writes).toHaveLength(2); expect(writes[0]!.body).toEqual(writes[1]!.body);
  expect(writes[1]!.body).toMatchObject({ amountMinor: "123456", quantityOnHand: 5 });
  expect(state.writes.some(item => item.path.endsWith("/publication"))).toBe(false);
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("new-review-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Опубликовать предложение", exact: true }).click();
  await expect(page.getByText("Предложение опубликовано. Цена и остаток доступны клиникам.", { exact: true })).toBeVisible();
  expect(state.writes.filter(item => item.path.endsWith("/publication"))).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});

test("spreadsheet preview is read-only and processing requires explicit confirmation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await productFixture(page); state.failImport = true;
  await page.goto("/supplier/products/import");
  await expect(page.getByRole("link", { name: /Скачать шаблон CSV/ })).toHaveAttribute("download", "Шаблон-прайса.csv");
  await page.getByLabel("Таблица поставщика", { exact: true }).setInputFiles({ name: "price.csv", mimeType: "text/csv", buffer: Buffer.from("Код,Название,Цена,Валюта,Остаток\nPRICE-1,Композит,1234.56,KZT,5\n") });
  await choose(page, "Источник прайса", "Основной прайс");
  await page.getByRole("button", { name: "Настроить столбцы" }).click();
  await expect(page.getByText("Не удалось прочитать прайс", { exact: true })).toBeVisible();
  await expect(page.getByText("price.csv", { exact: true })).toBeVisible();
  state.failImport = false;
  await page.getByRole("button", { name: "Настроить столбцы" }).click();
  await expect(page.getByRole("combobox", { name: "Код строки", exact: true })).toHaveText("Код");
  await page.getByRole("button", { name: "Проверить данные" }).click();
  await expect(page.getByRole("table", { name: "Предварительный просмотр строк файла" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText(/1.234,56/);
  expect(state.writes.filter(item => item.path.endsWith("/import-batches") || item.path.endsWith("/process"))).toHaveLength(0);
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("import-preview-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Далее: подтверждение" }).click();
  await expect(page.getByText(/Цены и остатки сопоставленных товаров будут обновлены/)).toBeVisible();
  expect(state.writes.filter(item => item.path.endsWith("/process"))).toHaveLength(0);
  await page.getByRole("button", { name: "Подтвердить и обработать" }).click();
  await expect(page.getByText(/Всего строк: 1 · обработано: 1 · ошибок: 0/)).toBeVisible();
  expect(state.writes.filter(item => item.path.endsWith("/process"))).toHaveLength(1);
  expect(state.writes.find(item => item.path.endsWith("/import-batches"))!.body).toMatchObject({ columnMapping: { priceMinor: "Цена", priceUnit: "MAJOR" } });
  expect(state.unexpected).toEqual([]);
});
test("rejected proposal shows submitted details and supports a corrected submission", async ({ page }) => {
  const state = await productFixture(page); state.failProposals = true;
  await page.goto("/supplier/products/proposals");
  await page.getByRole("button", { name: /Новый материал NEW-1/ }).click();
  await expect(page.getByText("Исходные сведения и упаковка", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Исправить и подать заново" }).click();
  const description = page.getByRole("textbox", { name: "Описание, упаковка и ссылка на материалы", exact: true });
  await expect(description).toHaveValue("Исходные сведения и упаковка"); await description.fill("Уточнённая упаковка из 10 штук");
  await page.getByRole("button", { name: "Проверить заявку", exact: true }).click(); await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  await expect(page.getByText("Не удалось отправить заявку", { exact: true })).toBeVisible();
  await expect(page.getByText("Уточнённая упаковка из 10 штук", { exact: true })).toBeVisible();
  state.failProposals = false; await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
  await expect(page.getByText(/отправлена на модерацию/)).toBeVisible();
  expect(state.writes.at(-1)!.body).toMatchObject({ proposedName: "Новый материал", proposedSku: "NEW-1", rawSubmission: { description: "Уточнённая упаковка из 10 штук" } });
  expect(state.unexpected).toEqual([]);
});

test("correction wizard keeps the comparison and input through a failed submission", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await productFixture(page); state.failCorrections = true;
  await page.goto(`/supplier/products/corrections?mode=new&offer=${offerId}`);
  await expect(page.getByText("Текущее описание материала", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Предлагаемая редакция", exact: true }).fill("Новое точное описание материала");
  await page.getByRole("textbox", { name: "Почему нужна правка", exact: true }).fill("Соответствует каталогу производителя");
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("correction-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Далее: подтверждение", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Отправить исправление", exact: true }).click();
  await expect(page.getByText("Ошибка отправки", { exact: true })).toBeVisible();
  await expect(page.getByText("Новое точное описание материала", { exact: true })).toBeVisible();
  state.failCorrections = false; await page.getByRole("button", { name: "Отправить исправление", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Исправление отправлено", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Мои исправления", exact: true }).click();
  await page.getByRole("button", { name: "Подробнее", exact: true }).click();
  await expect(page.getByText("Новое точное описание материала", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[0]!.body).toEqual(state.writes[1]!.body);
  expect(state.unexpected).toEqual([]);
});
test("inventory tabs load lots and linked reservations with warehouse filtering", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await productFixture(page);
  await page.goto("/supplier/products/inventory");
  await expect(page.getByRole("table", { name: "Остатки по складам" })).toContainText("25 уп.");
  await choose(page, "Склад", "Второй склад"); await expect(page.getByText("Остатки не найдены", { exact: true })).toBeVisible();
  await choose(page, "Склад", "Все склады");
  await page.getByRole("tab", { name: "Партии", exact: true }).click();
  await choose(page, "Товар и склад", "Композит для реставрации · Основной склад");
  await expect(page.getByText(/LOT-2026/)).toBeVisible(); await expect(page.getByText("1 янв. 2030 г.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Резервы", exact: true }).click();

  await expect(page.getByRole("link", { name: "Заказ ORD-100" })).toHaveAttribute("href", `/supplier/orders/${id(25)}`);
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("reservations-mobile.png"), fullPage: true });
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("promotion draft previews the lower price and requires separate moderation submission", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await productFixture(page); state.failPromotions = true;
  await page.goto("/supplier/products/promotions");
  await page.getByRole("tab", { name: "Архив", exact: true }).click(); await expect(page.getByText("Акций пока нет", { exact: true })).toBeVisible();
  expect(state.reads.some(path => path.includes("phase=ENDED"))).toBe(true);
  await page.getByRole("tab", { name: "Все", exact: true }).click();
  await page.getByRole("button", { name: "Новая акция", exact: true }).click();
  await page.getByRole("button", { name: "Найти: Товар акции", exact: true }).click();
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




test("product context links and list filters survive a round trip", async ({ page }, testInfo) => {
  const state = await productFixture(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/supplier/products");
  await page.getByRole("textbox", { name: "Поиск по товарам" }).fill("Композит");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  await page.getByRole("link", { name: "Предложить исправление карточки" }).click();
  await expect(page).toHaveURL(new RegExp(`corrections\\?mode=new&offer=${offerId}`));
  await expect(page.getByRole("heading", { level: 1, name: "Предложить исправление" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Навигационный путь" })).not.toBeVisible();
  await expect(page.getByText("Текущее описание материала", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Вернуться: Исправления карточек", exact: true }).click();
  await page.getByRole("link", { name: "Вернуться: Товары", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Поиск по товарам" })).toHaveValue("Композит");
  await expect(page.getByRole("button", { name: "Адгезив универсальный", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Резервы", exact: true }).click();
  await expect(page.getByRole("link", { name: "Заказ ORD-100" })).toBeVisible();
  expect(state.reads.some(path => path.includes(`offerId=${offerId}`) && path.includes(`balanceId=${id(8)}`))).toBe(true);
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("linked-reserves-mobile.png"), fullPage: true });
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
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

test("desktop workflows keep entered conditions when stepping back", async ({ page }, testInfo) => {
  const state = await productFixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/supplier/products/new");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: "Выбрать COMP", exact: true }).click();
  await page.getByRole("button", { name: "Условия продажи", exact: true }).click();
  await page.getByRole("textbox", { name: "Цена за упаковку, ₸", exact: true }).fill("1234,56");
  await choose(page, "Склад", "Основной склад");
  await page.getByRole("textbox", { name: "Количество упаковок", exact: true }).fill("25");
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.getByRole("button", { name: "Условия продажи", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Цена за упаковку, ₸", exact: true })).toHaveValue("1234,56");
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("add-conditions-desktop.png"), fullPage: true });
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("navigation", { name: "Навигационный путь" }).getByRole("link", { name: "Товары", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Количество упаковок", exact: true })).toHaveValue("25");
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});
