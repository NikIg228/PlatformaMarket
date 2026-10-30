import { expect, test } from "@playwright/test";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const at = "2026-10-30T00:00:00.000Z";

test("integration selection rejects late details and recovers current read failure", async ({ page }, info) => {
  const errors: string[] = [];
  const unexpected: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ actor, organization }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-refactor-proof", sessionId: actor, activeOrganizationId: organization, user: { id: actor, displayName: "Оператор" }, expiresAt: Date.now() + 3_600_000 })), { actor: id(1), organization: id(2) });
  const suppliers = [3, 4].map(n => ({ organizationId: id(n), organization: { displayName: `Поставщик ${n}`, bin: "000000000001" }, dataSources: [], warehouses: [], _count: { offers: 0, importBatches: 0 } }));
  const connections = [5, 6, 7].map(n => ({ id: id(n), provider: "MOCK", mode: "PULL", status: "ACTIVE", displayName: `Подключение ${n}`, version: 1, bindings: [], mappings: [], _count: { jobs: 0, webhookEvents: 0, reconciliationEntries: 0, externalReservations: 0 } }));
  let held = false;
  let release: () => void = () => {};
  const barrier = new Promise<void>(resolve => { release = resolve; });
  let fail = false;
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (request.method() !== "GET") { unexpected.push(`${request.method()} ${path}`); return route.fulfill({ status: 405, json: { message: "Unexpected write" } }); }
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(2), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path === "/access-control/permissions") return route.fulfill({ json: ["import.manage", "integration.reconcile"] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: at } });
    if (path === "/suppliers") return route.fulfill({ json: suppliers });
    if (path.endsWith("/integrations")) return route.fulfill({ json: path.includes(id(3)) ? connections : [] });
    if (path.endsWith("/jobs") || path.endsWith("/reconciliation")) {
      if (path.includes(id(6))) { held = true; await barrier; }
      if (fail && path.includes(id(7))) return route.fulfill({ status: 503, json: { message: "Текущая сверка временно недоступна" } });
      return route.fulfill({ json: path.endsWith("/jobs") ? [] : [{ id: id(8), kind: path.includes(id(6)) ? "OLD_SELECTION" : path.includes(id(7)) ? "CURRENT_SELECTION" : "INITIAL_SELECTION", status: "MATCHED", detectedAt: at }] });
    }
    if (/\/(warehouses|offers|sources|import-batches|external-items|inventory\/balances)$/.test(path)) return route.fulfill({ json: [] });
    // Adjacent imports panels are outside this scenario and show explicit failures.
    if (["/operations/dashboard", "/operations/capabilities", "/integrations/readiness", "/moderation/import-reviews", "/catalog/products"].includes(path)) return route.fulfill({ status: 503, json: { message: "Adjacent fixture unavailable" } });
    unexpected.push(path);
    return route.fulfill({ status: 503, json: { message: "Unmodeled fixture endpoint" } });
  });
  await page.goto("/admin?section=imports");
  const region = page.getByRole("region", { name: "Загрузка товаров поставщика", exact: true });
  await expect(region.getByText("INITIAL_SELECTION", { exact: true })).toBeVisible();
  await region.getByRole("button", { name: /Подключение 6/ }).click();
  await expect.poll(() => held).toBeTruthy();
  await region.getByRole("button", { name: /Подключение 7/ }).click();
  await expect(region.getByText("CURRENT_SELECTION", { exact: true })).toBeVisible();
  release();
  await expect(region.getByText("OLD_SELECTION", { exact: true })).toHaveCount(0);
  fail = true;
  await region.getByRole("button", { name: /Подключение 7/ }).click();
  await expect(page.locator(".dm-save-toast").filter({ hasText: "Текущая сверка временно недоступна" })).toBeVisible();
  fail = false;
  await region.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(region.getByText("CURRENT_SELECTION", { exact: true })).toBeVisible();
  await expect(region.getByRole("button", { name: "Повторить загрузку" })).toHaveCount(0);
  await region.getByRole("combobox", { name: "Поставщик", exact: true }).selectOption(id(4));
  await expect(region.getByText("Подключений пока нет. Добавьте учётную систему.")).toBeVisible();
  await expect(region.getByText("CURRENT_SELECTION", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("integration-empty-supplier.png"), fullPage: true });
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});
