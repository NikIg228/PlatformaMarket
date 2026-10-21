import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.ADMISSION_UI_BASE_URL ?? "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = ".tmp/signing-admission/ui"; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true }), checks = [];
const org = "11111111-1111-4111-8111-111111111111", actor = "22222222-2222-4222-8222-222222222222", operator = "33333333-3333-4333-8333-333333333333";
const file = { name: "appointment.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nSynthetic UI fixture") };
const wait = locator => locator.waitFor({ state: "visible", timeout: 30000 });
function fixture(role = "clinic") {
  const ip = role === "supplier", time = new Date().toISOString(), person = { id: actor, displayName: "Тестовый заявитель" };
  const source = { organizationVersion: 1, legalName: ip ? "ИП Тестовый предприниматель" : "ТОО «Тестовая клиника»", displayName: "Тестовая организация", identifier: "000000000001", profile: null,
    profileComplete: true, requiresPaymentDetails: ip, legalAddressText: "Алматы, Тестовая улица, 1", deliveryAddressText: "Алматы, Тестовая улица, 1" };
  return { role, identity: { status: "VERIFIED", bindingId: actor, version: 1, maskedIin: "********0001", verifiedAt: time },
    requisites: { organizationId: org, version: 1, canEdit: true, source,
      current: { id: org, version: 1, fields: { legalForm: ip ? "INDIVIDUAL_ENTREPRENEUR" : "LEGAL_ENTITY", bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] }, source,
        createdAt: time, createdBy: person, confirmedAt: time, confirmedBy: person }, readiness: { asOfDate: time.slice(0, 10), complete: true, confirmed: true, ready: true, issues: [] } },
    admission: null, writes: [], uploads: new Map(), commands: new Map(), unexpected: [], failRead: false, loseUpload: false, loseBeforeSubmit: false, loseAfterSubmit: false, loseAfterReview: false };
}
async function pageFor(role, width, state) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  page.on("pageerror", error => state.unexpected.push(`pageerror:${error.message}`));
  await page.addInitScript(({ role, org, actor, operator }) => {
    if (role === "admin") sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "fixture-not-real", sessionId: operator, activeOrganizationId: operator,
      expiresAt: Date.now() + 3600000, user: { id: operator, displayName: "Тестовый оператор" } }));
    else { const capability = role === "clinic" ? "BUYER" : "SUPPLIER"; sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId: org, actorId: actor,
      sessionId: actor, accessToken: "fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Тестовый заявитель", organizationDisplayName: "Тестовая организация" })); }
  }, { role, org, actor, operator });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, "");
    if (request.method() === "POST") {
      const body = request.postDataJSON(); state.writes.push({ path, body });
      if (path === "/documents/upload") {
        if (!state.uploads.has(body.documentNumber)) state.uploads.set(body.documentNumber, { id: randomUUID(), version: 1 });
        if (state.loseUpload) { state.loseUpload = false; return route.abort("failed"); }
        return route.fulfill({ status: 201, json: state.uploads.get(body.documentNumber) });
      }
      if (path === `/organizations/${org}/signing/admission`) {
        if (state.loseBeforeSubmit) { state.loseBeforeSubmit = false; return route.abort("failed"); }
        if (!state.commands.has(body.idempotencyKey)) {
          const { idempotencyKey, ...application } = body;
          state.admission = { id: randomUUID(), version: 1, organizationId: org, applicant: { userId: actor, displayName: "Тестовый заявитель", maskedIin: "********0001" }, application, createdAt: new Date().toISOString(), status: "PENDING_REVIEW" };
          state.commands.set(idempotencyKey, structuredClone(state.admission));
        }
        if (state.loseAfterSubmit) { state.loseAfterSubmit = false; return route.abort("failed"); }
        return route.fulfill({ status: 201, json: state.commands.get(body.idempotencyKey) });
      }
      if (/^\/operations\/signing\/admissions\/[^/]+\/review$/.test(path)) {
        if (!state.commands.has(body.idempotencyKey)) {
          state.admission = { ...state.admission, version: state.admission.version + 1, status: body.decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewId: randomUUID(), reviewedAt: new Date().toISOString(),
            ...(body.decision === "APPROVE" ? { authority: { id: randomUUID(), version: 1 } } : { reason: body.reason }) };
          state.commands.set(body.idempotencyKey, structuredClone(state.admission));
        }
        if (state.loseAfterReview) { state.loseAfterReview = false; return route.abort("failed"); }
        return route.fulfill({ json: state.commands.get(body.idempotencyKey) });
      }
    }
    const permissions = ["organization.view", "document.view", ...(state.noUpload ? [] : ["document.upload"]), "compliance.review", "notification.view"];
    const organization = { id: org, displayName: "Тестовая организация", legalName: state.requisites.source.legalName, bin: "000000000001", status: "ACTIVE", capabilities: [state.role === "clinic" ? "BUYER" : "SUPPLIER"], createdAt: new Date().toISOString() };
    let json;
    if (path === `/organizations/${org}/signing/admission`) {
      if (state.readGate) await state.readGate;
      if (state.deniedRead) return route.fulfill({ status: 403, json: { code: "FORBIDDEN", message: "Access revoked" } });
      if (state.failRead) return route.fulfill({ status: 503, json: { code: "VERIFIER_UNAVAILABLE", message: "Fixture unavailable" } });
      json = { admission: state.admission };
    } else if (path === "/identity/signing-binding") json = state.identity;
    else if (path === "/organizations/current/requisites") json = state.requisites;
    else if (path === "/organizations") json = [{ id: operator, capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }];
    else if (path === "/operations/organizations") json = { items: [organization], total: 1, offset: 0, limit: 25 };
    else if (path === `/operations/organizations/${org}`) json = { ...organization, version: 1, canEdit: false, profile: null, profileCities: null };
    else if (path === "/operations/signing/admissions") json = { items: state.admission?.status === "PENDING_REVIEW" ? [state.admission] : [], total: state.admission?.status === "PENDING_REVIEW" ? 1 : 0, offset: 0 };
    else if (path.startsWith("/operations/signing/admissions/")) json = state.admission;
    else if (/^\/documents\/.+\/download$/.test(path)) return route.fulfill({ status: 200, contentType: "application/pdf", body: file.buffer, headers: { "content-disposition": 'attachment; filename="appointment.pdf"' } });
    else if (path === "/access-control/permissions") json = permissions;
    else if (path === "/access-control/policy") json = { mode: "ROLE_BASED", permissions };
    else if (path === "/catalog/cities") json = [];
    else if (path === "/auth/workspace-context") json = { organizationId: org, organizationDisplayName: "Тестовая организация", capabilities: [state.role === "clinic" ? "BUYER" : "SUPPLIER"] };
    else if (path === "/auth/current") json = role === "admin" || !url.searchParams.has("workspace") ? null : { sessionId: actor, user: { id: actor, displayName: "Тестовый заявитель", email: "test@example.invalid" } };
    else if (path === "/organizations/current/profile") json = { organizationId: org, ...organization, version: 1, canEdit: false, complete: true, profile: null };
    else if (path === "/conversations") json = { items: [], hasMore: false, unreadCount: 0 };
    else if (path.startsWith("/notifications/organizations/")) json = { items: [], hasMore: false, unreadCount: 0, nextCursor: null };
    else { state.unexpected.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, json: { message: "Unhandled fixture" } }); }
    return route.fulfill({ json });
  });
  return page;
}
async function openApplicant(page, role) {
  await page.goto(`${base}/${role}/settings?tab=signing`, { timeout: 90000 });
  await wait(page.getByRole("region", { name: "Допуск подписанта", exact: true }));
  await wait(page.getByText("Подтверждённый ИИН", { exact: true }));
}
async function fillApplicant(page) {
  await page.getByLabel(/^Основание полномочий/).fill("Приказ № 12 от 20.10.2026");
  await page.getByLabel(/^Документ основания/).setInputFiles(file);
}
async function approve(page) {
  await page.getByLabel("Документ проверки", { exact: true }).setInputFiles({ ...file, name: "official-extract.pdf" });
  await page.getByLabel(/^Комментарий к решению/).fill("Сверены официальная выписка и актуальный статус");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Подтвердить допуск", exact: true }).click();
}
try {
  if (!process.argv.includes("--states-only") && !process.argv.includes("--additional-states-only")) for (const role of ["clinic", "supplier"]) for (const width of [1440, 390]) {
    const state = fixture(role), page = await pageFor(role, width, state);
    await openApplicant(page, role);
    await page.getByRole("button", { name: "Отправить на проверку", exact: true }).click();
    await wait(page.getByText("Укажите название и реквизиты основания.", { exact: true }));
    await fillApplicant(page);
    const submit = page.getByRole("button", { name: "Отправить на проверку", exact: true });
    await submit.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    const appearance = await submit.evaluate(el => ({ height: el.getBoundingClientRect().height, radius: getComputedStyle(el).borderRadius, outline: getComputedStyle(el).outlineWidth }));
    assert.equal(appearance.height, 44); assert.equal(appearance.radius, "8px"); assert.equal(appearance.outline, "1px");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${output}/${role}-${width}-form.png`, fullPage: true });
    await submit.click(); await wait(page.getByText("Заявка на проверке", { exact: true }));
    assert.equal(state.writes.filter(x => x.path === "/documents/upload").length, 1);
    assert.equal(state.admission.application.basis.kind, role === "supplier" ? "INDIVIDUAL_ENTREPRENEUR" : "LEGAL_ENTITY_HEAD");
    await page.reload(); await wait(page.getByText("Заявка на проверке", { exact: true }));
    const admin = await pageFor("admin", width, state);
    await admin.goto(`${base}/admin?section=organizations`, { timeout: 90000 });
    await admin.getByRole("button", { name: "Проверить заявку Тестовый заявитель", exact: true }).click();
    await wait(admin.getByRole("button", { name: "Подтвердить допуск", exact: true }));
    assert(admin.url().includes(`admissionId=${state.admission.id}`));
    assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await admin.screenshot({ path: `${output}/${role}-${width}-operator.png`, fullPage: true });
    await approve(admin); await wait(admin.getByText("Допуск подтверждён", { exact: true }));
    await admin.reload(); await wait(admin.getByText("Допуск подтверждён", { exact: true }));
    await page.getByRole("button", { name: "Обновить статус", exact: true }).click(); await wait(page.getByText("Первичный допуск подтверждён", { exact: true }));
    assert.deepEqual(state.unexpected, []); checks.push({ role, width, result: "PASS", appearance });
    await page.close(); await admin.close();
  }
  if (!process.argv.includes("--appearance-only") && !process.argv.includes("--additional-states-only")) {
    for (const fault of ["loseUpload", "loseBeforeSubmit", "loseAfterSubmit"]) {
      const state = fixture(), page = await pageFor("clinic", 1440, state); state[fault] = true;
      await openApplicant(page, "clinic"); await fillApplicant(page); await page.getByRole("button", { name: "Отправить на проверку", exact: true }).click();
      await wait(page.getByText("Результат отправки неизвестен", { exact: true }));
      await page.getByRole("button", { name: "Проверить состояние заявки", exact: true }).click();
      if (fault !== "loseAfterSubmit") { await page.getByRole("button", { name: "Повторить отправку заявки", exact: true }).click(); }
      await wait(page.getByText("Заявка на проверке", { exact: true }));
      const writes = state.writes.filter(x => x.path === (fault === "loseUpload" ? "/documents/upload" : `/organizations/${org}/signing/admission`));
      assert.equal(writes.length, fault === "loseAfterSubmit" ? 1 : 2);
      if (writes.length === 2) assert.deepEqual(writes[0].body, writes[1].body);
      if (fault === "loseAfterSubmit") {
        const admin = await pageFor("admin", 390, state); state.loseAfterReview = true;
        await admin.goto(`${base}/admin?section=organizations&admissionId=${state.admission.id}`, { timeout: 90000 });
        await wait(admin.getByRole("button", { name: "Подтвердить допуск", exact: true })); await approve(admin);
        await wait(admin.getByText("Результат решения неизвестен", { exact: true }));
        await admin.reload(); await wait(admin.getByText("Допуск подтверждён", { exact: true }));
        assert.equal(state.writes.filter(x => x.path.endsWith("/review")).length, 1); await admin.close();
      }
      assert.deepEqual(state.unexpected, []); checks.push({ fault, result: "PASS" }); await page.close();
    }
    const state = fixture(), page = await pageFor("clinic", 390, state);
    state.identity = { status: "UNVERIFIED", verificationAvailable: true, activeSessionId: null };
    await page.goto(`${base}/clinic/settings?tab=signing`, { timeout: 90000 }); await wait(page.getByText("Сначала подтвердите личность", { exact: true }));
    assert.equal(await page.getByRole("button", { name: "Отправить на проверку", exact: true }).count(), 0);
    state.identity = { status: "VERIFIED", bindingId: actor, version: 1, maskedIin: "********0001", verifiedAt: new Date().toISOString() };
    await page.getByRole("button", { name: "Обновить статус", exact: true }).click(); await fillApplicant(page);
    await page.getByRole("button", { name: "Отправить на проверку", exact: true }).click(); await wait(page.getByText("Заявка на проверке", { exact: true }));
    const admin = await pageFor("admin", 1440, state);
    await admin.goto(`${base}/admin?section=organizations&admissionId=${state.admission.id}`, { timeout: 90000 });
    await admin.getByLabel(/^Комментарий к решению/).fill("Нужна полная копия приказа");
    await admin.getByRole("button", { name: "Отклонить заявку", exact: true }).click(); await wait(admin.getByText("Заявка отклонена", { exact: true }));
    await page.getByRole("button", { name: "Обновить статус", exact: true }).click(); await wait(page.getByText("Заявка отклонена", { exact: true }));
    await fillApplicant(page); await page.getByRole("button", { name: "Отправить на проверку", exact: true }).click(); await wait(page.getByText("Заявка на проверке", { exact: true }));
    const submissions = state.writes.filter(x => x.path === `/organizations/${org}/signing/admission`); assert.notEqual(submissions[0].body.idempotencyKey, submissions[1].body.idempotencyKey);
    assert.deepEqual(state.unexpected, []); checks.push({ flow: "identity prerequisite, operator rejection, corrected application", result: "PASS" }); await page.close(); await admin.close();
  }
  if (process.argv.includes("--additional-states-only")) {
    const state = fixture(), page = await pageFor("clinic", 390, state);
    let releaseRead;
    state.readGate = new Promise(resolve => { releaseRead = resolve; });
    await page.goto(`${base}/clinic/settings?tab=signing`, { timeout: 90000 });
    await wait(page.getByText("Загружаем состояние допуска", { exact: true }));
    releaseRead(); state.readGate = null;
    await wait(page.getByText("Подтверждённый ИИН", { exact: true }));
    await fillApplicant(page); state.failRead = true;
    await page.getByRole("button", { name: "Обновить статус", exact: true }).click();
    await wait(page.getByText("Не удалось завершить действие", { exact: true }));
    assert.equal(await page.getByLabel(/^Основание полномочий/).inputValue(), "Приказ № 12 от 20.10.2026");
    state.failRead = false;
    await page.getByRole("button", { name: "Проверить состояние заявки", exact: true }).click();
    await page.getByText("Не удалось завершить действие", { exact: true }).waitFor({ state: "hidden" });
    state.deniedRead = true;
    await page.getByRole("button", { name: "Обновить статус", exact: true }).click();
    await wait(page.getByText("Недостаточно прав или доступ участника изменился. Обновите данные; при необходимости обратитесь в поддержку.", { exact: true }));
    assert.equal(await page.getByRole("button", { name: "Отправить на проверку", exact: true }).count(), 0);
    assert.equal(await page.getByText("Подтверждённый ИИН", { exact: true }).count(), 0);
    assert.deepEqual(state.unexpected, []); await page.close();
    const limited = fixture("supplier"); limited.noUpload = true;
    const limitedPage = await pageFor("supplier", 390, limited);
    await openApplicant(limitedPage, "supplier");
    await wait(limitedPage.getByText("Нужно право загрузки документов", { exact: true }));
    assert(await limitedPage.getByRole("button", { name: "Отправить на проверку", exact: true }).isDisabled());
    await limitedPage.close();
    const admin = await pageFor("admin", 390, fixture());
    await admin.goto(`${base}/admin?section=organizations`, { timeout: 90000 });
    await wait(admin.getByText("Нет заявок на проверку", { exact: true }));
    await admin.close();
    checks.push({ flow: "loading, read recovery preserves input, revoked access, upload permission, empty queue", result: "PASS" });
  }
  await writeFile(`${output}/${process.argv.includes("--additional-states-only") ? "additional-states" : process.argv.includes("--states-only") ? "states" : "checks"}.json`, JSON.stringify(checks, null, 2)); console.log(JSON.stringify(checks));
} catch (error) {
  for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) { await page.screenshot({ path: `${output}/failure-${index}.png`, fullPage: true }).catch(() => {}); console.error((await page.locator("body").innerText().catch(() => "")).slice(-3500)); }
  throw error;
} finally { await browser.close(); }
