import { expect, test, type Page } from "@playwright/test";

const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const operator = id(1);
const correction = (number: number, name: string) => ({
  id: id(number), field: "CANONICAL_NAME", currentValue: name,
  proposedValue: `Предложено ${name}`, reason: "Синтетическая проверка исправления",
  evidenceUrl: null, createdAt: "2026-11-08T00:00:00Z",
  product: { canonicalName: name, brand: null, manufacturer: null },
  supplier: { organization: { displayName: "Поставщик проверки" } },
});

async function fixtures(page: Page) {
  const state = {
    createFails: false, reloadFails: false, decisionFails: false,
    pending: [correction(10, "Товар А"), correction(11, "Товар Б")],
    writes: [] as { path: string; body: Record<string, unknown> }[],
  };
  await page.addInitScript(operatorId => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({
    accessToken: "local-ui-fixture-not-a-token", sessionId: "00000000-0000-4000-8000-000000000003",
    user: { id: "00000000-0000-4000-8000-000000000002", displayName: "Оператор проверки" },
    activeOrganizationId: operatorId, expiresAt: Date.now() + 3600000,
  })), operator);
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      const path = url.pathname.slice(4);
      if (request.method() === "POST") {
        state.writes.push({ path, body: request.postDataJSON() as Record<string, unknown> });
        if (path === "/organizations" || path === "/catalog/attributes") {
          return route.fulfill({ status: state.createFails ? 409 : 201, json: { id: id(20) } });
        }
        if (path.startsWith("/moderation/product-corrections/")) {
          if (state.decisionFails) return route.fulfill({ status: 503, json: { message: "Повторите позже" } });
          state.pending = state.pending.filter(item => !path.includes(item.id));
          return route.fulfill({ status: 201, json: { status: "APPROVED" } });
        }
        return route.fulfill({ status: 503, json: { message: "Незапланированная запись заблокирована" } });
      }
      if (path === "/moderation/product-corrections") {
        return route.fulfill({ status: state.reloadFails ? 503 : 200, json: state.pending });
      }
      if (path === "/organizations") return route.fulfill({ json: [{ id: operator, displayName: "Оператор проверки", bin: "990000000001", capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
      if (path === "/catalog/attributes" || path === "/catalog/categories") return route.fulfill({ json: [] });
      if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: new Date().toISOString() } });
      if (path === "/health/ready") return route.fulfill({ json: { status: "ready" } });
      return route.fulfill({ status: 503, json: { message: "Виджет вне локального сценария" } });
    }
    if (url.origin === "http://127.0.0.1:3308" && request.method() === "GET") return route.continue();
    return route.abort("blockedbyclient");
  });
  return state;
}

for (const [width, locale] of [[1440, "ru"], [390, "kk"]] as const) {
  test.describe(`${width} ${locale}`, () => {
    test.use({ locale: locale === "kk" ? "kk-KZ" : "ru-RU" });
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("organization success, failed creation and keyboard recovery", async ({ page }, info) => {
      const state = await fixtures(page);
      await page.goto("/admin?section=organizations");
      await page.getByRole("button", { name: "Создать организацию", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator('[name="legalName"]').fill("Тестовая организация");
      await dialog.locator('[name="displayName"]').fill("Организация проверки");
      await dialog.locator('[name="bin"]').fill("990000000099");
      state.createFails = true;
      const submit = page.getByRole("button", { name: "Создать", exact: true });
      await submit.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Организация не создана", { exact: true })).toBeVisible();
      await expect(dialog.locator('[name="displayName"]')).toHaveValue("Организация проверки");
      state.createFails = false;
      await submit.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Организация создана", { exact: true })).toBeVisible();
      await expect(page.getByText("Организация не создана", { exact: true })).toHaveCount(0);
      await expect(dialog.locator('[name="displayName"]')).toHaveValue("");
      await expect(dialog.locator('[name="legalName"]')).toBeFocused();
      expect(state.writes.filter(item => item.path === "/organizations")).toHaveLength(2);
      await page.screenshot({ path: info.outputPath("organization-success.png") });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    });

    test("attribute creation resets only after success", async ({ page }) => {
      const state = await fixtures(page);
      await page.goto("/admin?section=catalog");
      const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Создать атрибут", exact: true }) });
      await form.locator('[name="code"]').fill("local_material");
      await form.locator('[name="nameRu"]').fill("Материал проверки");
      await form.locator('[name="nameKk"]').fill("Тексеру материалы");
      state.createFails = true;
      await form.getByRole("button", { name: "Создать атрибут", exact: true }).click();
      await expect(page.getByText("API вернул статус 409", { exact: true })).toBeVisible();
      await expect(form.locator('[name="code"]')).toHaveValue("local_material");
      state.createFails = false;
      await form.getByRole("button", { name: "Создать атрибут", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Определение атрибута создано.", { exact: true })).toBeVisible();
      await expect(form.locator('[name="code"]')).toHaveValue("");
      expect(state.writes.filter(item => item.path === "/catalog/attributes")).toHaveLength(2);
    });

    test("decision and failed reload retain another correction draft", async ({ page }, info) => {
      const state = await fixtures(page);
      await page.goto("/admin?section=catalog");
      const queue = page.locator('section[aria-labelledby="product-corrections-title"]');
      const first = queue.locator("article").filter({ has: page.getByRole("heading", { name: "Товар А", exact: true }) });
      const second = queue.locator("article").filter({ has: page.getByRole("heading", { name: "Товар Б", exact: true }) });
      const draft = second.getByRole("textbox", { name: "Значение для публикации" });
      await draft.fill("Мой несохранённый вариант Б");
      await second.getByRole("textbox", { name: "Комментарий поставщику" }).fill("Сохранить комментарий Б");
      await first.getByRole("textbox", { name: "Комментарий поставщику" }).fill("Принять исправление А");
      state.decisionFails = true;
      await first.getByRole("button", { name: "Принять", exact: true }).click();
      await expect(page.getByText("Решение не сохранено. Проверьте права и повторите попытку.")).toBeVisible();
      state.decisionFails = false;
      await queue.getByRole("button", { name: "Повторить", exact: true }).click();
      await expect(draft).toHaveValue("Мой несохранённый вариант Б");
      await expect(first.getByRole("textbox", { name: "Комментарий поставщику" })).toHaveValue("Принять исправление А");
      state.reloadFails = true;
      await first.getByRole("button", { name: "Принять", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Решение сохранено", { exact: true })).toBeVisible();
      await expect(page.getByText("API отклонил запрос очереди", { exact: true })).toBeVisible();
      await page.getByRole("status").filter({ hasText: "Решение сохранено" })
        .getByRole("button", { name: "Закрыть уведомление" }).click();
      await expect(queue.getByRole("alert")).toContainText("API отклонил запрос очереди");
      const retry = queue.getByRole("button", { name: "Повторить", exact: true });
      await retry.focus();
      await expect(retry).toBeFocused();
      await page.screenshot({ path: info.outputPath("queue-error-recovery.png") });
      state.reloadFails = false;
      await page.keyboard.press("Enter");
      await expect(first).toHaveCount(0);
      await expect(draft).toHaveValue("Мой несохранённый вариант Б");
      await expect(second.getByRole("textbox", { name: "Комментарий поставщику" })).toHaveValue("Сохранить комментарий Б");
      expect(state.writes.filter(item => item.path.endsWith("/approve"))).toHaveLength(2);
      expect(state.writes.at(-1)?.body.acceptedValue).toBe("Предложено Товар А");
      await page.screenshot({ path: info.outputPath("preserved-draft.png") });
      await draft.fill("");
      await expect(second.getByRole("button", { name: "Принять с редактурой", exact: true })).toBeDisabled();
      await second.getByRole("button", { name: "Отклонить", exact: true }).click();
      await expect(queue.getByText("Новых исправлений нет", { exact: true })).toBeVisible();
    });
  });
}
