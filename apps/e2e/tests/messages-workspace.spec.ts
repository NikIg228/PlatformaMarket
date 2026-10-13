import { expect, test } from "@playwright/test";
import { id, messagesFixture, pngFile, productId } from "./messages.fixture";

test("question and messages retain keyboard input and component identity", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  await messagesFixture(page);
  await page.goto(`/products/${productId}`);
  await page.getByRole("button", { name: "Задать вопрос", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Задать вопрос поставщику" });
  const input = dialog.getByRole("textbox", { name: "Ваш вопрос" });
  await expect(input).toBeEnabled(); await input.click();
  await input.pressSequentially("Test question", { delay: 40 });
  await expect(input).toHaveValue("Test question"); await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Задать вопрос", exact: true }).first().click();
  await expect(input).toHaveValue("Test question");
  await page.goto(`/clinic/messages?conversationId=${id(10)}`);
  const message = page.getByRole("textbox", { name: "Сообщение", exact: true });
  await expect(message).toBeEnabled(); await message.click();
  await message.pressSequentially("Test reply", { delay: 40 });
  await expect(message).toHaveValue("Test reply"); await expect(message).toBeFocused();
  expect(errors).toEqual([]);
});

for (const width of [1440, 834, 390]) test(`messages layout, attachments and retry ${width}`, async ({ page }, info) => {
  const state = await messagesFixture(page, width === 390 ? "supplier" : "clinic");
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/${width === 390 ? "supplier" : "clinic"}/messages?conversationId=${id(10)}`);
  const chat = page.getByRole("region", { name: "Сообщения", exact: true });
  const input = chat.getByRole("textbox", { name: "Сообщение", exact: true });
  await expect(input).toBeEnabled();
  await expect(chat.getByText("Загружаем диалоги", { exact: true })).toHaveCount(0);
  await input.fill("Уточните срок поставки выбранного оттенка.");
  await chat.getByLabel("Файлы сообщения").setInputFiles(pngFile);
  await expect(chat.getByRole("button", { name: "Убрать Упаковка.png" })).toBeEnabled();
  const send = chat.getByRole("button", { name: "Отправить", exact: true });
  state.failSend = true; await send.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".dm-save-toast").filter({ hasText: "Результат пока неизвестен" })).toBeVisible();
  await expect(input).toHaveValue("Уточните срок поставки выбранного оттенка.");
  state.failSend = false; await send.click(); await expect(input).toHaveValue("");
  const sends = state.writes.filter(row => row.path.endsWith("/messages"));
  expect(sends).toHaveLength(2); expect(sends[0].input).toEqual(sends[1].input);
  expect(state.details.get(id(10))!.messages.filter(row => row.body === "Уточните срок поставки выбранного оттенка.")).toHaveLength(1);
  const history = chat.getByRole("list", { name: "История сообщений" });
  await expect(history.getByText("Уточните срок поставки выбранного оттенка.")).toBeVisible();
  await history.getByRole("button", { name: "Посмотреть Упаковка.png" }).click();
  await expect(page.getByRole("dialog", { name: "Упаковка.png" }).getByRole("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(history.getByRole("button", { name: "Посмотреть Упаковка.png" })).toBeFocused();
  await chat.getByRole("button", { name: "Действия с диалогом" }).click();
  await page.getByRole("menuitem", { name: "Вопрос решён", exact: true }).click();
  await expect(chat.locator(".dm-conversation-status")).toContainText("Вопрос решён");
  await input.fill("Черновик\nВторая строка\nТретья строка");
  for (const notice of await page.getByRole("button", { name: "Закрыть уведомление", exact: true }).all()) await notice.click();
  await page.screenshot({ path: info.outputPath(`messages-${width}.png`), fullPage: true });
  const geometry = await page.evaluate(() => {
    const composer = document.querySelector(".dm-conversation-compose")!.getBoundingClientRect();
    const history = document.querySelector(".dm-conversation-scroll")!.getBoundingClientRect();
    const row = document.querySelector(".dm-conversations-item")!;
    const send = document.querySelector<HTMLButtonElement>('.dm-conversation-compose button[type="submit"]')!;
    return { overflow: document.documentElement.scrollWidth > innerWidth, composerBottom: composer.bottom, historyBottom: history.bottom, composerTop: composer.top, send: send.getBoundingClientRect().height, rowHeight: row.getBoundingClientRect().height, selected: getComputedStyle(row).backgroundColor, radius: getComputedStyle(send).borderRadius, font: getComputedStyle(send).fontFamily };
  });
  expect(geometry.overflow).toBe(false); expect(geometry.composerBottom).toBeLessThanOrEqual(902);
  expect(geometry.historyBottom).toBeLessThanOrEqual(geometry.composerTop); expect(geometry.send).toBeGreaterThanOrEqual(44);
  expect(geometry.radius).toBe("8px"); expect(geometry.font).toContain("Manrope");
  if (width > 760) { expect(geometry.rowHeight).toBeLessThanOrEqual(68); expect(geometry.selected).toBe("rgb(228, 243, 237)"); }
  expect(state.unexpected).toEqual([]);
});

test("messages silent refresh preserves draft and reading, filter and paging recover", async ({ page }) => {
  const state = await messagesFixture(page);
  await page.clock.install(); await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/clinic/messages?conversationId=${id(10)}`);
  const input = page.getByRole("textbox", { name: "Сообщение", exact: true }); await expect(input).toBeEnabled();
  await input.fill("Сохранённый черновик");
  const scroll = page.locator(".dm-conversation-scroll");
  await scroll.evaluate(node => { node.scrollTop = 140; node.dispatchEvent(new Event("scroll")); });
  const before = await scroll.evaluate(node => node.scrollTop);
  const detail = state.details.get(id(10))!;
  detail.messages.push({ ...detail.messages[0], id: id(9998), sequence: 33, body: "Новое входящее сообщение" }); detail.conversation.latestSequence = 33;
  const calls = state.listCalls; await page.clock.fastForward(30_001); await expect.poll(() => state.listCalls).toBeGreaterThan(calls);
  await expect(page.getByRole("button", { name: "К новым сообщениям" })).toBeVisible();
  await expect(input).toHaveValue("Сохранённый черновик"); expect(await scroll.evaluate(node => node.scrollTop)).toBe(before);
  await expect(page.locator(".fui-Spinner")).toHaveCount(0);
  await page.getByRole("button", { name: "К новым сообщениям" }).click(); await expect(page.getByText("Новое входящее сообщение", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ранние сообщения" }).click();
  await expect(page.getByText("Самое раннее сообщение", { exact: true })).toHaveCount(1);
  state.failList = true; await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator(".dm-save-toast")).toContainText("Диалоги временно недоступны");
  await expect(input).toHaveValue("Сохранённый черновик");
  state.failList = false; await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.locator(".dm-conversations-item")).toHaveCount(30);
  await page.locator(".dm-conversations-list").evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.locator(".dm-conversations-item")).toHaveCount(36);
  await page.getByRole("combobox", { name: "Фильтр диалогов" }).click(); await page.getByRole("option", { name: "По заказам", exact: true }).click();
  await expect(page.locator(".dm-conversations-item")).toHaveCount(0); await expect(page.getByText("Диалогов пока нет", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("Сохранённый черновик"); expect(state.unexpected).toEqual([]);
});

test("messages discard a delayed previous selection and retain per-dialog drafts", async ({ page }) => {
  const state = await messagesFixture(page); await page.goto(`/clinic/messages?conversationId=${id(10)}`);
  const input = page.getByRole("textbox", { name: "Сообщение", exact: true }); await expect(input).toBeEnabled(); await input.fill("Первый черновик");
  state.slowId = id(11); await page.locator(".dm-conversations-item").nth(1).click();
  await expect.poll(() => state.reads.filter(path => path === `/conversations/${id(11)}`).length).toBe(1);
  await page.locator(".dm-conversations-item").nth(2).click(); await expect(input).toBeEnabled(); await input.fill("Третий черновик");
  state.slowId = ""; state.releaseDetail();
  await expect(page.locator(".dm-conversation-context")).toContainText("DentalPro 12"); await expect(input).toHaveValue("Третий черновик");
  await page.locator(".dm-conversations-item").first().click(); await expect(input).toHaveValue("Первый черновик");
});

for (const width of [1440, 834, 390]) test(`supplier question context, saved draft, upload and unknown retry ${width}`, async ({ page }, info) => {
  const state = await messagesFixture(page); await page.setViewportSize({ width, height: 900 });
  await page.goto(`/products/${productId}`);
  const trigger = page.getByRole("article", { name: "Предложение: DentalPro", exact: true }).getByRole("button", { name: "Задать вопрос", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Задать вопрос поставщику" });
  const input = dialog.getByRole("textbox", { name: "Ваш вопрос" }); await expect(input).toBeEnabled();
  await expect(dialog).toContainText("DentalPro"); await expect(dialog).toContainText("Filtek Ultimate"); await expect(dialog).toContainText("Оттенок A2"); await expect(dialog).toContainText("Шприц · 4 г");
  expect(state.writes.filter(row => row.path === "/conversations")).toHaveLength(0);
  await input.fill("Можно прислать фото маркировки?"); state.failUpload = true;
  await dialog.getByLabel("Файлы сообщения").setInputFiles(pngFile);
  await expect(dialog.getByText("Проверка файла временно недоступна", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
  await page.getByRole("article", { name: "Предложение: MedDent", exact: true }).getByRole("button", { name: "Задать вопрос", exact: true }).click();
  await expect(input).toBeEnabled(); await expect(input).toHaveValue(""); await expect(dialog).toContainText("MedDent");
  await page.keyboard.press("Escape"); await trigger.click(); await expect(input).toHaveValue("Можно прислать фото маркировки?");
  state.failUpload = false; await dialog.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Убрать Упаковка.png" })).toBeEnabled();
  await page.screenshot({ path: info.outputPath(`supplier-question-${width}.png`), fullPage: true });
  const send = dialog.getByRole("button", { name: "Отправить вопрос", exact: true });
  state.failSend = true; await send.click(); await expect(dialog).toBeVisible();
  await expect(page.locator(".dm-save-toast")).toContainText("Результат пока неизвестен"); await expect(input).toHaveValue("Можно прислать фото маркировки?");
  state.failSend = false; await send.click(); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/products/${productId}`));
  await expect(page.locator(".dm-save-toast")).toContainText("Вопрос отправлен поставщику");
  await expect(page.getByRole("link", { name: "Открыть переписку", exact: true })).toHaveAttribute("href", `/clinic/messages?conversationId=${id(10)}`);
  const sends = state.writes.filter(row => row.path === "/conversations"); expect(sends).toHaveLength(2); expect(sends[0].input).toEqual(sends[1].input);
  expect(sends[0].input.contextId).toBe(id(110));
  await trigger.click(); await expect(input).toBeEnabled(); await expect(input).toHaveValue("");
  await expect(dialog.getByRole("link", { name: "Открыть предыдущую переписку" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await input.boundingBox())!.width).toBeGreaterThan(250);
  if (width === 390) {
    await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(900);
    await page.setViewportSize({ width, height: 550 }); await input.focus();
    await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(550);
    expect((await send.boundingBox())!.y + (await send.boundingBox())!.height).toBeLessThanOrEqual(550);
  }
  expect(state.unexpected).toEqual([]);
});

test("supplier question respects role denial and recovers failed context lookup", async ({ page }) => {
  const state = await messagesFixture(page, "clinic", false); state.failLookup = true;
  await page.goto(`/products/${productId}`); await page.getByRole("button", { name: "Задать вопрос", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Задать вопрос поставщику" });
  await expect(dialog.getByRole("button", { name: "Повторить загрузку" })).toBeVisible();
  state.failLookup = false; await dialog.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(dialog).toContainText("У вашей роли нет права отправлять сообщения");
  await expect(dialog.getByRole("button", { name: "Отправить вопрос", exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(0);
});

test("catalog return restores deep loaded window, query and card position with both return actions", async ({ page }) => {
  await messagesFixture(page);
  const items = Array.from({ length: 60 }, (_, n) => ({ id: n === 40 ? productId : id(10000 + n), name: `Материал ${n}`, catalogName: null, brand: "Solventum", manufacturer: "Solventum", categories: [], attributes: [], media: [], isAvailable: true, minNormalizedPriceMinor: null, offers: [] }));
  await page.route("**/catalog-search?**", route => {
    const query = new URL(route.request().url()).searchParams, offset = Number(query.get("offset") ?? 0), limit = Number(query.get("limit") ?? 24);
    return route.fulfill({ json: { items: items.slice(offset, offset + limit), total: items.length, nextOffset: Math.min(offset + limit, items.length), facets: { categories: [], suppliers: [] }, filterOptions: { categories: [], brands: [], manufacturers: [], suppliers: [], packaging: [], attributes: [] } } });
  });
  await page.goto("/catalog?q=Материал&sort=PRICE_ASC");
  const cards = page.getByTestId("product-card"); await expect(cards).toHaveCount(24);
  await cards.first().getByRole("button", { name: /Выбрать поставщика/ }).click();
  const quick = page.getByRole("dialog", { name: "Материал 0", exact: true });
  const ask = quick.getByRole("button", { name: "Задать вопрос поставщику", exact: true }).first(); await ask.click();
  const question = page.getByRole("dialog", { name: "Задать вопрос поставщику", exact: true });
  await expect(question.getByRole("textbox", { name: "Ваш вопрос" })).toBeEnabled();
  await page.keyboard.press("Escape"); await expect(question).toBeHidden(); await expect(ask).toBeFocused();
  await page.keyboard.press("Escape"); await expect(quick).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem("marketplace:catalog-position"))).toBeNull();
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click(); await expect(cards).toHaveCount(48);
  const original = page.locator(`[data-catalog-product="${productId}"]`); await original.scrollIntoViewIfNeeded();
  const top = (await original.boundingBox())!.y;
  await original.getByRole("link").click(); await expect(page.getByRole("button", { name: "Задать вопрос", exact: true }).first()).toBeVisible();
  await page.goBack(); await expect(cards).toHaveCount(48); await expect(page).toHaveURL(/count=48/); await expect(page).toHaveURL(/sort=PRICE_ASC/);
  await expect.poll(async () => Math.abs((await original.boundingBox())!.y - top)).toBeLessThan(5);
  await original.getByRole("link").click(); await page.getByRole("link", { name: "← Каталог", exact: true }).click();
  await expect(cards).toHaveCount(48); await expect(page).toHaveURL(/q=/); await expect.poll(async () => Math.abs((await original.boundingBox())!.y - top)).toBeLessThan(5);
});
