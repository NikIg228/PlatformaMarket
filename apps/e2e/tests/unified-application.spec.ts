import { expect, test } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import path from "node:path";

test("password login, cookie refresh and legacy return use the same-origin proxy", async ({ page }) => {
  const fixture = await installPilotWorkspace(page, "BUYER");
  const db = new PrismaClient();
  const login = await page.context().newPage(); // No injected workspace session on this page.
  try {
    const { passwordHash } = createRequire(__filename)(path.resolve(__dirname, "../../api/dist/src/modules/identity/password-codec.js"));
    const password = "Synthetic-unified-password-2026!";
    await db.user.update({ where: { id: fixture.userId }, data: { passwordHash: passwordHash(password) } });
    await login.goto("/documents");
    expect(new URL(login.url()).origin).toBe("http://127.0.0.1:3000");
    await expect(login).toHaveURL(/\/login\?returnTo=%2Fdocuments/);
    await login.locator('input[type="email"]').fill(fixture.email);
    await login.locator('input[type="password"]').fill(password);
    await login.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(login).toHaveURL(/\/clinic\/documents$/);
    await expect(login.getByRole("heading", { name: /Документы/ }).first()).toBeVisible();
    await login.evaluate(() => sessionStorage.clear());
    await login.reload();
    await expect(login.getByRole("heading", { name: /Документы/ }).first()).toBeVisible();
    const post = await login.request.post("/documents", { maxRedirects: 0 });
    expect(post.status()).toBe(405);
    await login.goto("/catalog");
    await login.locator("header").getByRole("link", { name: /Личный кабинет/ }).click();
    await login.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(login).toHaveURL(/\/login$/);
    await login.goto("/catalog");
    await expect(login.locator("header").getByRole("link", { name: "Войти", exact: true })).toBeVisible();
    await login.reload();
    await expect(login.locator("header").getByRole("link", { name: "Войти", exact: true })).toBeVisible();
    await login.goto("/login");
    await expect(login.locator('input[type="email"]')).toBeVisible();
    expect(await (await login.request.get("/api/auth/current")).json()).toBeNull();
  } finally { await login.close(); await fixture.dispose(); await db.$disconnect(); }
});

test("public catalog, product and auth stay on one origin", async ({ page }) => {
  const external: string[] = [];
  page.on("request", request => { if (/127\.0\.0\.1:(3001|3002|3003|4012)/.test(request.url())) external.push(request.url()); });
  await page.goto("/catalog?sort=PRICE_ASC");
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(24);
  await cards.first().getByRole("link", { name: /Открыть карточку/ }).click();
  await expect(page).toHaveURL(/:3000\/products\//);
  await page.getByRole("link", { name: "← Вернуться в каталог" }).click();
  await expect(page).toHaveURL(/sort=PRICE_ASC/);
  await page.locator("header").getByRole("link", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/:3000\/login\?returnTo=/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  expect(external).toEqual([]);
});

for (const [capability, root] of [["BUYER", "/clinic"], ["SUPPLIER", "/supplier"]] as const) {
  test(`${capability} session and documents use their scoped routes`, async ({ page }) => {
    const fixture = await installPilotWorkspace(page, capability);
    try {
      await page.goto(root);
      if (capability === "BUYER") await expect(page.getByText(fixture.displayName, { exact: true }).first()).toBeVisible();
      else await expect(page.getByText(fixture.displayName, { exact: true }).first()).toBeVisible();
      await page.goto(root + "/documents");
      await expect(page.getByRole("heading", { name: /Документы/ }).first()).toBeVisible();
      await expect(page.getByText("Войдите в кабинет", { exact: true })).toHaveCount(0);
      const forbidden = await page.request.get("/api/organizations");
      expect([401, 403]).toContain(forbidden.status());
    } finally { await fixture.dispose(); }
  });
}

test("guest operator route requires its separate sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByText("Панель оператора", { exact: true })).toHaveCount(0);
});

test("auth CSS stays scoped on mobile catalog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.goto("/catalog");
  await expect(page.getByTestId("product-card")).toHaveCount(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 600));
  expect((await page.locator("header").first().boundingBox())!.y).toBe(0);
});
