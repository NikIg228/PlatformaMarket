import { test, expect, type Page } from "@playwright/test";
const organizationId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const ids = [1, 2, 3, 4].map(n => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`);
async function fixture(page: Page, role: "clinic" | "supplier", canReview = true) {
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER";
  const state = { listFail: false, detailFail: false, relatedFail: false, uploadFail: true, accountingFail: true, calls: [] as string[], writes: [] as Record<string, unknown>[], unexpected: [] as string[] };
  const docs = ids.map((id, n) => ({ id, ownerOrganizationId: organizationId, category: n === 0 ? "PAYMENT" : "CLOSING", kind: n === 0 ? "INVOICE" : "WAYBILL", format: "PDF", source: "GENERATED", status: ["GENERATED", "AWAITING_SIGNATURE", "ARCHIVED", "PARTIALLY_SIGNED"][n], accountingStatus: n === 0 ? "PENDING_REVIEW" : "NOT_APPLICABLE", title: ["Счёт № 1048", "Накладная № 0621", "Акт № 0314", "Спецификация № 0182"][n], documentNumber: `DOC-${n + 1}`, documentDate: "2026-10-08T06:00:00Z", amountMinor: "14850000", currency: "KZT", version: 1, fileName: "document.pdf", checksumSha256: null, immutableAt: null, generatedAt: null, expiresAt: null, updatedAt: "2026-10-08T06:00:00Z", supplierOrder: { id: orderId, orderNumber: "SO-1048", paymentStatus: "PAID" }, participants: [{ organizationId: otherId, role: "RECIPIENT", organization: { id: otherId, displayName: role === "clinic" ? "Демо Поставщик" : "Демо Клиника", legalName: "Демо контрагент", bin: "000000000002" } }], signatures: [], versions: [{ id, version: 1, status: "GENERATED", documentDate: "2026-10-08T06:00:00Z", createdAt: "2026-10-08T06:00:00Z" }] }));
  await page.addInitScript(({ capability, organizationId }) => sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId, actorId: organizationId, sessionId: organizationId, accessToken: "synthetic-ui-fixture", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Тестовый сотрудник", organizationDisplayName: "Демо организация" })), { capability, organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, ""); state.calls.push(`${request.method()} ${path}${url.search}`);
    const fail = () => route.fulfill({ status: 503, json: { code: "FIXTURE_ERROR", message: "Сервис временно недоступен" } });
    if (request.method() === "PATCH" && path.endsWith("/accounting-status")) { const body = request.postDataJSON(); state.writes.push(body); if (state.accountingFail) return fail(); docs[0].accountingStatus = body.status; return route.fulfill({ json: docs[0] }); }
    if (request.method() === "POST" && path === "/documents/upload") { state.writes.push(request.postDataJSON()); return state.uploadFail ? fail() : route.fulfill({ json: docs[0] }); }
    if (path === "/documents/archive/summary") return route.fulfill({ json: { total: 4, awaitingSignature: 2, attention: 1, thisMonth: 4, byCategory: {} } });
    if (path === "/documents/archive") {
      if (url.searchParams.has("supplierOrderId")) return state.relatedFail ? fail() : route.fulfill({ json: { items: [docs[0], docs[3]], nextCursor: null } });
      if (state.listFail) return fail();
      let items = docs;
      const view = url.searchParams.get("view"), q = url.searchParams.get("q");
      if (view === "AWAITING_SIGNATURE") items = [docs[1], docs[3]];
      if (view === "ATTENTION") items = [docs[0]];
      if (view === "ARCHIVED") items = [docs[2]];
      if (q === "missing") items = [];
      if (url.searchParams.get("limit") === "100") return route.fulfill({ json: { items: docs, nextCursor: null } });
      if (url.searchParams.has("cursor")) return route.fulfill({ json: { items: [docs[2]], nextCursor: null } });
      return route.fulfill({ json: { items: items.slice(0, 2), nextCursor: !view && !q ? ids[1] : null } });
    }
    if (path.startsWith("/documents/archive/")) return state.detailFail ? fail() : route.fulfill({ json: docs.find(doc => path.endsWith(doc.id)) ?? docs[0] });
    if (/\/documents\/[^/]+\/download$/.test(path)) return route.fulfill({ contentType: "application/pdf", headers: { "content-disposition": 'attachment; filename="document.pdf"' }, body: "%PDF-1.4 fixture" });
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId, organizationDisplayName: "Демо организация", capabilities: [capability] } });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: ["organization.view", "document.view", "document.upload", ...(canReview ? ["document.accounting.review"] : [])] } });
    if (path === "/auth/current") return route.fulfill({ json: url.searchParams.has("workspace") ? { sessionId: organizationId, user: { id: organizationId, displayName: "Тестовый сотрудник", email: "test@example.invalid" } } : null });
    if (path === "/auth/profile") return route.fulfill({ json: { id: organizationId, displayName: "Тестовый сотрудник", email: "test@example.invalid", phone: "+77000000000", avatarAssetId: null, version: 1 } });
    if (path === "/organizations/current/profile") return route.fulfill({ json: { organizationId, legalName: "Демо организация", displayName: "Демо организация", bin: "000000000001", version: 1, complete: true, canEdit: false, profile: { contactName: "Сотрудник", phone: "+77000000000", email: "test@example.invalid", legalAddress: { cityId: orderId, line1: "Улица 1" }, deliveryAddress: { cityId: orderId, line1: "Улица 1" } } } });
    if (path === "/conversations") return route.fulfill({ json: { items: [], hasMore: false, unreadCount: 0 } });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: orderId, nameRu: "Алматы", nameKk: "Алматы", isActive: true }] });
    if (path.startsWith("/notifications/organizations/")) return route.fulfill({ json: { items: [], unreadCount: 0, hasMore: false, nextCursor: null } });
    if (path === "/supplier-orders" || path === `/buyers/${organizationId}/orders`) return route.fulfill({ json: [] });
    if (path === "/supplier-terms/current") return route.fulfill({ json: { contractAccepted: true, admitted: true, legacyAgreementActive: false, acceptance: null } });
    state.unexpected.push(`${request.method()} ${path}`); return fail();
  });
  return state;
}
for (const role of ["clinic", "supplier"] as const) for (const width of [1440, 390]) test(`documents registry ${role} layout and related ${width}`, async ({ page }, info) => {
  const state = await fixture(page, role); await page.setViewportSize({ width, height: 1000 }); await page.goto(`/${role}/documents`);
  await expect(page.getByRole("heading", { name: role === "clinic" ? "Документы по закупкам" : "Документы по продажам" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Счёт № 1048/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`registry-${role}-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const passport = await page.getByRole("button", { name: "Загрузить документ", exact: true }).evaluate(el => { const css = getComputedStyle(el); return { height: el.getBoundingClientRect().height, radius: css.borderRadius, font: css.fontSize }; }); expect(passport.height).toBeGreaterThanOrEqual(44); expect(passport.radius).toBe("8px"); expect(passport.font).toBe("14px");
  const opener = page.getByRole("button", { name: /^Счёт № 1048/ }); await opener.focus(); await page.keyboard.press("Enter");
  const panel = width === 390 ? page.getByRole("dialog") : page.getByRole("region", { name: "Карточка документа" });
  await expect(panel.getByRole("heading", { name: "Связанные документы" })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Спецификация № 0182/ })).toBeVisible();
  expect(state.calls.some(call => call.includes(`supplierOrderId=${orderId}`))).toBe(true);
  await page.screenshot({ path: info.outputPath(`detail-${role}-${width}.png`), fullPage: true });
  await panel.getByRole("button", { name: /Спецификация № 0182/ }).click(); await expect(panel.getByRole("heading", { name: "Спецификация № 0182", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Закрыть документ" }).click(); await expect(opener).toBeFocused();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Скачать Счёт № 1048", exact: true }).click(); expect((await download).suggestedFilename()).toBe("document.pdf");
  expect(state.unexpected).toEqual([]);
});
test("documents registry filters, pagination, empty and list recovery", async ({ page }) => {
  const state = await fixture(page, "supplier"); state.listFail = true; await page.goto("/supplier/documents");
  await expect(page.getByRole("button", { name: "Повторить", exact: true })).toBeVisible(); state.listFail = false; await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Счёт № 1048/ })).toBeVisible();
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click(); await expect(page.getByRole("button", { name: /^Акт № 0314/ })).toBeVisible();
  await page.getByRole("button", { name: /^Ожидают подписи/ }).click(); await expect(page.getByRole("button", { name: /^Спецификация № 0182/ })).toBeVisible(); expect(state.calls.some(call => call.includes("view=AWAITING_SIGNATURE"))).toBe(true);
  await page.getByRole("button", { name: /^Требуют внимания/ }).click(); await expect(page.getByRole("button", { name: /^Счёт № 1048/ })).toBeVisible();
  await page.getByRole("button", { name: "Архив", exact: true }).click(); await expect(page.getByRole("button", { name: /^Акт № 0314/ })).toBeVisible();
  await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
  const counterparty = page.getByRole("combobox", { name: "Все клиники", exact: true }); await counterparty.click(); await page.getByRole("option", { name: "Демо Клиника", exact: true }).click();
  await expect.poll(() => state.calls.some(call => call.includes(`counterpartyOrganizationId=${otherId}`))).toBe(true);
  await page.getByRole("button", { name: "Период", exact: true }).click(); await page.getByLabel("С даты", { exact: true }).fill("2026-10-09"); await page.getByLabel("По дату", { exact: true }).fill("2026-10-08"); await page.getByRole("button", { name: "Применить", exact: true }).click(); await expect(page.getByRole("alert").filter({ hasText: /дата|Дата|период/i })).toBeVisible();
  await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click(); const search = page.getByRole("textbox", { name: "Поиск документов" }); await search.fill("missing"); await search.press("Enter"); await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
  expect(state.unexpected).toEqual([]);
});
test("documents detail retry and accounting draft recovery", async ({ page }) => {
  const state = await fixture(page, "supplier"); state.detailFail = true; await page.goto(`/supplier/documents?documentId=${ids[0]}`);
  const panel = page.getByRole("region", { name: "Карточка документа" }); await expect(panel.getByRole("button", { name: "Повторить загрузку документа" })).toBeVisible(); state.detailFail = false; state.relatedFail = true; await panel.getByRole("button", { name: "Повторить загрузку документа" }).click();
  await expect(panel.getByRole("button", { name: "Повторить", exact: true })).toBeVisible(); state.relatedFail = false; await panel.getByRole("button", { name: "Повторить", exact: true }).click(); await expect(panel.getByRole("button", { name: /Спецификация/ })).toBeVisible();
  await panel.getByText("Бухгалтерская обработка", { exact: true }).click(); await panel.getByLabel("Основание изменения").fill("Проверено бухгалтером"); await panel.getByRole("button", { name: "Сохранить отметку" }).click(); await expect(panel.getByRole("alert")).toContainText("Сервис временно недоступен"); await expect(panel.getByLabel("Основание изменения")).toHaveValue("Проверено бухгалтером");
  state.accountingFail = false; await panel.getByRole("button", { name: "Сохранить отметку" }).click(); await expect(panel.getByRole("status")).toContainText("Бухгалтерская отметка сохранена"); expect(state.writes.at(-1)).toMatchObject({ reason: "Проверено бухгалтером", expectedUpdatedAt: "2026-10-08T06:00:00Z" });
  expect(state.unexpected).toEqual([]);
});
test("documents upload retains file draft and retry, read role hides accounting", async ({ page }) => {
  const state = await fixture(page, "clinic", false); await page.goto(`/clinic/documents?documentId=${ids[0]}`); const panel = page.getByRole("region", { name: "Карточка документа" }); await expect(panel.getByRole("heading", { name: "Связанные документы" })).toBeVisible(); await expect(panel.getByText("Бухгалтерская обработка")).toHaveCount(0); await panel.getByRole("button", { name: "Закрыть документ" }).click();
  await page.getByRole("button", { name: "Загрузить документ", exact: true }).click(); const dialog = page.getByRole("dialog"); await dialog.getByLabel("Тип документа").selectOption("OTHER"); await dialog.getByLabel(/^Название/).fill("Тестовый документ"); await dialog.getByLabel(/^Номер/).fill("TEST-1"); await dialog.getByLabel("Файл PDF или DOCX", { exact: true }).setInputFiles({ name: "test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fixture") });
  await dialog.getByRole("button", { name: "Закрыть, сохранив черновик" }).click(); await page.getByRole("button", { name: "Загрузить документ", exact: true }).click(); await expect(dialog.getByLabel(/^Название/)).toHaveValue("Тестовый документ"); await expect(dialog.getByText("Выбран: test.pdf")).toBeVisible();
  await dialog.getByRole("button", { name: "Загрузить", exact: true }).click(); await expect(dialog.getByRole("alert", { name: "Ошибка загрузки документа" })).toBeVisible(); state.uploadFail = false; await dialog.getByRole("button", { name: "Загрузить", exact: true }).click(); await expect(dialog).toBeHidden(); expect(state.writes.at(-1)).toMatchObject({ title: "Тестовый документ", fileName: "test.pdf", ownerOrganizationId: organizationId }); expect(state.unexpected).toEqual([]);
});
test("documents old organization link opens Settings agreement", async ({ page }) => {
  const state = await fixture(page, "supplier"); await page.goto("/supplier/documents?organization=1"); await expect(page).toHaveURL(/supplier\/settings\?tab=documents$/); await expect(page.getByRole("heading", { name: "Договор с площадкой" })).toBeVisible(); await expect(page.getByRole("tab", { name: "Договор и документы" })).toHaveAttribute("aria-selected", "true"); expect(state.unexpected).toEqual([]);
});
test("documents mobile drawer settled visual and keyboard", async ({ page }, info) => {
  await fixture(page, "supplier"); await page.setViewportSize({ width: 390, height: 900 }); await page.goto("/supplier/documents");
  const opener = page.getByRole("button", { name: /^Счёт № 1048/ }); await opener.click(); const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Связанные документы" })).toBeVisible();
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.x)).toBe(0);
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.y)).toBe(0);
  await expect(dialog).toHaveCSS("opacity", "1");
  expect(Math.round((await dialog.boundingBox())!.width)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  await page.screenshot({ path: info.outputPath("mobile-drawer-settled.png") });
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
});
