import { test, expect, type Page } from "@playwright/test";
import type { OrganizationRequisitesResponse, OrganizationRequisitesRevision } from "@marketplace/schemas";

const organizationId = "11111111-1111-4111-8111-111111111111", actorId = "22222222-2222-4222-8222-222222222222", cityId = "33333333-3333-4333-8333-333333333333";
async function fixture(page: Page, role: "clinic" | "supplier", canEdit = true) {
  const capability = role === "supplier" ? "SUPPLIER" : "BUYER";
  const contact = { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "fixture@example.invalid" };
  const state = {
    current: { organizationId, version: 0, canEdit, current: null, source: { organizationVersion: 1, legalName: "ТОО «Тестовые реквизиты»", displayName: "Тестовые реквизиты", identifier: "000000000001", profile: { ...contact, additionalContacts: role === "supplier" ? [contact, contact] : [], legalAddress: { cityId, line1: "Тестовая улица, 1", postalCode: null }, deliveryAddress: { cityId, line1: "Тестовая улица, 2", postalCode: null } }, legalAddressText: "Казахстан, Алматы, Тестовая улица, 1", deliveryAddressText: "Казахстан, Алматы, Тестовая улица, 2", profileComplete: true, requiresPaymentDetails: role === "supplier" }, readiness: { asOfDate: "2026-10-14", complete: false, confirmed: false, ready: false, issues: [] } } as OrganizationRequisitesResponse,
    revisions: [] as OrganizationRequisitesRevision[], writes: [] as Array<{ path: string; body: any }>, failSave: false, failRead: false, conflict: false, unexpected: [] as string[],
  };
  await page.addInitScript(({ capability, organizationId, actorId }) => sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId, actorId, sessionId: actorId, accessToken: "fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Тестовый сотрудник", organizationDisplayName: "Тестовые реквизиты" })), { capability, organizationId, actorId });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, "");
    if (request.method() === "POST" && path.startsWith("/organizations/current/requisites")) {
      const body = request.postDataJSON(); state.writes.push({ path, body });
      if (state.failSave || state.conflict) return route.fulfill({ status: state.conflict ? 409 : 503, json: { code: "FIXTURE_FAILURE", message: state.conflict ? "Реквизиты изменились. Обновите данные" : "Сервис временно недоступен. Повторите сохранение" } });
      if (path.endsWith("/confirm")) {
        const revision = state.current.current!; revision.confirmedAt = "2026-10-14T09:01:00Z"; revision.confirmedBy = { id: actorId, displayName: "Тестовый сотрудник" };
        state.current.readiness = { asOfDate: "2026-10-14", complete: true, confirmed: true, ready: true, issues: [] };
      } else {
        const version = ++state.current.version;
        const revision = { id: `44444444-4444-4444-8444-${String(version).padStart(12, "0")}`, version, fields: structuredClone(body.fields), source: structuredClone(state.current.source), createdAt: "2026-10-14T09:00:00Z", createdBy: { id: actorId, displayName: "Тестовый сотрудник" }, confirmedAt: null, confirmedBy: null };
        state.current.current = revision; state.revisions.unshift(revision);
        state.current.readiness = { asOfDate: "2026-10-14", complete: true, confirmed: false, ready: false, issues: [{ code: "UNCONFIRMED", path: "confirmation", message: "Подтвердите версию" }] };
      }
      return route.fulfill({ status: 201, json: { revisionId: state.current.current!.id, version: state.current.version } });
    }
    if (path === "/organizations/current/requisites") return state.failRead ? route.fulfill({ status: 503, json: { message: "Не удалось загрузить реквизиты" } }) : route.fulfill({ json: state.current });
    if (path === "/organizations/current/requisites/history") return route.fulfill({ json: { items: state.revisions, nextBeforeVersion: null } });
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId, organizationDisplayName: "Тестовые реквизиты", capabilities: [capability] } });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: ["organization.view", "notification.view", "document.view", ...(canEdit ? ["organization.members.manage"] : [])] } });
    if (path === "/auth/current") return route.fulfill({ json: { sessionId: actorId, user: { id: actorId, displayName: "Тестовый сотрудник", email: contact.email, phone: contact.phone, avatarAssetId: null, version: 1 } } });
    if (path === "/conversations") return route.fulfill({ json: { items: [], hasMore: false, unreadCount: 0 } });
    if (path.startsWith("/notifications/organizations/")) return route.fulfill({ json: { items: [], unreadCount: 0, hasMore: false, nextCursor: null } });
    if (path === "/organizations/current/profile") return route.fulfill({ json: { organizationId, legalName: state.current.source.legalName, displayName: state.current.source.displayName, bin: state.current.source.identifier, version: 1, canEdit, complete: true, profile: state.current.source.profile, requiredReserveContacts: role === "supplier" ? 2 : 0 } });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: cityId, nameRu: "Алматы" }] });
    state.unexpected.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, json: { message: "Unexpected fixture request" } });
  });
  return state;
}

async function fillSupplier(page: Page) {
  await page.getByRole("combobox", { name: "Юридическая форма", exact: true }).click();
  await page.getByRole("option", { name: "Юридическое лицо · БИН", exact: true }).click();
  await page.getByRole("button", { name: "Добавить счёт", exact: true }).click();
  const bank = page.getByRole("group", { name: "Банковский счёт 1", exact: true });
  await bank.getByRole("textbox", { name: "Название банка", exact: true }).fill("Тестовый банк");
  await bank.getByRole("textbox", { name: "ИИК / IBAN", exact: true }).fill("KZ86125KZT5004100100");
  await bank.getByRole("textbox", { name: "БИК", exact: true }).fill("FAKEKZXX"); await bank.getByRole("textbox", { name: "КБе", exact: true }).fill("17");
  await page.getByRole("button", { name: "Добавить период", exact: true }).click();
  await page.getByRole("combobox", { name: "Статус по НДС", exact: true }).click();
  await page.getByRole("option", { name: "Плательщик НДС", exact: true }).click(); await page.getByLabel("Действует с", { exact: false }).fill("2026-01-01");
}

for (const role of ["supplier", "clinic"] as const) for (const width of [1440, 390]) test.describe(`requisites help ${role} ${width}`, () => {
  test.use({ hasTouch: width === 390 });
  test("opens contextual help with pointer, keyboard or touch without saving", async ({ page }, info) => {
    const state = await fixture(page, role);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/${role}/settings?tab=requisites`);
    const title = "Подсказка: Реквизиты для документов";
    const trigger = page.getByRole("button", { name: title, exact: true });
    const note = page.getByRole("note", { name: title, exact: true });
    await expect(note).toBeHidden();
    if (width === 390) await trigger.tap(); else await trigger.hover();
    await expect(note).toBeVisible();
    await expect(note).toContainText("Общие данные используются в документах вашей организации");
    await page.screenshot({ path: info.outputPath(`requisites-help-${role}-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(note).toBeHidden();
    if (width === 1440) {
      await page.mouse.move(0, 0);
      await page.getByRole("tab", { name: "Реквизиты", exact: true }).focus();
      await page.keyboard.press("Tab");
      // Supplier has more tabs; focus the requested help after establishing keyboard modality.
      await trigger.focus();
      await expect(note).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    const taxHelp = page.getByRole("button", { name: "Подсказка: Налоговый статус", exact: true });
    if (width === 390) await taxHelp.tap(); else await taxHelp.hover();
    await expect(page.getByRole("note", { name: "Подсказка: Налоговый статус", exact: true })).toContainText(role === "supplier" ? "ваш статус по НДС" : "ваш налоговый статус");
    await page.keyboard.press("Escape");
    expect(state.writes).toEqual([]);
    expect(state.unexpected).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

for (const width of [1440, 390]) test(`requisites supplier save preview confirm and keyboard ${width}`, async ({ page }, info) => {
  const state = await fixture(page, "supplier"); await page.setViewportSize({ width, height: 1000 });
  await page.goto("/supplier/settings"); await page.getByRole("tab", { name: "Реквизиты", exact: true }).click();
  await expect(page).toHaveURL(/tab=requisites/);
  const legal = page.getByRole("combobox", { name: "Юридическая форма", exact: true });
  await legal.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "Юридическая форма", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`requisites-dropdown-${width}.png`), fullPage: true });
  await page.keyboard.press("Escape"); await expect(legal).toBeFocused();
  await fillSupplier(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`requisites-editor-${width}.png`), fullPage: true });
  const input = page.getByRole("textbox", { name: "ИИК / IBAN", exact: true });
  const computed = await input.evaluate(element => { const style = getComputedStyle(element), control = getComputedStyle(element.closest(".dm-input")!); return { font: style.fontFamily, size: style.fontSize, height: getComputedStyle(element.closest(".dm-input")!).height, radius: control.borderRadius }; });
  expect(computed.font).toContain("Manrope"); expect(computed.size).toBe("14px"); expect(computed.height).toBe("44px"); expect(computed.radius).toBe("8px");
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByRole("button", { name: "Проверить и подтвердить", exact: true })).toBeEnabled();
  expect(state.writes[0].body).toMatchObject({ expectedVersion: 0, expectedOrganizationVersion: 1, fields: { legalForm: "LEGAL_ENTITY", taxPeriods: [{ status: "VAT_PAYER" }] } });
  const trigger = page.getByRole("button", { name: "Проверить и подтвердить", exact: true }); await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Подтвердить реквизиты", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole("checkbox").check();
  await page.screenshot({ path: info.outputPath(`requisites-review-${width}.png`), fullPage: true });
  await dialog.getByRole("button", { name: "Подтвердить реквизиты", exact: true }).click();
  await expect(dialog).not.toBeVisible(); await expect(page.getByRole("region", { name: "Реквизиты организации", exact: true }).getByText("Реквизиты подтверждены", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Изменить реквизиты", exact: true }).click();
  await page.getByRole("textbox", { name: "Название банка", exact: true }).fill("Другой тестовый банк"); await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByText("Версия 2 · сохранена", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "История реквизитов", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Реквизиты организации", exact: true })).toContainText("Другой тестовый банк");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(state.unexpected).toEqual([]);
});

for (const width of [1440, 390]) test(`requisites optional tax details preserve values and reveal validation ${width}`, async ({ page }, info) => {
  const state = await fixture(page, "supplier");
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/supplier/settings?tab=requisites");
  await fillSupplier(page);
  const group = page.getByRole("group", { name: "Налоговый период 1", exact: true });
  const details = group.locator("details"), summary = details.locator("summary");
  const endDate = group.getByLabel("Последний день действия", { exact: false });
  await expect(endDate).toBeHidden();
  await expect(group.getByLabel("Действует с", { exact: false })).toBeVisible();
  await summary.focus(); await page.keyboard.press("Enter");
  await expect(endDate).toBeVisible();
  await endDate.fill("2025-12-31");
  await group.getByLabel("Основание / регистрационные сведения", { exact: false }).fill("Сведения о регистрации");
  await summary.click(); await expect(endDate).toBeHidden();
  const save = page.getByRole("button", { name: "Сохранить черновик", exact: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(endDate).toBeVisible();
    await expect(endDate).toBeFocused();
    await expect(group.getByText("Окончание периода не может быть раньше начала", { exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
    if (attempt === 0) { await summary.click(); await expect(endDate).toBeHidden(); }
  }
  await page.screenshot({ path: info.outputPath(`tax-details-validation-${width}.png`), fullPage: true });
  await endDate.fill("2026-12-31"); await save.click();
  expect(state.writes[0].body.fields.taxPeriods[0]).toMatchObject({ status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", reference: "Сведения о регистрации" });
  await page.getByRole("button", { name: "Изменить реквизиты", exact: true }).click();
  await expect(endDate).toBeHidden();
  await expect(summary).toContainText("заполнены");
  await summary.click();
  await expect(endDate).toHaveValue("2026-12-31");
  await expect(group.getByLabel("Основание / регистрационные сведения", { exact: false })).toHaveValue("Сведения о регистрации");
  expect(state.unexpected).toEqual([]);
});

test("requisites errors retain drafts and retry keys; concurrent edits require an explicit choice", async ({ page }) => {
  const state = await fixture(page, "supplier"); await page.goto("/supplier/settings?tab=requisites"); await fillSupplier(page);
  await page.getByRole("textbox", { name: "ИИК / IBAN", exact: true }).fill("KZ00125KZT5004100100"); await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByText("Проверьте контрольные цифры ИИК", { exact: true })).toBeVisible(); expect(state.writes).toHaveLength(0);
  await page.getByRole("textbox", { name: "ИИК / IBAN", exact: true }).fill("KZ86125KZT5004100100"); state.failSave = true;
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click(); await expect(page.getByRole("region", { name: "Реквизиты организации", exact: true }).getByRole("alert")).toContainText("Сервис временно недоступен");
  await expect(page.getByRole("textbox", { name: "Название банка", exact: true })).toHaveValue("Тестовый банк"); state.failSave = false;
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click(); await expect(page.getByRole("button", { name: "Проверить и подтвердить", exact: true })).toBeEnabled();
  expect(state.writes[0].body.idempotencyKey).toBe(state.writes[1].body.idempotencyKey);
  await page.getByRole("button", { name: "Изменить реквизиты", exact: true }).click(); await page.getByRole("textbox", { name: "Название банка", exact: true }).fill("Мой черновик");
  state.conflict = true; await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click(); await expect(page.getByRole("region", { name: "Реквизиты организации", exact: true }).getByRole("alert")).toContainText("Реквизиты изменились");
  state.current.version = 2; state.current.current!.version = 2; state.current.current!.fields.bankAccounts[0].bankName = "Сохранено коллегой";
  state.conflict = false; await page.getByRole("button", { name: "Обновить сохранённые данные", exact: true }).click();
  await expect(page.getByText("Есть более новая сохранённая версия", { exact: true })).toBeVisible(); await expect(page.getByRole("textbox", { name: "Название банка", exact: true })).toHaveValue("Мой черновик");
  await expect(page.getByRole("button", { name: "Сохранить черновик", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Продолжить с моим черновиком", exact: true }).click(); await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  await expect(page.getByText("Версия 3 · сохранена", { exact: false })).toBeVisible(); expect(state.writes.at(-1)?.body.expectedVersion).toBe(2);
});

for (const width of [1440, 390]) test(`requisites clinic does not require supplier bank fields and initial load can recover ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const state = await fixture(page, "clinic"); state.failRead = true;
  await page.goto("/clinic/settings?tab=requisites"); await expect(page.getByText("Не удалось загрузить реквизиты", { exact: true })).toBeVisible();
  state.failRead = false; await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await page.getByRole("button", { name: "Подсказка: Банковские счета", exact: true }).hover();
  await expect(page.getByRole("note", { name: "Подсказка: Банковские счета", exact: true })).toContainText("Для оплаты поставщику ваш банковский счёт не обязателен.");
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Юридическая форма", exact: true }).click();
  await page.getByRole("option", { name: "Индивидуальный предприниматель · ИИН", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click(); await expect(page.getByRole("button", { name: "Проверить и подтвердить", exact: true })).toBeEnabled();
  expect(state.writes[0].body.fields.bankAccounts).toEqual([]); expect(state.writes[0].body.fields.taxPeriods).toEqual([]);
  await page.screenshot({ path: info.outputPath(`requisites-clinic-${width}.png`), fullPage: true });
});

test("requisites old documents tab falls back to organization settings", async ({ page }) => {
  const state = await fixture(page, "supplier");
  await page.goto("/supplier/settings?tab=documents");
  await expect(page.getByRole("tab", { name: "Организация", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Договор и документы", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Договор с площадкой", exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("requisites viewer has no history or mutation controls", async ({ page }) => {
  const state = await fixture(page, "supplier", false); await page.goto("/supplier/settings?tab=requisites");
  await expect(page.getByText("Доступно только для просмотра", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Изменить реквизиты|Сохранить черновик|Проверить и подтвердить/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "История реквизитов", exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});
