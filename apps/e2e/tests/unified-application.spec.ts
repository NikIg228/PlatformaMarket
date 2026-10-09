import { expect, test } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DOCUMENT_UPLOAD_MAX_BYTES, IMPORT_UPLOAD_MAX_JSON_BYTES, uploadedDocumentSchema } from "@marketplace/schemas";
import { request as httpRequest } from "node:http";

test("CORE08 maximum document upload and safe body rejection cross the real same-origin proxy", async ({ page }) => {
  const fixture = await installPilotWorkspace(page, "BUYER", ["document.upload"]);
  try {
    await page.goto("/clinic/documents");
    const oversized = await page.request.post("/api/auth/login", { data: { password: "A".repeat(1_048_576) } });
    expect(oversized.status()).toBe(413);
    expect(await oversized.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE", path: "/api/auth/login", requestId: expect.any(String) });
    const chunkedStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(`http://127.0.0.1:3000/api/suppliers/${fixture.organizationId}/import-batches`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20_000),
      }, response => { response.resume(); response.on("end", () => resolve(response.statusCode!)); });
      request.on("error", reject);
      request.write('{"contentBase64":"'); request.write("A".repeat(IMPORT_UPLOAD_MAX_JSON_BYTES)); request.end('"}');
    });
    expect(chunkedStatus).toBe(413);
    const { PDFDocument } = createRequire(__filename)("pdf-lib");
    const pdf = await PDFDocument.create(); pdf.addPage();
    const buffer = Buffer.alloc(DOCUMENT_UPLOAD_MAX_BYTES, 32);
    Buffer.from(await pdf.save()).copy(buffer);
    const number = `CORE08-${randomUUID()}`;
    await page.getByRole("button", { name: "Загрузить документ", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Тип документа\s*\*?$/).selectOption("OTHER");
    await dialog.getByRole("textbox", { name: "Название", exact: true }).fill("CORE08 максимальный PDF");
    await dialog.getByRole("textbox", { name: "Номер", exact: true }).fill(number);
    await dialog.getByLabel("Файл PDF или DOCX", { exact: true }).setInputFiles({ name: "maximum.pdf", mimeType: "application/pdf", buffer });
    const response = page.waitForResponse(value => value.url().endsWith("/api/documents/upload") && value.request().method() === "POST");
    await dialog.getByRole("button", { name: "Загрузить", exact: true }).click();
    const uploaded = await response;
    expect(uploaded.status()).toBe(201);
    const result = uploadedDocumentSchema.parse(await uploaded.json());
    expect(result).toMatchObject({ ownerOrganizationId: fixture.organizationId, documentNumber: number, byteSize: DOCUMENT_UPLOAD_MAX_BYTES });
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: number })).toBeVisible();
  } finally { await fixture.dispose(); }
});

for (const width of [390, 1440]) test(`shared theme auth audit ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-input-modality", /pointer|keyboard/);
  const email = page.locator('input[type="email"]');
  await email.fill("theme-audit@example.test");
  await page.locator('input[type="password"]').fill("Synthetic-password-only!");
  await expect(email).toHaveValue("theme-audit@example.test");
  await page.mouse.move(0, 0);
  await expect(email.locator("..")).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await page.keyboard.press("Tab");
  await email.focus();
  await expect(email).toHaveCSS("outline-style", "none");
  await expect(email.locator("..")).toHaveCSS("outline-color", "rgb(0, 122, 89)");
  await expect(email.locator("..")).toHaveCSS("outline-width", "1px");
  await expect(email.locator("..")).toHaveCSS("outline-offset", "2px");
  const submit = page.getByRole("button", { name: "Войти", exact: true });
  await expect(submit).toHaveCSS("background-color", "rgb(0, 122, 89)");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route("**/api/auth/login", async route => {
    writes++;
    await held;
    await route.fulfill({ status: 401, json: { message: "Тестовая ошибка входа" } });
  });
  await submit.click();
  const pending = page.getByRole("button", { name: "Входим…", exact: true });
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveCSS("background-color", "rgb(238, 241, 239)");
  await expect(email).toBeDisabled();
  await expect(email.locator("..")).toHaveCSS("background-color", "rgb(238, 241, 239)");
  await expect.poll(() => writes).toBe(1);
  await pending.evaluate((button: HTMLButtonElement) => button.click());
  expect(writes).toBe(1);
  release();
  await expect(page.locator(".authNotice-error")).toBeVisible();
  await expect(page.locator(".authNotice-error")).toHaveCSS("color", "rgb(163, 59, 53)");
  await expect(email).toHaveValue("theme-audit@example.test");
  await page.screenshot({ path: testInfo.outputPath(`theme-auth-error-${width}.png`), fullPage: true });
  for (const route of ["/register", "/admin/login", "/about", "/suppliers"]) {
    await page.goto(route);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (route === "/register") {
      await expect(page.locator('.rolePicker [data-selected="true"]')).toHaveCSS("background-color", "rgb(228, 243, 237)");
      await expect(page.locator('.registrationSubmit')).toHaveCSS("background-color", "rgb(0, 122, 89)");
    }
    await page.screenshot({ path: testInfo.outputPath(`theme-${route.slice(1).replaceAll("/", "-")}-${width}.png`) });
  }
});

test("persisted dark preference keeps the approved light contract", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("marketplace-theme", "dark"));
  await page.goto("/catalog");
  await expect.poll(() => page.locator(".mp-provider").first().evaluate(element =>
    getComputedStyle(element).getPropertyValue("--colorNeutralBackground1").trim())).toBe("#FFFFFF");
  expect(await page.evaluate(() => localStorage.getItem("marketplace-theme"))).toBe("dark");
});

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
    await login.getByRole("button", { name: "Меню профиля", exact: true }).click();
    await login.getByRole("menuitem", { name: "Выйти", exact: true }).click();
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
      const sidebar = page.locator("#workspace-sidebar");
      await expect(sidebar.getByRole("navigation", { name: capability === "BUYER" ? "Кабинет клиники" : "Кабинет поставщика" })).toBeVisible();
      await expect(sidebar.getByText(fixture.displayName, { exact: true })).toHaveCount(0);
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
