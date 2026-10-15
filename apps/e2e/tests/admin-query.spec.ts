import { expect, test, type Page } from "@playwright/test";
import { history, id, summary } from "./messages.fixture";

async function fixture(page: Page) {
  const state = { reads: [] as string[], unexpected: [] as string[], errors: [] as string[], objectStatus: 200, holdObject: "", objectHeld: false, releaseObject: () => {}, failNotification: false, holdNotification: false, notificationHeld: false, releaseNotification: () => {}, holdConversation: "", conversationHeld: false, releaseConversation: () => {}, writeHeld: false, releaseWrite: () => {}, failWrite: false };
  page.on("pageerror", error => state.errors.push(error.message));
  const tickets = Array.from({ length: 50 }, (_, index) => ({ id: id(200 + index), number: `NAV-${index}`, subject: `Обращение ${index}`, description: `Описание обращения ${index}`, status: "OPEN", priority: "NORMAL", assigneeId: null, slaDueAt: null, version: 1, messages: [], links: [], hasOlder: false }));
  const conversations = [summary(10), summary(11)];
  await page.addInitScript(({ organization, actor, sessionId }) => {
    sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ sessionId, accessToken: "synthetic-navigation-proof", activeOrganizationId: organization, user: { id: actor, displayName: "Оператор навигации" }, expiresAt: Date.now() + 3600000 }));
  }, { organization: id(1), actor: id(2), sessionId: id(3) });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    state.reads.push(path + url.search);
    let json: unknown;
    if (path === "/organizations") json = [{ id: id(1), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }];
    else if (path === "/operations/work-queue/assignees") json = [];
    else if (path === "/access-control/permissions") json = ["support.ticket.view", "support.ticket.create", "support.ticket.manage"];
    else if (path === "/support/tickets") json = Number(url.searchParams.get("offset")) ? tickets.slice(0, 2) : tickets;
    else if (path.startsWith("/support/tickets/") && path.endsWith("/history")) json = [];
    else if (path.startsWith("/support/tickets/")) json = tickets.find(ticket => path.endsWith(ticket.id));
    else if (path === "/operations/work-queue") json = { generatedAt: new Date().toISOString(), operatorOrganizationId: id(1), totalOpenItems: 2, sections: [{ type: "SUPPLIER_CONFIRMATION", priority: "NORMAL", count: 2, hasMore: !Number(url.searchParams.get("offset")), items: [100, 101].map(n => ({ id: id(n), orderNumber: `Заказ ${n}`, reason: "Ожидает подтверждения", href: `/admin?section=orders&queueType=SUPPLIER_CONFIRMATION&object=${id(n)}`, assignment: null })) }] };
    else if (path.startsWith("/operations/work-queue/SUPPLIER_CONFIRMATION/")) {
      const target = path.split("/").at(-1)!;
      if (target === state.holdObject) { state.objectHeld = true; await new Promise<void>(resolve => { state.releaseObject = resolve; }); }
      if (state.objectStatus !== 200) return route.fulfill({ status: state.objectStatus, json: { code: state.objectStatus === 403 ? "FORBIDDEN" : "NOT_FOUND", message: state.objectStatus === 403 ? "Нет доступа к объекту" : "Объект не найден" } });
      json = { id: target, queueType: "SUPPLIER_CONFIRMATION", title: `Детали ${target === id(100) ? "A" : "B"}`, fields: [{ label: "Статус", value: "CONFIRMED" }] };
    } else if (path === "/supplier-terms/operator/acceptances") json = { items: [] };
    else if (path.startsWith("/notifications/") && path.endsWith("/read")) {
      if (state.holdNotification) { state.notificationHeld = true; await new Promise<void>(resolve => { state.releaseNotification = resolve; }); }
      if (state.failNotification) return route.fulfill({ status: 403, json: { code: "FORBIDDEN", message: "Не удалось открыть уведомление" } });
      json = {};
    } else if (path.startsWith("/notifications/")) json = { items: [{ id: id(500), title: "Новое обращение", description: "Проверка перехода", readAt: null, target: { type: "support", id: id(200) } }], unreadCount: 1, nextCursor: null, asOf: new Date().toISOString() };
    else if (path === "/conversations") json = { items: conversations, hasMore: Number(url.searchParams.get("offset")) === 0, unreadCount: 2 };
    else if (path.endsWith("/messages") && path.startsWith("/conversations/")) {
      state.writeHeld = true; await new Promise<void>(resolve => { state.releaseWrite = resolve; });
      if (state.failWrite) return route.fulfill({ status: 403, json: { code: "FORBIDDEN", message: "Отправка A запрещена" } });
      json = { conversationId: path.split("/")[2] };
    }
    else if (path.startsWith("/conversations/") && path.endsWith("/read")) json = { throughSequence: 32 };
    else if (path.startsWith("/conversations/")) {
      const target = path.split("/").at(-1)!;
      if (target === state.holdConversation) { state.conversationHeld = true; await new Promise<void>(resolve => { state.releaseConversation = resolve; }); }
      const row = conversations.find(item => item.id === target)!;
      json = { ...history(row), hasOlder: false, messages: [{ ...history(row).messages[0], body: `История ${target === id(10) ? "A" : "B"}` }] };
    } else if (path === "/catalog/media/test-image") return route.fulfill({ status: 204 });
    else { state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: "Unexpected navigation fixture route" } }); }
    return route.fulfill({ json });
  });
  return state;
}

test("support list context survives reload, ticket history and section links", async ({ page }, info) => {
  const state = await fixture(page);
  await page.goto("/admin?section=support");
  await page.getByLabel("Поиск обращения").fill("A\tB");
  await expect(page.getByText("Удалите управляющие символы из поискового запроса.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Найти", exact: true })).toBeDisabled();
  await page.getByLabel("Поиск обращения").fill("Номер #42\\x");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByLabel("Статус обращения").selectOption("OPEN");
  await page.getByLabel("Порядок").selectOption("recent");
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(page).toHaveURL(/supportOffset=50/);
  const listUrl = page.url();
  await page.reload();
  await expect(page.getByLabel("Поиск обращения")).toHaveValue("Номер #42\\x");
  await expect(page.getByLabel("Статус обращения")).toHaveValue("OPEN");
  await expect(page.getByLabel("Порядок")).toHaveValue("recent");
  await expect.poll(() => state.reads.some(url => url.includes("/support/tickets?") && url.includes("offset=50") && url.includes("sort=recent") && url.includes("status=OPEN"))).toBe(true);
  const opener = page.getByRole("button", { name: "Открыть обращение", exact: true }).first();
  await opener.click(); await expect(page.getByRole("dialog", { name: /NAV-0/ })).toBeVisible();
  await page.goBack(); await expect(page.getByRole("dialog")).toBeHidden(); await expect(page).toHaveURL(listUrl);
  await page.goForward(); await expect(page.getByRole("dialog", { name: /NAV-0/ })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(opener).toBeFocused(); await expect(page).toHaveURL(listUrl);
  const orders = page.getByRole("link", { name: "Заказы и договоры", exact: true });
  expect(new URL(await orders.getAttribute("href") ?? "", page.url()).searchParams.get("supportQ")).toBe("Номер #42\\x");
  await orders.click(); await expect(page).toHaveURL(/section=orders/);
  await page.goBack(); await expect(page.getByLabel("Поиск обращения")).toHaveValue("Номер #42\\x");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Найти", exact: true })).toHaveCSS("height", "44px");
  await expect(page.getByRole("button", { name: "Найти", exact: true })).toHaveCSS("border-radius", "8px");
  await page.screenshot({ path: info.outputPath("support-context-mobile.png"), fullPage: true });
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("queue target changes discard late replies, preserve list context and recover 403/404", async ({ page }, info) => {
  const state = await fixture(page); state.holdObject = id(100);
  await page.goto("/admin?section=orders&queueKind=SUPPLIER_CONFIRMATION&queueOffset=50");
  const links = page.getByRole("link", { name: "Открыть объект", exact: true });
  await links.first().click(); await expect.poll(() => state.objectHeld).toBe(true);
  await expect(page.getByRole("heading", { name: "Объект из очереди", exact: true })).toBeFocused();
  await links.nth(1).click(); await expect(page.getByRole("heading", { name: "Детали B" })).toBeVisible();
  state.holdObject = ""; state.releaseObject();
  await expect(page.getByRole("heading", { name: "Детали A" })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole("heading", { name: "Детали B" })).toBeVisible();
  await expect(page.getByLabel("Раздел очереди")).toHaveValue("SUPPLIER_CONFIRMATION");
  expect(new URL(page.url()).searchParams.get("queueOffset")).toBe("50");
  for (const status of [403, 404]) {
    state.objectStatus = status; await page.reload();
    await expect(page.getByRole("heading", { name: "Детали B" })).toHaveCount(0);
    await expect(page.getByText(status === 403 ? "Нет доступа к объекту" : "Объект не найден", { exact: true })).toBeVisible();
    state.objectStatus = 200; await page.getByRole("button", { name: "Повторить", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Детали B" })).toBeVisible();
  }
  const dismiss = page.locator(".dm-save-toast").getByRole("button", { name: "Закрыть уведомление" });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.screenshot({ path: info.outputPath("queue-object-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Закрыть объект" })).toHaveCSS("height", "44px");
  await expect(page.getByRole("button", { name: "Закрыть объект" })).toHaveCSS("border-radius", "8px");
  await page.screenshot({ path: info.outputPath("queue-object-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Закрыть объект" }).click();
  await expect(page.getByRole("region", { name: "Объект из очереди", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.goBack(); await expect(page.getByRole("heading", { name: "Детали B" })).toBeVisible();
  await page.goBack(); await expect(page.getByRole("heading", { name: "Детали A" })).toBeVisible();
  await page.goBack(); await expect(page.getByRole("region", { name: "Объект из очереди", exact: true })).toHaveCount(0);
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("notification opens one history entry and failed read preserves destination", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin?section=orders&queueKind=SUPPLIER_CONFIRMATION&queueOffset=50"); const previous = page.url();
  await page.getByRole("button", { name: /Уведомления поддержки:/ }).click();
  state.failNotification = true;
  await page.getByRole("dialog", { name: "Уведомления поддержки" }).getByRole("button", { name: "Открыть обращение" }).click();
  await expect(page.getByText("Не удалось открыть уведомление", { exact: true })).toBeVisible(); await expect(page).toHaveURL(previous);
  state.failNotification = false;
  await page.getByRole("dialog", { name: "Уведомления поддержки" }).getByRole("button", { name: "Открыть обращение" }).click();
  await expect(page.getByRole("dialog", { name: /NAV-0/ })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("queueOffset")).toBe("50");
  await page.goBack(); await expect(page).toHaveURL(previous); await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Обращения и споры", exact: true }).click();
  await page.getByRole("button", { name: /Уведомления поддержки:/ }).click();
  state.holdNotification = true;
  await page.getByRole("dialog", { name: "Уведомления поддержки" }).getByRole("button", { name: "Открыть обращение" }).click();
  await expect.poll(() => state.notificationHeld).toBe(true);
  await page.goBack(); await expect(page).toHaveURL(previous);
  state.releaseNotification(); await expect(page.getByRole("dialog")).toBeHidden(); await expect(page).toHaveURL(previous);
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("conversation history keeps drafts and list filters while late A cannot replace B", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/admin?section=support&ticketId=${id(200)}&conversationId=${id(10)}`);
  await expect(page.getByRole("dialog")).toBeHidden(); await expect(page.getByText("История A", { exact: true })).toBeVisible();
  const message = page.getByRole("textbox", { name: "Сообщение", exact: true });
  await message.fill("Черновик A");
  await page.getByRole("button", { name: /DentalPro 11/ }).click(); await expect(page.getByText("История B", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("ticketId")).toBe(false);
  await message.fill("Черновик B");
  state.holdConversation = id(10); await page.goBack(); await expect.poll(() => state.conversationHeld).toBe(true);
  await expect(page.getByText("История B", { exact: true })).toHaveCount(0);
  await page.goForward(); await expect(page.getByText("История B", { exact: true })).toBeVisible(); await expect(message).toHaveValue("Черновик B");
  state.holdConversation = ""; state.releaseConversation();
  await page.goBack(); await expect(page.getByText("История A", { exact: true })).toBeVisible(); await expect(message).toHaveValue("Черновик A");
  await page.getByLabel("Показать", { exact: true }).selectOption("UNREAD");
  await page.getByRole("complementary", { name: "Список диалогов" }).getByRole("button", { name: "Далее" }).click();
  await expect(page).toHaveURL(/conversationOffset=30/); await page.reload();
  await expect(page.getByLabel("Показать", { exact: true })).toHaveValue("UNREAD");
  await expect.poll(() => state.reads.some(url => url.includes("/conversations?") && url.includes("offset=30") && url.includes("filter=UNREAD"))).toBe(true);
  await page.getByRole("button", { name: "Обращения", exact: true }).click();
  await expect(page.getByRole("region", { name: "Сообщения", exact: true })).toHaveCount(0);
  await page.goBack(); await expect(page.getByLabel("Показать", { exact: true })).toHaveValue("UNREAD");
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("invalid links show recovery and never request an invalid target", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin?section=orders&queueType=SUPPLIER_CONFIRMATION&object=invalid");
  await expect(page.getByText("В ссылке указаны недопустимые параметры. Откройте раздел заново.")).toBeVisible();
  expect(state.reads.some(url => url.startsWith("/operations/work-queue/"))).toBe(false);
  await page.getByRole("link", { name: "Обращения и споры", exact: true }).click();
  await expect(page.getByLabel("Поиск обращения")).toBeVisible();
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

for (const failure of [false, true]) test(`conversation pending send respects history target, failure=${failure}`, async ({ page }) => {
  const state = await fixture(page); state.failWrite = failure;
  await page.goto(`/admin?section=support&conversationId=${id(11)}`);
  await expect(page.getByText("История B", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /DentalPro 10/ }).click();
  const message = page.getByRole("textbox", { name: "Сообщение", exact: true });
  await message.fill("Сообщение A в пути");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect.poll(() => state.writeHeld).toBe(true);
  await page.goBack(); await expect(page.getByText("История B", { exact: true })).toBeVisible();
  state.releaseWrite(); await expect(message).toBeEnabled();
  await expect(page.getByText("История B", { exact: true })).toBeVisible();
  await expect(page.getByText("Отправка A запрещена", { exact: true })).toHaveCount(0);
  await page.goForward(); await expect(page.getByText("История A", { exact: true })).toBeVisible();
  await expect(message).toHaveValue(failure ? "Сообщение A в пути" : "");
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});
