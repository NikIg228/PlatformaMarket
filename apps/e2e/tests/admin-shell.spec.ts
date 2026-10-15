import { test, expect, type Page, type Route } from "@playwright/test";

const actor = "30000000-0000-4000-8000-000000000001";
const organization = "20000000-0000-4000-8000-000000000001";
const sessionId = "10000000-0000-4000-8000-000000000001";
const userName = "Оператор проверки оболочки с длинным именем";

async function shellPage(page: Page, ticketCount = 0, logout?: (route: Route) => Promise<void>) {
  const unexpected: string[] = [];
  await page.addInitScript(({ actor, organization, sessionId, userName }) => {
    sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({
      accessToken: "synthetic-shell-ui-proof-not-a-real-jwt", sessionId,
      activeOrganizationId: organization, user: { id: actor, displayName: userName }, expiresAt: Date.now() + 3600000,
    }));
  }, { actor, organization, sessionId, userName });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/organizations") return route.fulfill({ json: [{ id: organization, capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: new Date().toISOString() } });
    if (path === "/operations/work-queue/assignees") return route.fulfill({ json: [] });
    if (path === "/access-control/permissions") return route.fulfill({ json: ["support.ticket.view"] });
    if (path === "/support/tickets") return route.fulfill({ json: Array.from({ length: ticketCount }, (_, index) => ({
      id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, number: `SHELL-${index + 1}`,
      subject: "Проверка длинной страницы обращений", description: "Синтетическое обращение", status: "OPEN", priority: "NORMAL", assigneeId: null, slaDueAt: null,
    })) });
    if (path === "/auth/session-logout" && logout) return logout(route);
    unexpected.push(path);
    return route.fulfill({ status: 500, json: { message: "Unexpected shell fixture endpoint" } });
  });
  await page.goto("/admin?section=support");
  await expect(page.getByRole("heading", { level: 1, name: "Обращения и споры" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Обновить", exact: true })).toHaveCount(0);
  return unexpected;
}

test("shell keeps navigation and profile reachable on short and long viewports", async ({ page }, info) => {
  const unexpected = await shellPage(page, 20);
  const records = [];
  for (const [width, height] of [[1440, 900], [1440, 695], [768, 900], [390, 844], [760, 900], [761, 900]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready; });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const profile = page.getByRole("button", { name: "Меню профиля", exact: true });
    await expect(profile).toBeVisible();
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCSS("font-family", /Manrope/);
    await expect(heading).toHaveCSS("font-size", width <= 760 ? "18px" : "20px");
    await expect(heading).toHaveCSS("font-weight", "600");
    if (width > 760) {
      const side = page.getByRole("complementary", { name: "Основная навигация" });
      expect((await side.boundingBox())?.width).toBe(200);
      expect((await side.boundingBox())?.height).toBe(height);
      await expect(side.getByRole("link", { name: "Обращения и споры", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("button", { name: "Открыть меню", exact: true })).toBeHidden();
    } else {
      await expect(page.getByRole("complementary", { name: "Основная навигация" })).toBeHidden();
      await expect(page.getByRole("button", { name: "Открыть меню", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath(`shell-${width}x${height}.png`), animations: "disabled" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const box = await profile.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThan(height);
    await profile.click();
    await expect(page.getByText(userName, { exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Выйти", exact: true })).toBeVisible();
    const style = await profile.evaluate(element => ({ height: element.getBoundingClientRect().height, radius: getComputedStyle(element).borderRadius }));
    expect(style).toEqual({ height: 44, radius: "8px" });
    records.push({ width, height, profile: box, style });
    await page.keyboard.press("Escape");
    await expect(profile).toBeFocused();
  }
  await info.attach("shell-viewports", { body: JSON.stringify(records), contentType: "application/json" });
  expect(unexpected).toEqual([]);
});

async function assignmentPage(page: Page) {
  const unexpected = await shellPage(page);
  await page.route("**/api/catalog/products", route => route.fulfill({ json: [] }));
  await page.route("**/api/operations/dashboard", route => route.fulfill({ json: {
    observedAt: new Date().toISOString(), scope: "PLATFORM_CURRENT_ALL_STATUSES",
    organizations: { status: "AVAILABLE", value: 1 }, masterProducts: { status: "AVAILABLE", value: 0 }, effectivePermissions: { status: "AVAILABLE", value: 1 },
  } }));
  await page.route("**/api/operations/work-queue?offset=0", route => route.fulfill({ json: {
    generatedAt: new Date().toISOString(), operatorOrganizationId: organization, totalOpenItems: 1,
    sections: [{ type: "CATALOG_REVIEW", priority: "NORMAL", count: 1, hasMore: false,
      items: [{ id: actor, proposedName: "Проверка загрузки назначения", reason: "Нужно проверить карточку", href: "/admin?section=catalog", assignment: null }] }],
  } }));
  await page.route("**/api/operations/work-queue/*/*/history", route => route.fulfill({ json: [] }));
  await page.getByRole("link", { name: "Обзор", exact: true }).click();
  const opener = page.getByRole("button", { name: "Назначение и история", exact: true });
  await expect(opener).toBeVisible();
  return { opener, unexpected };
}

test("assignment loader remains closed when its pending chunk finishes after Escape", async ({ page }) => {
  const { opener, unexpected } = await assignmentPage(page);
  let release!: () => void;
  let intercepted = false;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    if ((await response.text()).includes("Назначение сохранено.")) {
      intercepted = true;
      await pending;
    }
    await route.fulfill({ response });
  });
  await opener.click();
  await expect.poll(() => intercepted).toBe(true);
  await expect(page.getByRole("dialog", { name: "Назначение задачи", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Задача: Проверка загрузки назначения", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Назначение ещё не менялось.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(unexpected).toEqual([]);
});

test("assignment loader retries a failed chunk without losing its selected task", async ({ page }) => {
  const { opener, unexpected } = await assignmentPage(page);
  let rejected = false;
  let rejectChunk = true;
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    if (rejectChunk && (await response.text()).includes("Назначение сохранено.")) {
      rejected = true;
      return route.abort("failed");
    }
    await route.fulfill({ response });
  });
  await opener.click();
  await expect(page.getByText("Не удалось открыть назначение.", { exact: true })).toBeVisible();
  rejectChunk = false;
  await page.getByRole("button", { name: "Повторить открытие", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Задача: Проверка загрузки назначения", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Назначение ещё не менялось.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(rejected).toBe(true);
  expect(unexpected).toEqual([]);
});

test("shell drawer traps focus, closes on Escape and leaves no hidden tab stops", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const unexpected = await shellPage(page);
  await expect(page.getByRole("navigation", { name: "Разделы кабинета" })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Открыть меню", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Операторский кабинет" });
  await expect(drawer).toBeVisible();
  for (let index = 0; index < 26; index++) {
    await page.keyboard.press(index < 13 ? "Tab" : "Shift+Tab");
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await expect(drawer.getByRole("button", { name: "Выйти", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("drawer-focus.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden(); await expect(trigger).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".mp-shell-sidebar,.mp-shell-drawer")))).toBe(false);
  await trigger.click();
  await page.setViewportSize({ width: 761, height: 900 });
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("link", { name: "Обращения и споры", exact: true })).toBeFocused();
  expect(unexpected).toEqual([]);
});

test("shell preserves real link destinations and permits logout recovery", async ({ page }) => {
  let count = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const unexpected = await shellPage(page, 0, async route => {
    count++;
    expect(route.request().postDataJSON().sessionId).toBe(sessionId);
    if (count === 1) { await pending; return route.fulfill({ status: 503, json: { message: "Synthetic retry" } }); }
    return route.fulfill({ json: { sessionId, status: "REVOKED", loginStatus: "SAME_SESSION" } });
  });
  const link = page.getByRole("link", { name: "Обращения и споры", exact: true });
  await expect(link).toHaveAttribute("href", "/admin?section=support");
  const [other] = await Promise.all([page.context().waitForEvent("page"), link.click({ modifiers: ["Control"] })]);
  await expect(other).toHaveURL(/\/admin\?section=support$/); await other.close();
  await expect(page.getByRole("heading", { level: 1, name: "Обращения и споры" })).toBeVisible();
  await page.getByRole("button", { name: "Меню профиля", exact: true }).click();
  await page.getByRole("menuitem", { name: "Выйти", exact: true }).click();
  await expect.poll(() => count).toBe(1);
  await expect(page.getByRole("button", { name: "Меню профиля", exact: true })).toHaveAttribute("aria-busy", "true");
  release();
  await expect(page.getByRole("button", { name: "Повторить выход", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("dentmarket_admin_session") ?? "null")?.sessionId)).toBe(sessionId);
  await page.getByRole("button", { name: "Повторить выход", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(count).toBe(2); expect(unexpected).toEqual([]);
});
