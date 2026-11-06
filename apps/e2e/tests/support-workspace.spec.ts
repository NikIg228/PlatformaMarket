import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { SupportTicketDetail, UploadedSupportAttachment } from "@marketplace/schemas";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const organizationId = id(1), at = "2026-10-06T07:00:00.000Z";
const rights = ["support.ticket.view", "support.ticket.create", "notification.view"];
function ticket(value = 10): SupportTicketDetail {
  return { id: id(value), version: 1, number: `SUP-${value}`, organizationId, requesterId: id(2), assigneeId: null, subject: value === 10 ? "Не обновились остатки" : "Документы по заказу", description: "Загрузили файл, но данные ещё прежние.", status: "IN_PROGRESS", priority: "NORMAL", category: "TECHNICAL", slaDueAt: null, firstResponseAt: at, resolvedAt: null, closedAt: null, tags: [], createdAt: at, updatedAt: at,
    messages: [{ id: id(value + 100), ticketId: id(value), authorId: id(2), authorLabel: "Вы", body: "Загрузили файл, но данные ещё прежние.", isInternal: false, attachments: [], createdAt: at }, { id: id(value + 200), ticketId: id(value), authorId: id(3), authorLabel: "Поддержка", body: "Уточните, пожалуйста, название файла.", isInternal: false, attachments: [], createdAt: "2026-10-06T07:05:00.000Z" }], hasOlder: false, links: [] };
}
async function fixture(page: Page, role: "supplier" | "clinic" = "supplier", permissions = rights) {
  const state = { tickets: [ticket(), ticket(11)], assets: new Map<string, UploadedSupportAttachment>(), writes: [] as { path: string; body: Record<string, unknown> }[], queries: [] as string[], unexpected: [] as string[], failList: false, failDetail: false, failCreate: false, failReply: false, failUpload: false, failDownload: false, details: 0 };
  const contents = new Map<string, Buffer>();
  const attachments = (input: Record<string, unknown>) => ((input.attachments ?? []) as { assetId: string }[]).map(file => {
    const asset = state.assets.get(file.assetId); if (!asset) throw new Error("Attachment missing from fixture"); return asset;
  });
  const replay = new Map<string, unknown>();
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER";
  await page.addInitScript(({ capability, organizationId }) => sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "ui-fixture-not-real", accessTokenExpiresAt: Date.now() + 3_600_000 })), { capability, organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, "");
    const write = request.method() !== "GET", input = write ? request.postDataJSON() as Record<string, unknown> : {};
    if (write) state.writes.push({ path, body: input });
    const fail = (message: string, status = 503) => route.fulfill({ status, json: { code: "UNAVAILABLE", message } });
    let body: unknown;
    if (path === "/organizations") return route.fulfill({ json: [{ id: organizationId, capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path === "/auth/workspace-context") body = { organizationId, organizationDisplayName: "Тестовая организация", capabilities: [capability] };
    else if (path === "/auth/current" || path === "/auth/personal-current") body = null;
    else if (path === "/auth/workspaces") body = [{ organizationId, organizationDisplayName: "Тестовая организация", capabilities: [capability] }];
    else if (path === "/access-control/permissions") body = permissions;
    else if (path === "/access-control/policy") body = { mode: "ROLE_BASED", permissions };
    else if (path === "/operations/work-queue/assignees") body = [];
    else if (path === "/conversations") body = { items: [], hasMore: false, unreadCount: 0 };
    else if (path === "/catalog/cities") body = [{ id: id(4), nameRu: "Павлодар", nameKk: "Павлодар", isActive: true }];
    else if (path.startsWith("/notifications/")) body = { items: [], nextCursor: null, unreadCount: 0, asOf: at };
    else if (path === "/organizations/current/onboarding") body = { ready: true, capability, steps: [], organization: { organizationId, displayName: "Тестовая организация", complete: true, profile: {} } };
    else if (path === "/organizations/current/profile") body = { organizationId, legalName: "Тестовая организация", displayName: "Тестовая организация", bin: "970000000001", version: 1, canEdit: true, complete: true, profile: { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "fixture@example.invalid", legalAddress: { cityId: id(4), line1: "Тестовый адрес", postalCode: null }, deliveryAddress: { cityId: id(4), line1: "Тестовый адрес", postalCode: null } } };
    else if (path === "/support/attachments" && write) {
      if (state.failUpload) return fail("Проверка файла временно недоступна");
      const assetId = id(600 + state.writes.length), name = String(input.fileName), buffer = Buffer.from(String(input.contentBase64), "base64");
      const extension = name.split(".").at(-1)!;
      const contentType = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } as const)[extension as "png"];
      const asset = { assetId, name, contentType, sizeBytes: buffer.length, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
      state.assets.set(assetId, asset); contents.set(assetId, buffer); body = asset;
    } else if (/\/support\/tickets\/[^/]+\/messages\/[^/]+\/attachments\/[^/]+$/.test(path) && !write) {
      if (state.failDownload) return fail("Файл временно недоступен");
      const asset = state.assets.get(path.split("/").at(-1)!); if (!asset) return fail("File not found", 404);
      return route.fulfill({ body: contents.get(asset.assetId) ?? Buffer.from("%PDF-1.7"), contentType: asset.contentType, headers: { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}` } });
    } else if (path === "/support/tickets" && !write) {
      state.queries.push(url.search);
      if (state.failList) return fail("Список временно недоступен");
      const q = url.searchParams.get("q")?.toLowerCase(), status = url.searchParams.get("status"), offset = Number(url.searchParams.get("offset") ?? 0);
      body = state.tickets.map(row => { const last = row.messages.filter(message => !message.isInternal).at(-1); return { ...row, lastPublicMessage: last ? { body: last.body.slice(0, 240), hasAttachments: Boolean(last.attachments?.length), createdAt: last.createdAt } : null }; }).filter(row => (!q || `${row.subject} ${row.number}`.toLowerCase().includes(q)) && (!status || row.status === status)).slice(offset, offset + 50);
    } else if (path === "/support/tickets" && write) {
      body = replay.get(String(input.idempotencyKey));
      if (!body) { const row = { ...ticket(12), subject: String(input.subject), description: String(input.description), category: String(input.category), status: "OPEN" as const, firstResponseAt: null, messages: [{ ...ticket(12).messages[0], body: String(input.description), attachments: attachments(input) }] }; state.tickets.unshift(row); replay.set(String(input.idempotencyKey), row); body = row; }
      if (state.failCreate) return fail("Не удалось получить подтверждение. Повторите отправку.");
    } else if (path.startsWith("/support/tickets/")) {
      const row = state.tickets.find(value => value.id === path.split("/")[3]);
      if (!row) return fail("Обращение не найдено", 404);
      if (path.endsWith("/history") && !write) body = [];
      else if (!write) { state.details++; if (state.failDetail) return fail("Обращение временно недоступно"); body = row; }
      else if (path.endsWith("/messages")) {
        body = replay.get(String(input.idempotencyKey));
        if (!body) { const message = { ...row.messages[0], id: id(500 + state.writes.length), body: String(input.body), attachments: attachments(input), createdAt: new Date().toISOString() }; row.messages.push(message); if (input.reopen) row.status = "IN_PROGRESS"; replay.set(String(input.idempotencyKey), message); body = message; }
        if (state.failReply) return fail("Не удалось получить подтверждение ответа");
      } else return fail("Unexpected support write", 500);
    } else { state.unexpected.push(path); return fail(`Unexpected fixture route ${path}`, 500); }
    await route.fulfill({ json: body });
  });
  return state;
}
async function screenshot(page: Page, name: string) {
  await mkdir("output/playwright/support", { recursive: true });
  await page.screenshot({ path: `output/playwright/support/${name}.png`, fullPage: true, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

for (const width of [1440, 390]) test(`support first request validation and safe create retry ${width}`, async ({ page }) => {
  const state = await fixture(page); state.tickets = []; state.failCreate = true;
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/supplier/support");
  await expect(page.getByRole("heading", { name: "Новое обращение" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Список обращений" })).toHaveCount(0);
  await screenshot(page, `empty-${width}`);
  await page.getByRole("button", { name: "Отправить обращение", exact: true }).click();
  await expect(page.getByText("Укажите тему: не менее 4 символов.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Тема", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "Тема", exact: true }).fill("Ошибка загрузки остатков");
  await page.getByRole("textbox", { name: "Описание", exact: true }).fill("Файл принят, но остатки не изменились.");
  await page.getByRole("button", { name: "Отправить обращение", exact: true }).click();
  await expect(page.getByRole("alert").filter({hasText:"Текст не потерян"})).toContainText("Текст не потерян");
  await expect(page.getByRole("textbox", { name: "Описание", exact: true })).toHaveValue("Файл принят, но остатки не изменились.");
  page.once("dialog", dialog => dialog.accept()); await page.reload();
  await expect(page.getByRole("textbox", { name: "Описание", exact: true })).toHaveValue("Файл принят, но остатки не изменились.");
  state.failCreate = false; await page.getByRole("button", { name: "Отправить обращение", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`ticketId=${id(12)}`));
  await expect(page.getByRole("heading", { name: "Ошибка загрузки остатков", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[0].body.idempotencyKey).toBe(state.writes[1].body.idempotencyKey); expect(state.tickets).toHaveLength(1);
  expect(state.unexpected).toEqual([]); await screenshot(page, `created-${width}`);
});

for (const role of ["supplier", "clinic"] as const) test(`support ${role} list, authors, filters, deep links and protected drafts`, async ({ page }) => {
  const state = await fixture(page, role);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`/${role}/support?ticketId=${id(10)}`);
  await expect(page.getByRole("heading", { name: "Не обновились остатки" })).toBeVisible();
  const history = page.getByRole("list", { name: "Сообщения обращения" });
  await expect(history.getByText("Вы", { exact: true })).toBeVisible(); await expect(history.getByText("Поддержка", { exact: true })).toBeVisible();
  await screenshot(page, `${role}-conversation`);
  const reply = page.getByRole("textbox", { name: "Сообщение поддержке" }); await reply.fill("Сохраняемый черновик");
  const list = page.getByRole("complementary", { name: "Список обращений" });
  await list.getByRole("button", { name: /Документы по заказу/ }).click(); await expect(reply).toHaveValue("");
  await page.goBack(); await expect(reply).toHaveValue("Сохраняемый черновик");
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("link", { name: "Документы", exact: true }).click();
  await expect(reply).toHaveValue("Сохраняемый черновик");
  await page.getByRole("textbox", { name: "Поиск обращений" }).fill("SUP-11"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(list.getByRole("button", { name: /Не обновились остатки/ })).toHaveCount(0);
  await expect(list.getByRole("button", { name: /Документы по заказу/ })).toBeVisible();
  expect(state.queries.at(-1)).toContain("q=SUP-11");
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(list.getByRole("button", { name: /Не обновились остатки/ })).toBeVisible();
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("support mobile navigation and explicit reopen with reply replay", async ({ page }) => {
  const state = await fixture(page); state.tickets[0].status = "CLOSED"; state.failReply = true;
  await page.setViewportSize({ width: 390, height: 1000 }); await page.goto("/supplier/support");
  await page.getByRole("button", { name: /Не обновились остатки/ }).click();
  await expect(page.getByRole("complementary", { name: "Список обращений" })).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Сообщение поддержке" })).toHaveCount(0);
  await screenshot(page, "closed-mobile");
  await page.getByRole("button", { name: "Вопрос не решён" }).click();
  await page.getByRole("textbox", { name: "Что осталось нерешённым?" }).fill("Проблема сохранилась, проверьте ещё раз.");
  await page.getByRole("button", { name: "Отправить и открыть повторно" }).click();
  await expect(page.getByRole("alert").filter({hasText:"Текст не потерян"})).toContainText("Текст не потерян");
  // The first command committed, but its response was lost. A refresh now shows an active ticket.
  await expect.poll(() => state.details, { timeout: 20_000 }).toBeGreaterThan(state.details);
  await expect(page.getByRole("textbox", { name: "Сообщение поддержке" })).toHaveValue("Проблема сохранилась, проверьте ещё раз.");
  state.failReply = false; await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "снова в работе" })).toContainText("снова в работе");
  expect(state.writes[0].body).toEqual(expect.objectContaining({ reopen: true, isInternal: false }));
  expect(state.writes[0].body.idempotencyKey).toBe(state.writes[1].body.idempotencyKey);
  await page.getByRole("button", { name: "← К обращениям" }).click();
  await expect(page.getByRole("complementary", { name: "Список обращений" })).toBeVisible(); expect(state.unexpected).toEqual([]);
});

test("support load failure recovers without endless loading; read-only role cannot write", async ({ page }) => {
  const state = await fixture(page, "supplier", ["support.ticket.view", "notification.view"]); state.failDetail = true;
  await page.goto(`/supplier/support?ticketId=${id(10)}`);
  await expect(page.getByText("Не удалось обновить обращение")).toBeVisible();
  await expect(page.getByText("Загружаем обращение", { exact: true })).toHaveCount(0);
  state.failDetail = false; await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Не обновились остатки" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Сообщение поддержке" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Новое обращение" })).toHaveCount(0);
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("support denies the route before ticket reads without view permission", async ({ page }) => {
  const state = await fixture(page, "supplier", []); await page.goto("/supplier/support");
  await expect(page.getByText(/Этот раздел недоступен вашей роли/)).toBeVisible();
  expect(state.queries).toEqual([]); expect(state.details).toBe(0); expect(state.writes).toEqual([]);
});

test("support refresh shows new messages and preserves the reply draft", async ({ page }) => {
  const state = await fixture(page); await page.goto(`/supplier/support?ticketId=${id(10)}`);
  const reply = page.getByRole("textbox", { name: "Сообщение поддержке" }); await reply.fill("Название файла: остатки.csv");
  const row = state.tickets[0]; row.messages.push({ ...row.messages[1], id: id(901), body: "Проверка завершена, загрузите файл снова.", createdAt: "2026-10-06T07:10:00.000Z" });
  await expect.poll(() => state.details, { timeout: 20_000 }).toBeGreaterThan(state.details);
  await expect(page.getByRole("list", { name: "Сообщения обращения" }).getByText("Проверка завершена, загрузите файл снова.", { exact: true })).toBeVisible();
  await expect(reply).toHaveValue("Название файла: остатки.csv"); expect(state.unexpected).toEqual([]);
});

test("support scroll loads older tickets and server filters cover later pages", async ({ page }) => {
  const state = await fixture(page); state.tickets = Array.from({ length: 55 }, (_, index) => ({ ...ticket(1000 + index), subject: `Обращение ${index + 1}` }));
  await page.goto("/supplier/support");
  const list = page.getByRole("complementary", { name: "Список обращений" });
  await list.getByRole("button", { name: /Обращение 50 / }).scrollIntoViewIfNeeded();
  await expect(list.getByRole("button", { name: /Обращение 55 / })).toHaveCount(1);
  expect(state.queries.some(query => query.includes("offset=50"))).toBe(true);
  await page.getByRole("textbox", { name: "Поиск обращений" }).fill("SUP-1054"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(list.getByRole("button", { name: /Обращение 55 / })).toBeVisible();
  await expect(list.getByRole("button", { name: /Обращение 1 / })).toHaveCount(0);
  expect(state.queries.at(-1)).toContain("offset=0"); expect(state.unexpected).toEqual([]);
});

test("support background refresh preserves scroll and offers a new-message jump", async ({ page }) => {
  const state = await fixture(page); const row = state.tickets[0];
  row.messages = Array.from({ length: 12 }, (_, index) => ({ ...row.messages[index % 2], id: id(1200 + index), body: `Сообщение ${index + 1}. ${"Подробности обращения. ".repeat(12)}`, createdAt: new Date(Date.parse(at) + index * 60_000).toISOString() }));
  await page.goto(`/supplier/support?ticketId=${id(10)}`);
  const history = page.getByRole("list", { name: "Сообщения обращения" }); await expect(history.getByText(/^Сообщение \d+\./)).toHaveCount(12);
  await expect.poll(() => history.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await history.evaluate(element => { element.scrollTop = 0; });
  await expect.poll(() => history.evaluate(element => element.scrollTop)).toBe(0);
  const readsBefore = state.details;
  row.messages.push({ ...row.messages[1], id: id(1300), body: "Новый ответ оператора", createdAt: "2026-10-06T08:00:00.000Z" });
  // Exercise the real 15-second poll: installing a clock after mount does not
  // control the intervals already created by the resource hook.
  await expect.poll(() => state.details, { timeout: 20_000 }).toBeGreaterThan(readsBefore);
  await expect(page.getByRole("button", { name: /Новые сообщения/ })).toBeVisible();
  await expect(page.locator("[aria-live=polite]").filter({ hasText: "Получены новые сообщения" })).toContainText("1");
  expect(await history.evaluate(element => element.scrollTop)).toBeLessThan(10);
  await page.getByRole("button", { name: /Новые сообщения/ }).click(); await expect(history.getByText("Новый ответ оператора", { exact: true })).toBeInViewport();
  expect(state.unexpected).toEqual([]);
});

const pngFile = { name: "Снимок.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") };
for (const [role, width] of [["supplier", 1440], ["clinic", 390]] as const) test(`support attachments ${role}: first ticket, preview, download and file-only retry ${width}`, async ({ page }) => {
  const state = await fixture(page, role); state.tickets = [];
  await page.setViewportSize({ width, height: 1000 }); await page.goto(`/${role}/support`);
  await page.getByRole("textbox", { name: "Тема", exact: true }).fill("Вопрос по доставке");
  await page.getByRole("textbox", { name: "Описание", exact: true }).fill("Здравствуйте! Подскажите, как изменить адрес доставки в заказе?");
  const selection = [pngFile, ...["Фото.jpg", "Фото.jpeg", "Заказ.pdf", "Заявление.docx", "Список.xlsx"].map(name => ({ name, mimeType: "application/octet-stream", buffer: Buffer.from("synthetic file bytes") }))];
  await page.getByLabel("Файлы обращения").setInputFiles(selection);
  await expect(page.getByRole("button", { name: "Убрать Список.xlsx", exact: true })).toBeEnabled();
  await expect(page.getByRole("list", { name: "Прикреплённые файлы", exact: true }).getByRole("listitem")).toHaveCount(6);
  await page.getByRole("button", { name: "Убрать Фото.jpeg", exact: true }).click();
  await page.getByRole("button", { name: "Отправить обращение", exact: true }).click();
  await expect(page.getByText("Обращение отправлено", { exact: true })).toBeVisible();
  await expect(page.getByText("Дополнение к обращению", { exact: true })).toHaveCount(0);
  const reply = page.getByRole("textbox", { name: "Сообщение поддержке", exact: true });
  await expect(reply).toBeVisible(); await expect(reply).toHaveCSS("resize", "none");
  await screenshot(page, `attachments-${role}-${width}`);
  const preview = page.getByRole("button", { name: "Посмотреть Снимок.png", exact: true });
  await preview.click();
  const dialog = page.getByRole("dialog", { name: "Снимок.png", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Снимок.png", exact: true })).toBeVisible();
  await expect.poll(() => dialog.getByRole("img", { name: "Снимок.png", exact: true }).evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect(preview).toBeFocused();
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Скачать Заказ.pdf", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("Заказ.pdf");
  const first = state.tickets[0].messages[0]; expect(first.attachments).toHaveLength(5);
  await page.getByLabel("Файлы обращения").setInputFiles({ name: "Дополнение.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
  await expect(page.getByRole("button", { name: "Убрать Дополнение.pdf", exact: true })).toBeEnabled();
  state.failReply = true; await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("alert").filter({hasText:"Текст не потерян"})).toContainText("Текст не потерян");
  page.once("dialog", dialog => dialog.accept()); await page.reload();
  await expect(page.getByRole("button", { name: "Убрать Дополнение.pdf", exact: true })).toBeVisible();
  state.failReply = false; await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Убрать Дополнение.pdf", exact: true })).toHaveCount(0);
  const writes = state.writes.filter(write => write.path.endsWith("/messages"));
  expect(writes).toHaveLength(2); expect(writes[0].body).toEqual(writes[1].body); expect(writes[0].body.body).toBe("");
  expect(state.tickets[0].messages).toHaveLength(2); expect(state.unexpected).toEqual([]);
});

test("support attachments: invalid input, scanner recovery, remove and download recovery", async ({ page }) => {
  const state = await fixture(page); await page.goto(`/supplier/support?ticketId=${id(10)}`);
  const input = page.getByLabel("Файлы обращения");
  await input.setInputFiles({ name: "danger.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await expect(page.getByText(/выберите PNG, JPG, PDF/)).toBeVisible(); expect(state.writes).toHaveLength(0);
  await input.setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10_000_001, 65) });
  await expect(page.getByText(/«big.pdf»/)).toBeVisible(); expect(state.writes).toHaveLength(0);
  state.failUpload = true;
  const choose = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Прикрепить файл", exact: true }).focus(); await page.keyboard.press("Enter");
  await (await choose).setFiles(pngFile);
  await expect(page.getByText("Проверка файла временно недоступна", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отправить", exact: true })).toBeDisabled();
  state.failUpload = false; await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Отправить", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  state.failDownload = true; await page.getByRole("button", { name: "Посмотреть Снимок.png", exact: true }).click();
  await expect(page.getByText(/Файл временно недоступен/)).toBeVisible();
  state.failDownload = false; await page.getByRole("button", { name: "Посмотреть Снимок.png", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Снимок.png" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Снимок.png" }).getByRole("button", { name: "Закрыть окно", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Снимок.png" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Сообщение поддержке" }).fill("Сохранённый текст");
  await input.setInputFiles({ name: "remove.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
  await expect(page.getByRole("button", { name: "Убрать remove.pdf" })).toBeEnabled(); await page.getByRole("button", { name: "Убрать remove.pdf" }).click();
  await expect(page.getByRole("textbox", { name: "Сообщение поддержке" })).toHaveValue("Сохранённый текст");
  await input.setInputFiles({ name: "Повреждённое.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  await expect(page.getByRole("button", { name: "Убрать Повреждённое.png" })).toBeEnabled();
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await page.getByRole("button", { name: "Посмотреть Повреждённое.png" }).click();
  await expect(page.getByRole("alert").filter({hasText:"Не удалось показать изображение"})).toContainText("Не удалось показать изображение");
  await page.keyboard.press("Escape");
  expect(state.unexpected).toEqual([]);
});

test("support operator toast preserves failed reply and announces recovery", async ({ page }) => {
  const state = await fixture(page, "supplier", [...rights, "support.ticket.manage"]); state.failReply = true;
  await page.addInitScript(() => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "operator-support-fixture", sessionId: "10000000-0000-4000-8000-000000000001", user: { id: "20000000-0000-4000-8000-000000000001" }, expiresAt: Date.now() + 3600000, activeOrganizationId: "00000000-0000-4000-8000-000000000001" })));
  await page.goto("/admin?section=support");
  await page.getByRole("button", { name: "Открыть обращение", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: /SUP-10/ }); const field = dialog.getByRole("textbox", {name:"Ответ", exact:true});
  await field.fill("Проверили данные, уточните номер поставки.");
  await dialog.getByRole("button", {name:"Отправить ответ",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Не удалось получить подтверждение ответа"})).toBeVisible();
  await expect(field).toHaveValue("Проверили данные, уточните номер поставки.");
  await page.getByRole("button", {name:"Закрыть уведомление",exact:true}).click();
  state.failReply = false; await dialog.getByRole("button", {name:"Отправить ответ",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Ответ сохранён"})).toBeVisible(); await expect(field).toHaveValue("");
  expect(state.writes[0].body.idempotencyKey).toBe(state.writes[1].body.idempotencyKey); expect(state.unexpected).toEqual([]);
});

test("support attachments: operator can download customer files", async ({ page }) => {
  const state = await fixture(page, "supplier", [...rights, "support.ticket.manage"]);
  const asset = { assetId: id(999), name: "Документ.pdf", contentType: "application/pdf" as const, sizeBytes: 8, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
  state.assets.set(asset.assetId, asset); state.tickets[0].messages[0].attachments = [asset];
  await page.addInitScript(() => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "operator-support-fixture", sessionId: "10000000-0000-4000-8000-000000000001", user: { id: "20000000-0000-4000-8000-000000000001" }, expiresAt: Date.now() + 3600000, activeOrganizationId: "00000000-0000-4000-8000-000000000001" })));
  await page.goto("/admin?section=support");
  await page.getByRole("button", { name: "Открыть обращение", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: /SUP-10/ }); await expect(dialog).toBeVisible();
  const downloadPromise = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Скачать Документ.pdf" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("Документ.pdf");
  await screenshot(page, "attachments-operator"); expect(state.unexpected).toEqual([]);
});

for (const width of [1440, 390]) test(`support compact page: dismiss success and retain conversation space ${width}`, async ({ page }) => {
  const state = await fixture(page); state.tickets = [];
  await page.setViewportSize({ width, height: 800 }); await page.goto("/supplier/support");
  await page.getByRole("textbox", { name: "Тема", exact: true }).fill("Заказ и доставка");
  await page.getByRole("textbox", { name: "Описание", exact: true }).fill("Подскажите срок доставки моего заказа.");
  await page.getByRole("button", { name: "Отправить обращение", exact: true }).click();
  await expect(page.getByText("Обращение отправлено", { exact: true })).toBeVisible();
  const close = page.getByRole("button", { name: "Закрыть уведомление" });
  await close.focus(); await page.keyboard.press("Enter");
  await expect(close).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Обновить переписку|Обновить список/ })).toHaveCount(0);
  const reply = page.getByRole("textbox", { name: "Сообщение поддержке" });
  await reply.fill("Спасибо, жду уточнения.");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(reply).toHaveValue("");
  await expect(page.getByText("Сообщение отправлено.", { exact: true })).toBeVisible();
  await expect(close).toHaveCount(0, { timeout: 8_000 });
  const history = page.getByRole("list", { name: "Сообщения обращения" });
  expect((await history.boundingBox())!.height).toBeGreaterThan(350);
  await expect(page.getByRole("button", { name: "Отправить", exact: true })).toBeInViewport();
  await screenshot(page, `compact-${width}`);
  await page.reload(); await expect(reply).toBeVisible();
  await expect(page.getByText("Обращение отправлено", { exact: true })).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

for (const [role, width, height, lang] of [["supplier", 1440, 900, "ru"], ["supplier", 390, 844, "kk"], ["clinic", 844, 390, "kk"]] as const) test(`support audit geometry locale focus ${role} ${width} ${lang}`, async ({ page }) => {
  const state = await fixture(page, role);
  const subject = "Очень длинная тема без сокращений ".repeat(6);
  state.tickets[0].subject = subject;
  await page.setViewportSize({ width, height });
  await page.goto(`/${role}/support?lang=${lang}`);
  const listName = lang === "kk" ? "Өтініштер тізімі" : "Список обращений";
  const list = page.getByRole("complementary", { name: listName });
  const card = list.getByRole("button", { name: /Очень длинная тема/ });
  await expect(card).toContainText("Уточните, пожалуйста, название файла.");
  if (lang === "kk") {
    await page.getByRole("textbox", { name: "Өтініштерді іздеу" }).fill("SUP-10");
    await page.getByRole("button", { name: "Іздеу", exact: true }).click();
    await expect(card).toBeVisible();
    await page.getByRole("button", { name: "Іздеуді тазарту" }).click();
  }
  expect(await card.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await card.click();
  await expect(page.getByRole("heading", { name: subject.trim() })).toBeFocused();
  const history = page.getByRole("list", { name: lang === "kk" ? "Өтініш хабарламалары" : "Сообщения обращения" });
  await expect(history.getByText(lang === "kk" ? "Сіз" : "Вы", { exact: true })).toBeVisible();
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 1);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(height + 1);
  await screenshot(page, `audit-${role}-${width}-${lang}`);
  if (width < 761) {
    await page.getByRole("button", { name: "← Өтініштерге", exact: true }).click();
    await expect(card).toBeFocused();
  }
  await page.getByRole("button", { name: lang === "kk" ? "Жаңа өтініш" : "Новое обращение", exact: true }).click();
  await expect(page.getByRole("heading", { name: lang === "kk" ? "Жаңа өтініш" : "Новое обращение", exact: true })).toBeFocused();
  await page.getByRole("button", { name: lang === "kk" ? "Өтінішті жіберу" : "Отправить обращение", exact: true }).click();
  await expect(page.getByRole("textbox", { name: lang === "kk" ? "Тақырып" : "Тема", exact: true })).toBeFocused();
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("support audit unavailable link stays explained and stops polling", async ({ page }) => {
  await page.clock.install();
  const state = await fixture(page);
  let rejected = 0;
  await page.route("**/api/support/tickets/not-a-ticket", route => { rejected++; return route.fulfill({ status: 400, json: { code: "INVALID_INPUT", message: "Invalid message query" } }); });
  await page.goto("/supplier/support?ticketId=not-a-ticket&lang=kk");
  await expect(page.getByText("Өтініш қолжетімсіз", { exact: true })).toBeVisible();
  await expect(page.getByText("Сілтемені тексеріңіз немесе тізімнен басқа өтінішті таңдаңыз.")).toBeVisible();
  const before = rejected; await page.clock.fastForward(60_000);
  expect(rejected).toBe(before);
  await expect(page.getByRole("button", { name: "Қайта жүктеу", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Өтініштерге", exact: true }).click();
  await expect(page).not.toHaveURL(/ticketId=/);
  expect(state.writes).toEqual([]);
});

test("support low-height clinic keeps reply reachable inside the panel", async ({ page }) => {
  const state = await fixture(page, "clinic");
  state.tickets[0].subject = "Очень длинная тема без сокращений ".repeat(6);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(`/clinic/support?ticketId=${id(10)}&lang=kk`);
  const reply = page.getByRole("textbox", { name: "Қолдау қызметіне хабарлама" });
  await reply.scrollIntoViewIfNeeded();
  await expect(reply).toBeInViewport();
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
  await expect(reply).toBeFocused();
  await expect(page.getByText("Хабарлама енгізіңіз немесе файл тіркеңіз.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await screenshot(page, "audit-clinic-low-height-reply");
  expect(state.writes).toEqual([]);
});

for (const width of [1536, 1024, 390]) test(`support fills available width in every navigation state ${width}`, async ({ page }) => {
  const state = await fixture(page);
  await page.setViewportSize({ width, height: 844 });
  const fills = async () => {
    await expect.poll(() => page.locator("main").evaluate(e => Math.abs(e.getBoundingClientRect().right - innerWidth))).toBeLessThanOrEqual(1);
    expect(await page.locator("main").evaluate(e => e.getBoundingClientRect().left)).toBe(width > 760 ? 200 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  };
  await page.goto("/supplier/support");
  await expect(page.getByRole("heading", { name: "Мои обращения" })).toBeVisible();
  await fills(); await screenshot(page, `width-list-${width}`);
  await page.getByRole("button", { name: /Не обновились остатки/ }).click();
  await expect(page.getByRole("heading", { name: "Не обновились остатки" })).toBeVisible();
  await fills();
  if (width < 761) await page.getByRole("button", { name: "← К обращениям" }).click();
  await page.getByRole("button", { name: "Новое обращение", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Новое обращение" })).toBeVisible();
  await fills();
  await page.getByRole("button", { name: "К обращениям", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Мои обращения" })).toBeFocused();
  await fills();
  state.tickets = []; await page.reload();
  await expect(page.getByRole("heading", { name: "Новое обращение" })).toBeVisible();
  await fills();
  expect(state.writes).toEqual([]);
});
for (const [width, height] of [[1440, 360], [390, 844]]) test(`support dense list keeps each status within its own row ${width}`, async ({ page }) => {
  const state = await fixture(page);
  state.tickets = Array.from({ length: 55 }, (_, index) => ({ ...ticket(1000 + index), subject: `Обращение ${index + 1}` }));
  await page.setViewportSize({ width, height }); await page.goto('/supplier/support');
  const rows = page.locator('button[aria-pressed]'); await expect(rows).toHaveCount(50);
  const overlapping = await rows.evaluateAll(elements => elements.filter(element => {
    const bounds = element.getBoundingClientRect();
    return Array.from(element.children).some(child => { const box = child.getBoundingClientRect(); return box.bottom > bounds.bottom + 1 || box.top < bounds.top; });
  }).length);
  expect(overlapping).toBe(0);
  const last = page.getByRole('button', { name: /Обращение 50 / });
  await last.scrollIntoViewIfNeeded(); await expect(last).toBeInViewport();
  await last.click(); await expect(page.locator('main h2').filter({ hasText: 'Обращение 50' })).toBeVisible();
});
for (const role of ['supplier', 'clinic'] as const) for (const locale of ['ru', 'kk'] as const) for (const width of [1440, 390]) test(`support remaining findings ${role} ${locale} ${width}`, async ({ page }) => {
  const state = await fixture(page, role); state.failList = true;
  state.tickets[0].messages = Array.from({ length: 12 }, (_, index) => ({ ...state.tickets[0].messages[index % 2], id: id(2000 + index), body: `Сообщение ${index + 1}. ${'Подробности обращения. '.repeat(12)}`, createdAt: new Date(Date.parse(at) + index * 60_000).toISOString() }));
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.goto(`/${role}/support?lang=${locale}`);
  const failure = page.getByRole('alert').filter({ hasText: locale === 'kk' ? 'Өтініштерді жүктеу мүмкін болмады' : 'Не удалось загрузить обращения' });
  await expect(failure).toBeVisible();
  expect(await failure.locator('.dm-feedback-copy').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(150);
  const retry = page.getByRole('button', { name: locale === 'kk' ? 'Тізімді қайта жүктеу' : 'Повторить загрузку списка' });
  await retry.scrollIntoViewIfNeeded(); await expect(retry).toBeInViewport();
  if (role === 'clinic') {
    await expect(page.getByRole('combobox', { name: locale === 'kk' ? 'Сатып алушы' : 'Покупатель', exact: true })).toBeVisible();
    await expect(page.getByText(locale === 'kk' ? 'Ұйым атынан сатып алу. Төлеушінің тұлғасы сатып алушыны өзгертпейді.' : 'Покупка от организации. Личность плательщика не меняет покупателя.', { exact: true })).toBeVisible();
  }
  const capture = async (name: string) => {
    await mkdir('.tmp/support-remaining-fixes-20261106/screens', { recursive: true });
    await page.screenshot({ path: `.tmp/support-remaining-fixes-20261106/screens/${role}-${locale}-${width}-${name}.png`, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  };
  await capture('list-error'); state.failList = false; await retry.click();
  await page.getByRole('button', { name: /Не обновились остатки/ }).click();
  const history = page.getByRole('list', { name: locale === 'kk' ? 'Өтініш хабарламалары' : 'Сообщения обращения' });
  await expect(history.getByText(/^Сообщение 12\./)).toBeInViewport(); await capture('history-bottom');
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'invalid.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  const invalid = page.getByRole('alert').filter({ hasText: 'invalid.exe' });
  await expect(invalid.locator('strong')).toHaveText(locale === 'kk' ? 'Қате' : 'Ошибка'); await capture('file-error');
  await input.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  const send = page.locator('button[type=submit]'); await expect(send).toBeEnabled(); await send.click();
  const preview = page.getByRole('button', { name: locale === 'kk' ? 'Қарау broken.png' : 'Посмотреть broken.png', exact: true });
  await preview.click();
  const dialog = page.getByRole('dialog', { name: 'broken.png', exact: true });
  const explanation = dialog.getByRole('alert'); await expect(explanation).toContainText(locale === 'kk' ? 'құрылғыда ашу үшін файлды жүктеп алыңыз' : 'скачайте файл, чтобы открыть его на устройстве');
  // The explanation must outlive transient action notices while the dialog stays open.
  await page.waitForTimeout(5500); await expect(explanation).toBeVisible(); await capture('broken-preview');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(preview).toBeFocused();
  expect(state.unexpected).toEqual([]);
});
for (const width of [1440, 390]) test(`support prepended history preserves reading position ${width}`, async ({ page }) => {
  const state = await fixture(page), row = state.tickets[0];
  row.messages = Array.from({ length: 12 }, (_, index) => ({ ...ticket().messages[index % 2], id: id(3000 + index), body: `Текущее сообщение ${index + 1}. ${'Подробности. '.repeat(30)}`, createdAt: new Date(Date.parse(at) + index * 60_000).toISOString() })); row.hasOlder = true;
  await page.route('**/api/support/tickets/*?beforeMessageId=*', route => route.fulfill({ json: { ...row, hasOlder: false, messages: Array.from({ length: 4 }, (_, index) => ({ ...row.messages[0], id: id(2900 + index), body: `Раннее сообщение ${index + 1}. ${'Детали. '.repeat(30)}`, createdAt: new Date(Date.parse(at) - (4 - index) * 60_000).toISOString() })) } }));
  await page.setViewportSize({ width, height: 844 }); await page.goto(`/supplier/support?ticketId=${id(10)}`);
  const history = page.getByRole('list', { name: 'Сообщения обращения' }); await expect(history.getByText(/^Текущее сообщение 12\./)).toBeInViewport();
  await history.evaluate(element => { element.scrollTop = 120; });
  const anchor = history.getByText(/^Текущее сообщение 1\./);
  const position = () => anchor.evaluate(element => { const list = element.closest('ol')!; return element.getBoundingClientRect().top - list.getBoundingClientRect().top; });
  const before = await position(); await page.getByRole('button', { name: 'Показать ранние сообщения' }).click();
  await expect(history.getByText(/^Раннее сообщение/)).toHaveCount(4);
  // scrollHeight is rounded while message line boxes can have fractional pixels.
  await expect.poll(async () => Math.abs(await position() - before)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: 'Показать ранние сообщения' })).toHaveCount(0);
});
for (const width of [1440, 390]) test(`support first request preserves Kazakh locale ${width}`, async ({ page }) => {
  const state = await fixture(page, 'clinic'); state.tickets = [];
  await page.setViewportSize({ width, height: 844 }); await page.goto('/clinic/support?lang=kk');
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('new');
  expect(new URL(page.url()).searchParams.get('lang')).toBe('kk');
  await expect(page.getByRole('heading', { name: 'Жаңа өтініш', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Өтінішті жіберу', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
