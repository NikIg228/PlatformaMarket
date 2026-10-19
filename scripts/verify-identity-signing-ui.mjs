import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.IDENTITY_UI_BASE_URL ?? "http://127.0.0.1:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = ".tmp/nca-identity/ui"; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const id = "11111111-1111-4111-8111-111111111111", sid = "22222222-2222-4222-8222-222222222222";
async function visible(locator) { await locator.waitFor({ state: "visible", timeout: 20000 }); }
async function fixture(role, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER";
  const state = { identity: { status: "UNVERIFIED", verificationAvailable: true, activeSessionId: null }, session: null, writes: [], loseResponse: false, unavailable: false, unexpected: [] };
  await page.addInitScript(({ id, sid, capability }) => {
    sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId: id, sessionId: sid, actorId: id, accessToken: "fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Тестовый сотрудник", organizationDisplayName: "Демо организация" }));
    // Controlled native boundary: transaction/crypto verification has separate real SDK evidence.
    const NativeSocket = window.WebSocket;
    window.WebSocket = class {
      constructor(url) {
        if (url !== "wss://127.0.0.1:13579/") return new NativeSocket(url);
        window.__identitySocketCalls = (window.__identitySocketCalls ?? 0) + 1;
        queueMicrotask(() => sessionStorage.getItem("identity-socket-fail") ? this.onerror?.() : this.onopen?.());
      }
      send(value) { window.__identitySocketMessage = JSON.parse(value); queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ status: true, body: { result: ["-----BEGIN CMS-----\nAQID\n-----END CMS-----"] } }) })); }
      close() {}
    };
  }, { id, sid, capability });
  const personal = { id, displayName: "Тестовый сотрудник", email: "user@example.invalid", phone: "+77000000000", avatarAssetId: null, version: 1 };
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace(/^\/api/, "");
    if (req.method() === "POST") {
      const body = req.postDataJSON(); state.writes.push({ path, body });
      if (path === "/identity/signing-binding/challenges") {
        const original = Buffer.from("Synthetic UI challenge"), sessionId = randomUUID();
        state.session = { id: sessionId, version: 1, purpose: "BIND_IDENTITY", status: "AWAITING_USER", signingInput: { kind: "CHALLENGE", id: sessionId, purpose: "BIND_IDENTITY", contentBase64: original.toString("base64"), checksumSha256: createHash("sha256").update(original).digest("hex"), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() } };
        // Preserve the exact ten-minute contract across millisecond boundaries.
        state.session.signingInput.expiresAt = new Date(Date.parse(state.session.signingInput.createdAt) + 600000).toISOString();
        state.identity.activeSessionId = sessionId; return route.fulfill({ status: 201, json: state.session });
      }
      if (path === "/signing/sessions/cms") {
        if (state.loseBeforeAccept) { state.loseBeforeAccept = false; return route.abort("failed"); }
        state.session = { id: state.session.id, version: 2, purpose: "BIND_IDENTITY", status: "VERIFYING" };
        if (state.loseResponse) { state.loseResponse = false; return route.abort("failed"); }
        return route.fulfill({ status: 202, json: state.session });
      }
      if (path.endsWith("/cancel") || path.endsWith("/retry")) {
        state.session = { id: state.session.id, version: state.session.version + 1, purpose: "BIND_IDENTITY", status: path.endsWith("/cancel") ? "CANCELLED" : "VERIFYING" };
        if (state.session.status === "CANCELLED") state.identity.activeSessionId = null;
        return route.fulfill({ status: path.endsWith("/cancel") ? 200 : 202, json: state.session });
      }
    }
    if (path === "/identity/signing-binding") return route.fulfill(state.unavailable ? { status: 503, json: { code: "VERIFIER_UNAVAILABLE", message: "Unavailable" } } : { json: state.identity });
    if (path.startsWith("/signing/sessions/")) return route.fulfill({ json: state.session });
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId: id, organizationDisplayName: "Демо организация", capabilities: [capability] } });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: ["organization.view", "notification.view"] } });
    if (path === "/auth/current") return route.fulfill({ json: url.searchParams.has("workspace") ? { sessionId: sid, user: personal } : null });
    if (path === "/auth/profile") return route.fulfill({ json: personal });
    if (path === "/auth/sessions") return route.fulfill({ json: [] });
    if (path === "/organizations/current/profile") return route.fulfill({ json: { organizationId: id, legalName: "ТОО «Демо Клиника»", displayName: "Демо организация", bin: "000000000001", version: 1, canEdit: true, complete: true, profile: { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "office@example.invalid", additionalContacts: [], legalAddress: { cityId: id, line1: "Тестовая улица, 1", postalCode: "050000" }, deliveryAddress: { cityId: id, line1: "Тестовая улица, 2", postalCode: "050000" } } } });
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id, nameRu: "Алматы" }] });
    if (path === "/conversations") return route.fulfill({ json: { items: [], hasMore: false, unreadCount: 0 } });
    if (path.startsWith("/notifications/organizations/")) return route.fulfill({ json: { items: [], unreadCount: 0, hasMore: false, nextCursor: null } });
    state.unexpected.push(path); return route.fulfill({ status: 503, json: { message: "Unexpected fixture" } });
  });
  await page.goto(`${base}/${role}/profile`, { timeout: 60000 });
  return { page, state, region: page.getByRole("region", { name: "Подтверждение личности", exact: true }) };
}
try {
  for (const role of process.argv.includes("--states-only") ? [] : ["clinic", "supplier"]) for (const width of [1440, 390]) {
    const { page, state, region } = await fixture(role, width);
    try {
      const start = region.getByRole("button", { name: "Подтвердить личность", exact: true }); await visible(start);
      await start.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      assert.equal(await start.evaluate(el => el === document.activeElement), true);
      const computed = await start.evaluate(el => { const s = getComputedStyle(el); return { height: s.height, radius: s.borderRadius, fontSize: s.fontSize, outline: s.outlineWidth, outlineOffset: s.outlineOffset }; });
      assert.equal(computed.height, "44px"); assert.equal(computed.radius, "8px");
      assert.equal(computed.outline, "1px"); assert.equal(computed.outlineOffset, "2px");
      // Tab briefly focuses the neighbouring help trigger; capture after its
      // documented close transition rather than freezing a fading tooltip.
      await page.getByRole("tooltip").waitFor({ state: "hidden", timeout: 5000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `${output}/identity-${role}-${width}.png`, fullPage: true });
      if (process.argv.includes("--appearance-only")) { results.push({ role, width, status: "PASS", computed }); console.log(`PASS identity appearance ${role} ${width}: keyboard focus, dimensions, no overflow`); continue; }
      await page.keyboard.press("Enter"); await visible(region.getByText("Запрос готов к подписанию", { exact: true }));
      await page.evaluate(() => sessionStorage.setItem("identity-socket-fail", "yes"));
      await region.getByRole("button", { name: "Подписать через NCALayer", exact: true }).click();
      await visible(region.getByRole("button", { name: "Восстановить состояние", exact: true }));
      assert.equal(state.writes.filter(write => write.path.endsWith("/cms")).length, 0);
      await page.evaluate(() => sessionStorage.removeItem("identity-socket-fail"));
      await region.getByRole("button", { name: "Восстановить состояние", exact: true }).click();
      await visible(region.getByText("Запрос готов к подписанию", { exact: true }));
      state.loseResponse = true;
      await region.getByRole("button", { name: "Подписать через NCALayer", exact: true }).click();
      await visible(region.getByRole("button", { name: "Восстановить состояние", exact: true }));
      assert.equal(state.writes.filter(write => write.path.endsWith("/cms")).length, 1);
      await region.getByRole("button", { name: "Восстановить состояние", exact: true }).click();
      await visible(region.getByText("Проверяем подпись", { exact: true }));
      assert.equal(await page.evaluate(() => window.__identitySocketCalls), 2, "Recovery never signs again");
      const sent = await page.evaluate(() => window.__identitySocketMessage);
      assert.equal(sent.args.signingParams.encapsulate, false); assert.deepEqual(sent.args.signingParams.tsaProfile, {});
      state.session = { ...state.session, version: 3, status: "UNKNOWN", reasonCode: "VERIFIER_UNAVAILABLE" };
      await page.reload(); await visible(region.getByText("Проверка не завершена", { exact: true }));
      await page.screenshot({ path: `${output}/identity-unknown-${role}-${width}.png`, fullPage: true });
      await region.getByRole("button", { name: "Повторить проверку", exact: true }).click();
      await visible(region.getByText("Проверяем подпись", { exact: true }));
      assert.equal(state.writes.filter(write => write.path.endsWith("/cms")).length, 1);
      state.session = { id: state.session.id, version: 5, purpose: "BIND_IDENTITY", status: "COMMITTED", evidenceId: randomUUID(), committedAt: new Date().toISOString() };
      state.identity = { status: "VERIFIED", bindingId: randomUUID(), version: 1, maskedIin: "********0001", verifiedAt: new Date().toISOString() };
      await visible(region.getByText("Личность подтверждена", { exact: true }));
      assert.equal(await region.getByRole("button", { name: "Подтвердить личность", exact: true }).count(), 0);
      await page.screenshot({ path: `${output}/identity-verified-${role}-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(state.unexpected, []);
      results.push({ role, width, status: "PASS", computed }); console.log(`PASS identity UI ${role} ${width}: keyboard, NCALayer error, lost response recovery, reload UNKNOWN, saved-CMS retry, verified`);
    } finally { await page.close(); }
  }
  if (!process.argv.includes("--appearance-only")) {
  const { page, state, region } = await fixture("clinic", 390);
  try {
    state.unavailable = true; await page.reload();
    await visible(region.getByRole("button", { name: "Восстановить состояние", exact: true }));
    state.unavailable = false; state.identity.verificationAvailable = false;
    await region.getByRole("button", { name: "Восстановить состояние", exact: true }).click();
    await visible(region.getByText("Проверка пока недоступна", { exact: true }));
    assert.equal(await region.getByRole("button", { name: "Подтвердить личность", exact: true }).count(), 0);
    state.identity.verificationAvailable = true; await page.reload();
    await region.getByRole("button", { name: "Подтвердить личность", exact: true }).click();
    await visible(region.getByText("Запрос готов к подписанию", { exact: true }));
    await region.getByRole("button", { name: "Отменить подтверждение", exact: true }).click();
    await visible(region.getByText("Подтверждение отменено", { exact: true }));
    await region.getByRole("button", { name: "Подтвердить личность", exact: true }).click();
    await visible(region.getByText("Запрос готов к подписанию", { exact: true }));
    state.session.signingInput.createdAt = new Date(Date.now() - 601000).toISOString();
    state.session.signingInput.expiresAt = new Date(Date.parse(state.session.signingInput.createdAt) + 600000).toISOString();
    await page.reload(); await visible(region.getByText("Время подтверждения истекло", { exact: true }));
    await region.getByRole("button", { name: "Подтвердить личность", exact: true }).click();
    state.loseBeforeAccept = true;
    await region.getByRole("button", { name: "Подписать через NCALayer", exact: true }).click();
    await visible(region.getByRole("button", { name: "Восстановить состояние", exact: true }));
    await region.getByRole("button", { name: "Восстановить состояние", exact: true }).click();
    await region.getByRole("button", { name: "Отправить сохранённую подпись", exact: true }).click();
    const submissions = state.writes.filter(write => write.path.endsWith("/cms"));
    assert.equal(submissions.length, 2); assert.deepEqual(submissions[0].body, submissions[1].body);
    assert.equal(await page.evaluate(() => window.__identitySocketCalls), 1, "Retry sends retained bytes and key without signing again");
    await visible(region.getByText("Проверяем подпись", { exact: true }));
    state.session = { ...state.session, status: "REJECTED", version: 3, reasonCode: "CERTIFICATE_REVOKED" };
    await visible(region.getByText("Личность не подтверждена", { exact: true }));
    assert((await region.innerText()).includes("Сертификат отозван"));
    await region.getByRole("button", { name: "Подтвердить личность", exact: true }).click();
    await region.getByRole("button", { name: "Подписать через NCALayer", exact: true }).click();
    await visible(region.getByText("Проверяем подпись", { exact: true }));
    state.session = { ...state.session, status: "EVIDENCE_ONLY", version: 3, evidenceId: randomUUID(), reasonCode: "IDENTITY_CONFLICT" };
    await visible(region.getByText("Личность не подтверждена", { exact: true }));
    assert((await region.innerText()).includes("обратитесь в поддержку"));
    await page.screenshot({ path: `${output}/identity-conflict-390.png`, fullPage: true });
    assert.deepEqual(state.unexpected, []);
    results.push({ status: "PASS", checks: ["load error recovery", "unconfigured", "cancel", "expired", "retained CMS and replay key after pre-accept network failure", "revoked certificate", "evidence only conflict"] });
    console.log("PASS identity UI additional states: load error/recovery, unavailable, cancellation, expiry, rejected and evidence-only");
  } finally { await page.close(); }
  }
  await writeFile(`${output}/${process.argv.includes("--states-only") ? "states-checks" : process.argv.includes("--appearance-only") ? "appearance-checks" : "checks"}.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
