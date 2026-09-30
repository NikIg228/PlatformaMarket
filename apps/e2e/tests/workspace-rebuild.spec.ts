import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("performance admin supplier loads once and preserves operations", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "admin-ui-fixture" })));
  const supplierId = "44444444-4444-4444-8444-444444444444";
  const reads: string[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    reads.push(path);
    if (path !== "/suppliers" && !path.startsWith(`/suppliers/${supplierId}/`) && path !== "/catalog/products" && path !== "/moderation/import-reviews")
      return route.fulfill({ status: 503, json: { message: "Виджет не участвует в измерении" } });
    const data = path === "/suppliers" ? [{ organizationId: supplierId, organization: { displayName: "Поставщик измерения", bin: "970000000002" }, warehouses: [], dataSources: [], _count: { importBatches: 0 } }]
      : path === "/moderation/import-reviews" ? { items: [], options: { industries: [], categories: [], units: [] } } : [];
    await route.fulfill({ json: data });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Загрузка товаров", exact: true }).click();
  const section = page.getByRole("region", { name: "Товары поставщика", exact: true });
  await expect(section.getByRole("heading", { name: "Партии и резервы", exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: "Обновить", exact: true })).toBeEnabled();
  const measurements = Object.fromEntries([...new Set(reads)].map(path => [path, reads.filter(item => item === path).length]));
  const output = testInfo.outputPath("admin-requests.json");
  await writeFile(output, JSON.stringify(measurements, null, 2));
  await testInfo.attach("admin-requests", { path: output, contentType: "application/json" });
  expect(measurements[`/suppliers/${supplierId}/inventory/balances`]).toBe(1);
  expect(measurements[`/suppliers/${supplierId}/import-batches`]).toBe(1);
  expect(measurements[`/suppliers/${supplierId}/external-items`]).toBe(1);
  await expect(section.getByRole("button", { name: "Добавить склад", exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: "Загрузить и обработать", exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: "Создать предложение", exact: true })).toBeVisible();
});

const organizationId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const cityId = "33333333-3333-4333-8333-333333333333";
const profile = {
  organizationId,
  legalName: "Тестовая организация",
  displayName: "Тестовая организация",
  bin: "970000000001",
  version: 1,
  canEdit: true,
  complete: true,
  profile: {
    contactName: "Тестовый пользователь",
    phone: "+77000000000",
    email: "fixture@example.invalid",
    legalAddress: { cityId, line1: "Тестовый адрес 1", postalCode: null },
    deliveryAddress: { cityId, line1: "Тестовый адрес 1", postalCode: null },
  },
};

test("A14 mobile menu closes on immediate Escape after Enter or Space", async ({ page }) => {
  await fixture(page, "SUPPLIER");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/supplier/products");
  const toggle = page.locator("#workspace-menu-toggle");
  for (const key of ["Enter", "Space"]) {
    await toggle.focus(); await page.keyboard.press(key);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  }
  await toggle.click();
  const navigation = page.getByRole("navigation", { name: "Кабинет поставщика" });
  const first = navigation.getByRole("link", { name: "Главная", exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: "Товары", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(first).toBeFocused();
  await navigation.getByRole("link", { name: "Заказы", exact: true }).click();
  await expect(page).toHaveURL(/\/supplier\/orders$/);
  await expect(navigation).toBeHidden(); await expect(toggle).toBeFocused();
  await toggle.click(); await expect(first).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(navigation).toBeVisible(); await expect(toggle).toBeHidden();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden(); await expect(toggle).toBeFocused();
});

for (const width of [1440, 390]) test(`A13 offer information distinguishes expired price, packaging and reserved stock ${width}`, async ({ page }) => {
  await fixture(page, "SUPPLIER"); await page.setViewportSize({ width, height: 950 });
  const offer = { id: "offer-a", status: "ACTIVE", sourceType: "MANUAL", supplierSku: "A13", productVariant: { product: { canonicalName: "Упаковка 10 штук" } },
    saleUnit: { nameRu: "упаковка", symbol: "уп." }, packaging: { name: "10 штук", quantityInBaseUnit: "10", unit: { symbol: "шт." } },
    baseUnitsPerSaleUnit: "10", minimumOrderQuantity: "2", orderIncrement: "2", publication: { marketplaceVisible: true },
    prices: [{ id: "price", status: "ACTIVE", amountMinor: "9007199254740993", currency: "KZT", source: "MANUAL", lastConfirmedAt: "2020-01-01T00:00:00Z", freshnessExpiresAt: "2020-01-02T00:00:00Z" }],
    inventoryBalances: [{ id: "balance", warehouse: { name: "Основной склад" }, quantityAvailable: "0", quantityReserved: "3", freshnessStatus: "STALE", source: "IMPORT", updatedAt: "2020-01-01T00:00:00Z", freshnessExpiresAt: "2020-01-02T00:00:00Z" }],
  };
  await page.route("**/api/workspaces/supplier/offers*", route => route.fulfill({ json: { items: [offer, { ...offer, id: "offer-b", supplierSku: "A13-B", productVariant: { product: { canonicalName: "Поштучный товар" } }, saleUnit: { nameRu: "штука", symbol: "шт." }, packaging: null, baseUnitsPerSaleUnit: "1", minimumOrderQuantity: "1", orderIncrement: "1", prices: [{ ...offer.prices[0], amountMinor: "10000", lastConfirmedAt: null, freshnessExpiresAt: null }], inventoryBalances: [] }], nextCursor: null } }));
  await page.goto("/supplier/products");
  const row = page.getByRole("row").filter({ hasText: "Упаковка 10 штук" });
  await expect(row).toContainText(/90\s071\s992\s547\s409[,.]93/);
  await expect(row).toContainText("за уп."); await expect(row).toContainText("10 базовых ед.");
  await expect(row).toContainText("Минимум: 2; шаг: 2"); await expect(row).toContainText("доступно 0; в резерве 3");
  await expect(row).toContainText("Основной склад (уп.):");
  await expect(row.getByText(/Срок подтверждения истёк/)).toHaveCount(2);
  await expect(row).toContainText("Источник цены: ручной ввод"); await expect(row).toContainText("Источник остатка: импорт");
  const unknown = page.getByRole("row").filter({ hasText: "Поштучный товар" });
  await expect(unknown).toContainText("В единице продажи: 1 базовых ед.");
  await expect(unknown).toContainText("Срок подтверждения не указан"); await expect(unknown).toContainText("Подтверждено: не указано");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../../outputs/workspace-audit-a13-${width}.png`, fullPage: true });
});

test("A15 order PDF boundaries and retry preserve the file and workflow identity", async ({ page }) => {
  await fixture(page, "SUPPLIER");
  const id = "55555555-5555-4555-8555-555555555555";
  const order = { id, orderNumber: "PDF-BOUNDARY", version: 1, supplierOrganizationId: organizationId, buyerOrganizationId: cityId, status: "CONFIRMED", paymentStatus: "UNPAID", currency: "KZT", subtotalAmountMinor: "10000", items: [], shipments: [] };
  const commands: Array<{ idempotencyKey: string }> = [], uploads: number[] = [];
  await page.route(`**/api/supplier-orders/${id}/workflow`, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { order, status: order.status, paymentStatus: "UNPAID", version: 1, claims: [], documents: [], events: [], invoiceDocumentId: null } });
    commands.push(route.request().postDataJSON());
    if (commands.length === 1) return route.fulfill({ status: 503, json: { message: "Повторите подтверждение" } });
    return route.fulfill({ json: {} });
  });
  await page.route("**/api/documents/upload", async route => {
    const data = route.request().postDataJSON(), body = Buffer.from(data.contentBase64, "base64"); uploads.push(body.length);
    if (body.subarray(0, 5).toString() !== "%PDF-") return route.fulfill({ status: 400, json: { message: "Содержимое не является PDF" } });
    if (body.length > 100) return route.fulfill({ status: 503, json: { message: "Ошибка загрузки, повторите" } });
    return route.fulfill({ json: { id: "66666666-6666-4666-8666-666666666666" } });
  });
  await page.goto(`/supplier/orders/${id}`);
  const file = page.getByLabel("Счёт, PDF до 10 МБ (10 000 000 байт)");
  const send = page.getByRole("button", { name: "Выставить счёт", exact: true });
  for (const size of [9_999_999, 10_000_000]) {
    const buffer = Buffer.alloc(size, 32); buffer.write("%PDF-1.7\n");
    await file.setInputFiles({ name: "boundary.pdf", mimeType: "application/pdf", buffer });
    await send.click(); await expect(page.getByText("Ошибка загрузки, повторите", { exact: true })).toBeVisible();
    await expect(send).toBeEnabled();
  }
  expect(uploads).toEqual([9_999_999, 10_000_000]);
  for (const [name, size, message] of [["too-large.pdf", 10_000_001, "Размер файла не должен превышать 10 МБ (10 000 000 байт)."], ["empty.pdf", 0, "Файл пуст. Выберите документ с содержимым."], ["wrong.txt", 5, "Поддерживаются только PDF и DOCX."]] as const) {
    await file.setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.alloc(size, 32) });
    await send.click(); await expect(page.getByText(message, { exact: true })).toBeVisible(); await expect(send).toBeEnabled();
    expect(uploads).toHaveLength(2);
  }
  await file.setInputFiles({ name: "renamed.pdf", mimeType: "application/pdf", buffer: Buffer.from("not PDF") });
  await send.click(); await expect(page.getByText("Содержимое не является PDF", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(0);
  await file.setInputFiles({ name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nfixture") });
  await send.click(); await expect(page.getByText("Повторите подтверждение", { exact: true })).toBeVisible();
  await expect(send).toBeEnabled();
  expect(await file.evaluate(element => (element as HTMLInputElement).files?.[0]?.name)).toBe("invoice.pdf");
  await send.click();
  await expect(page.getByText("Изменение сохранено. Обе стороны увидят обновлённый статус.", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]); expect(uploads).toHaveLength(4);
});

async function fixture(
  page: Page,
  capability: "BUYER" | "SUPPLIER",
  failure?: string,
) {
  const calls: string[] = [];
  const unexpected: string[] = [];
  await page.addInitScript(
    ({ capability, organizationId, sessionId }) => {
      sessionStorage.setItem(
        `dentmarket:${capability.toLowerCase()}-session`,
        JSON.stringify({
          capability,
          organizationId,
          sessionId,
          accessToken: "ui-fixture-not-a-real-token",
          accessTokenExpiresAt: Date.now() + 3600000,
          organizationDisplayName: "Тестовая организация",
        }),
      );
    },
    { capability, organizationId, sessionId },
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    calls.push(path);
    if (path === failure)
      return route.fulfill({
        status: 503,
        json: { code: "UNAVAILABLE", message: "Сервер временно недоступен" },
      });
    let body: unknown;
    if (path === "/auth/workspace-context")
      body = {
        organizationId,
        organizationDisplayName: "Тестовая организация",
        capabilities: [capability],
      };
    else if (path === "/access-control/permissions") body = ["catalog.product.view", "catalog.offer.edit", "catalog.offer.publish", "import.manage", "inventory.view", "inventory.adjust", "inventory.freshness.manage", "pricing.manage", "order.create", "order.approve", "order.confirm", "payment.transfer.confirm", "document.view", "document.upload", "document.sign", "document.accounting.review", "compliance.view", "compliance.credential.manage", "shipment.manage", "delivery.view", "delivery.manage", "supplier.warehouse.manage"];
    else if (path === "/organizations/current/profile") body = profile;
    else if (path === "/organizations/current/onboarding")
      body = {
        organization: profile,
        capability,
        ready: true,
        steps: [
          {
            id: "organization",
            label: "Реквизиты",
            complete: true,
            reason: null,
            action: "profile",
          },
        ],
      };
    else if (path === "/auth/current") body = null;
    else if (path === "/catalog/cities")
      body = [
        { id: cityId, nameRu: "Павлодар", nameKk: "Павлодар", isActive: true },
      ];
    else if (
      path === `/buyers/${organizationId}/carts` ||
      path === `/suppliers/${organizationId}/offers` ||
      path === `/suppliers/${organizationId}/data-sources`
    )
      body = [];
    else if (path === "/workspaces/supplier/offers" || path === "/workspaces/buyer/orders" || path === "/workspaces/supplier/orders") body = { items: [], nextCursor: null };
    else if (path === "/workspaces/buyer/carts") body = { current: null, items: [], nextCursor: null };
    else if (path === "/workspaces/supplier/summary") body = { orders: 0, offers: 0, publishedOffers: 0 };
    else if (path === "/documents/archive/summary")
      body = {
        total: 0,
        awaitingSignature: 0,
        attention: 0,
        thisMonth: 0,
        byCategory: {},
      };
    else if (path === "/documents/archive")
      body = { items: [], nextCursor: null };
    else {
      unexpected.push(path);
      return route.fulfill({
        status: 500,
        json: { message: `Unexpected fixture path: ${path}` },
      });
    }
    await route.fulfill({ json: body });
  });
  return { calls, unexpected };
}

test("bounded supplier inventory loads and pages details only when expanded", async ({ page }) => {
  const state = await fixture(page, "SUPPLIER");
  const balance = { id: "balance-a", offerId: "offer-a", warehouse: { name: "Основной склад" }, productVariant: { product: { canonicalName: "Первый товар" } }, quantityOnHand: "5", quantityReserved: "1", quantityAvailable: "4", safetyStock: "0", freshnessStatus: "FRESH", updatedAt: "2026-01-01T00:00:00Z" };
  const details: string[] = [];
  await page.route(/\/api\/workspaces\/supplier\/inventory(?:\?|$)/, route => {
    const next = new URL(route.request().url()).searchParams.get("cursor");
    return route.fulfill({ json: { items: [next ? { ...balance, id: "balance-b", productVariant: { product: { canonicalName: "Второй товар" } } } : balance], nextCursor: next ? null : "balance-page-2" } });
  });
  await page.route("**/api/workspaces/supplier/inventory-overrides*", route => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.route("**/api/workspaces/supplier/inventory/balance-a/lots*", route => {
    details.push("lots");
    const next = new URL(route.request().url()).searchParams.get("cursor");
    return route.fulfill({ json: { items: [{ id: next ? "lot-b" : "lot-a", lotNumber: next ? "LOT-B" : "LOT-A", status: "AVAILABLE", quantityAvailable: "4", expirationDate: null }], nextCursor: next ? null : "lot-page-2" } });
  });
  await page.route("**/api/workspaces/supplier/inventory/balance-a/reservations*", route => {
    details.push("reservations");
    return details.filter(item => item === "reservations").length === 1
      ? route.fulfill({ status: 503, json: { message: "Повторите загрузку резервов" } })
      : route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.goto("/supplier/products/inventory");
  const row = page.getByRole("row").filter({ hasText: "Первый товар" });
  await expect(row).toBeVisible(); expect(details).toEqual([]);
  await row.getByRole("button", { name: "Показать партии", exact: true }).click();
  await expect(row.getByText(/LOT-A/)).toBeVisible(); expect(details).toEqual(["lots"]);
  await row.getByRole("button", { name: "Следующая страница", exact: true }).click();
  await expect(row.getByText(/LOT-B/)).toBeVisible();
  await row.getByRole("button", { name: "Показать резервы", exact: true }).click();
  await row.getByRole("button", { name: "Повторить загрузку резервов", exact: true }).click();
  await expect(row.getByText("Активных резервов нет.")).toBeVisible();
  await row.getByRole("button", { name: "Скрыть партии", exact: true }).click();
  await page.getByRole("button", { name: "Следующая страница", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Второй товар" })).toBeVisible();
  expect(details).toEqual(["lots", "lots", "reservations", "reservations"]);
  expect(state.calls.some(path => path.endsWith("/inventory/balances"))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("bounded correction pages preserve selected product and unsent draft", async ({ page }) => {
  const state = await fixture(page, "SUPPLIER");
  let submitted: { productId: string; proposedValue: string } | undefined;
  const product = { id: "product-a", canonicalName: "Карточка А", description: null, manufacturerSku: null, gtin: null, productType: "MATERIAL", regulatoryClass: null };
  await page.route("**/api/workspaces/supplier/correction-offers*", route => {
    const next = new URL(route.request().url()).searchParams.get("cursor");
    return route.fulfill({ json: { items: [{ id: next ? "offer-b" : "offer-a", productVariant: { product: next ? { ...product, id: "product-b", canonicalName: "Карточка Б" } : product } }], nextCursor: next ? null : "corrections-page-2" } });
  });
  await page.route("**/api/moderation/product-corrections", route => {
    if (route.request().method() === "POST") { submitted = route.request().postDataJSON(); return route.fulfill({ json: {} }); }
    return route.fulfill({ json: [] });
  });
  await page.goto("/supplier/products/corrections");
  const selection = page.getByRole("combobox", { name: "Товар", exact: true });
  await expect(selection).toHaveValue("product-a");
  await page.getByRole("textbox", { name: "Предлагаемая редакция", exact: true }).fill("Сохранённый черновик");
  await page.getByRole("textbox", { name: "Почему нужна правка", exact: true }).fill("Проверено по документу производителя");
  await page.getByRole("button", { name: "Следующая страница", exact: true }).click();
  await expect(selection.locator('option[value="product-b"]')).toHaveCount(1);
  await expect(selection).toHaveValue("product-a");
  await expect(page.getByRole("textbox", { name: "Предлагаемая редакция", exact: true })).toHaveValue("Сохранённый черновик");
  await page.getByRole("button", { name: "Отправить исправление", exact: true }).click();
  await expect(page.getByText("Исправление отправлено на проверку.")).toBeVisible();
  expect(submitted).toMatchObject({ productId: "product-a", proposedValue: "Сохранённый черновик" });
  expect(state.calls.some(path => path.endsWith(`/suppliers/${organizationId}/offers`))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("workspace GET is aborted when its filter is superseded", async ({ page }) => {
  await fixture(page, "SUPPLIER");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/workspaces/supplier/orders*", async route => {
    if (new URL(route.request().url()).searchParams.get("q") === "old") await held;
    await route.fulfill({ json: { items: [], nextCursor: null } }).catch(() => {});
  });
  await page.goto("/supplier/orders");
  await expect(page.getByRole("heading", { name: "Заказы", exact: true })).toBeVisible();
  const input = page.getByLabel("Поиск заказа", { exact: true });
  await input.fill("old");
  const sent = page.waitForRequest(request => request.url().includes("/workspaces/supplier/orders") && new URL(request.url()).searchParams.get("q") === "old");
  await page.getByRole("button", { name: "Найти", exact: true }).click(); await sent;
  const aborted = page.waitForEvent("requestfailed", { predicate: request => request.url().includes("/workspaces/supplier/orders") && new URL(request.url()).searchParams.get("q") === "old" });
  await input.fill("new"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  try { expect((await aborted).failure()?.errorText).toMatch(/ABORTED|CANCELLED/i); }
  finally { release(); }
  await expect(page.getByText("Нет подключения к сети", { exact: false })).toHaveCount(0);
});

for (const width of [1440, 390]) test(`A08 orders retain data offline, deduplicate focus and refresh on reconnect ${width}`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 });
  await fixture(page, "SUPPLIER");
  let version = 1, fail = false, count = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/workspaces/supplier/orders*", async route => {
    count++;
    if (release) await new Promise<void>(resolve => { release = resolve; });
    if (fail) return route.fulfill({ status: 503, json: { message: "Временно недоступно" } });
    return route.fulfill({ json: { nextCursor: null, items: [{ id: "55555555-5555-4555-8555-555555555555", itemCount: 0, orderNumber: `A08-${version}`, status: "AWAITING_CONFIRMATION", paymentStatus: "UNPAID", currency: "KZT", subtotalAmountMinor: "10000", createdAt: "2026-09-30T10:00:00Z", items: [], buyer: { displayName: "Тестовая клиника" } }] } });
  });
  await page.goto("/supplier/orders");
  await expect(page.getByRole("link", { name: "A08-1", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Поиск заказа" }).fill("A08");
  await context.setOffline(true);
  await expect(page.getByText(/Нет сети. Показаны ранее загруженные данные/)).toBeVisible();
  await expect(page.getByRole("link", { name: "A08-1", exact: true })).toBeVisible();
  version = 2;
  await context.setOffline(false);
  await expect(page.getByRole("link", { name: "A08-2", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Поиск заказа" })).toHaveValue("A08");
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/Не удалось обновить данные/)).toBeVisible();
  await expect(page.getByRole("link", { name: "A08-2", exact: true })).toBeVisible();
  fail = false; version = 3; release = () => {};
  const before = count;
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("focus")); });
  await expect.poll(() => count).toBe(before + 1);
  await expect(page.getByText(/Обновляем данные/)).toBeVisible();
  await expect(page.getByRole("link", { name: "A08-2", exact: true })).toBeVisible();
  release!(); release = undefined;
  await expect(page.getByRole("link", { name: "A08-3", exact: true })).toBeVisible();
});

test("A08 product drafts survive refresh and an old page response is discarded", async ({ page }) => {
  await fixture(page, "SUPPLIER");
  await page.goto("/supplier/products");
  await page.getByRole("button", { name: "Добавить товар", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "Товар, артикул или штрихкод" });
  await draft.fill("Несохранённый ввод A08");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(draft).toHaveValue("Несохранённый ввод A08");
  let release: (() => void) | undefined;
  await page.route("**/api/workspaces/supplier/orders*", async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.getByRole("link", { name: "Заказы", exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole("link", { name: "Товары", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Товары", exact: true })).toBeVisible();
  release!();
  await expect(page.getByText("Добавьте первое предложение", { exact: true })).toBeVisible();
  await expect(page.getByText("Заказов пока нет", { exact: true })).toHaveCount(0);
});

test("clinic navigation survives reload and isolates an order outage", async ({
  page,
}) => {
  const state = await fixture(
    page,
    "BUYER",
    "/workspaces/buyer/orders",
  );
  await page.goto("/clinic/cart");
  await expect(
    page.getByText("Корзина пока пуста", { exact: true }),
  ).toBeVisible();
  const clinicNav = await page.getByRole("navigation", { name: "Кабинет клиники" }).boundingBox();
  const clinicMain = await page.locator("#workspace-content").boundingBox();
  expect(clinicNav!.x + clinicNav!.width).toBeLessThanOrEqual(clinicMain!.x);
  await page.getByRole("link", { name: "Заказы", exact: true }).click();
  await expect(
    page.getByText("Сервер временно недоступен", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Настройки организации" }),
  ).toBeVisible();
  await expect(
    page.locator('input[value="fixture@example.invalid"]'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Настройки организации" }),
  ).toBeVisible();
  expect(state.calls.some((path) => path.startsWith("/suppliers/"))).toBe(
    false,
  );
  expect(state.unexpected).toEqual([]);
});

test("supplier routes load independently, product creation has one entry action", async ({
  page,
}) => {
  const state = await fixture(page, "SUPPLIER", "/workspaces/supplier/orders");
  await page.goto("/supplier");
  await expect(
    page.getByRole("heading", { name: "Тестовая организация" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Товары", exact: true }).click();
  await expect(
    page.getByText("Добавьте первое предложение", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Добавить товар", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Найти в мастер-каталоге", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await expect(
    page.getByText("Организация готова к работе", { exact: true }),
  ).toBeVisible();
  expect(state.calls.some((path) => path.startsWith("/buyers/"))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("A09 an open upload dialog keeps its draft when upload permission is revoked", async ({ page }) => {
  await fixture(page, "BUYER");
  let permissions = ["document.view", "document.upload"];
  await page.route("**/api/access-control/permissions", route => route.fulfill({ json: permissions }));
  await page.goto("/clinic/documents");
  await page.getByRole("button", { name: "Загрузить документ", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Название", exact: true }).fill("Сохранённый документ");
  await dialog.getByRole("textbox", { name: "Номер", exact: true }).fill("TEST-9");
  await dialog.getByLabel("Файл PDF или DOCX", { exact: true }).setInputFiles({ name: "draft.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nfixture") });
  const submit = dialog.getByRole("button", { name: "Загрузить", exact: true });
  await expect(submit).toBeEnabled();
  permissions = ["document.view"];
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(submit).toBeDisabled();
  await expect(dialog.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Сохранённый документ");
  await expect(dialog.getByText("Выбран: draft.pdf", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Загрузка недоступна вашей роли/)).toBeVisible();
});

test.describe("A11 business calendar", () => {
  test.use({ timezoneId: "UTC" });
  for (const width of [1440, 390]) test(`archive keeps Kazakhstan day boundaries in a UTC browser ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page, "BUYER");
    const docs = [
      ["Предыдущий день", "2026-09-29T18:59:59.999Z"], ["Начало дня", "2026-09-29T19:00:00.000Z"],
      ["Конец дня", "2026-09-30T18:59:59.999Z"], ["Следующий день", "2026-09-30T19:00:00.000Z"],
    ].map(([title, documentDate], index) => ({ id: `document-${index}`, title, documentDate, documentNumber: `A11-${index}`, version: 1, kind: "INVOICE", status: "GENERATED", accountingStatus: "NOT_APPLICABLE", participants: [], amountMinor: "100", currency: "KZT" }));
    const queries: URLSearchParams[] = [];
    await page.route("**/api/documents/archive?*", route => {
      const query = new URL(route.request().url()).searchParams; queries.push(query);
      return route.fulfill({ json: { items: docs.filter(doc => (!query.has("dateFrom") || doc.documentDate >= query.get("dateFrom")!) && (!query.has("dateTo") || doc.documentDate <= query.get("dateTo")!)), nextCursor: null } });
    });
    await page.goto("/clinic/documents");
    await expect(page.getByText("Даты в часовом поясе: Asia/Almaty.", { exact: true })).toBeVisible();
    await page.getByLabel("Документы с даты", { exact: true }).fill("2026-09-30");
    await page.getByLabel("Документы по дату", { exact: true }).fill("2026-09-30");
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText("Начало дня", { exact: true })).toBeVisible();
    await expect(page.getByText("Конец дня", { exact: true })).toBeVisible();
    await expect(page.getByText("Предыдущий день", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Следующий день", { exact: true })).toHaveCount(0);
    expect(queries.at(-1)!.get("dateFrom")).toBe("2026-09-29T19:00:00.000Z");
    expect(queries.at(-1)!.get("dateTo")).toBe("2026-09-30T18:59:59.999Z");
    await expect(page.getByRole("row").filter({ hasText: "Начало дня" }).locator('[data-label="Дата"]')).toHaveText(/30\s+сент/);
    const count = queries.length;
    await page.getByLabel("Документы с даты", { exact: true }).fill("2026-10-01");
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText("Дата начала не может быть позже даты окончания.", { exact: true })).toBeVisible();
    expect(queries.length).toBe(count);
    await expect(page.getByText("Начало дня", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Сбросить", exact: true }).click();
    await expect(page.getByText("Предыдущий день", { exact: true })).toBeVisible();
    await expect(page.getByText("Следующий день", { exact: true })).toBeVisible();
    expect(queries.at(-1)!.has("dateFrom")).toBe(false);
    expect(queries.at(-1)!.has("dateTo")).toBe(false);
  });
});

test("documents page is accessible under the clinic navigation", async ({
  page,
}) => {
  const state = await fixture(page, "BUYER");
  await page.goto("/clinic/documents");
  await expect(
    page.getByRole("navigation", { name: "Кабинет клиники" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Документы|Архив/ }).first(),
  ).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test("mobile workspace keeps navigation accessible without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, "SUPPLIER");
  await page.goto("/supplier");
  await expect(
    page.getByRole("heading", { name: "Тестовая организация" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Кабинет поставщика" })).toBeHidden();
  await page.getByRole("button", { name: "Меню кабинета", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Кабинет поставщика" })).toBeVisible();
  await page.screenshot({ path: "../../outputs/workspace-sidebar-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Кабинет поставщика" })).toBeHidden();
  await expect(
    page.getByText("Организация готова к работе", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("sidebar shows the session organization, stays left and supports keyboard dismissal", async ({ page }) => {
  await fixture(page, "SUPPLIER");
  await page.goto("/supplier");
  const sidebar = page.locator("#workspace-sidebar");
  await expect(sidebar.getByText("Тестовая организация", { exact: true })).toBeVisible();
  const side = await sidebar.boundingBox();
  const main = await page.locator("#workspace-content").boundingBox();
  expect(side!.x).toBe(0);
  expect(side!.y).toBe(0);
  expect(side!.x + side!.width).toBeLessThanOrEqual(main!.x);
  await expect(sidebar.getByRole("link", { name: "Главная", exact: true })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "../../outputs/workspace-sidebar-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Меню кабинета", exact: true }).click();
  await sidebar.getByRole("link", { name: "Товары", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(page.getByRole("button", { name: "Меню кабинета", exact: true })).toBeFocused();
});

test("guest cannot load organization data", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/**", (route) => {
    calls.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: null });
  });
  await page.goto("/supplier/products");
  await expect(
    page.getByText("Войдите в кабинет поставщика", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Войти", exact: true }),
  ).toHaveAttribute("href", "/login?returnTo=%2Fsupplier%2Fproducts");
  expect(calls.every((path) => path === "/api/auth/current")).toBe(true);
});

test("checkout requires accepted current version and preserves idempotency on retry", async ({
  page,
}) => {
  await fixture(page, "BUYER");
  const cartId = "44444444-4444-4444-8444-444444444444";
  const cart = {
    id: cartId,
    buyerOrganizationId: organizationId,
    version: 2,
    status: "ACTIVE",
    currency: "KZT",
    checkout: null,
    createdAt: new Date().toISOString(),
    items: [
      {
        id: "line",
        offerId: "offer",
        quantity: "1",
        unitPriceMinor: "10000",
        totalPriceMinor: "10000",
        currency: "KZT",
        offer: {
          supplier: { organization: { displayName: "Поставщик" } },
          productVariant: { product: { canonicalName: "Тестовый товар" } },
        },
      },
    ],
  };
  let accepted = false;
  const checkout: unknown[] = [];
  await page.route("**/api/workspaces/buyer/carts?*", (route) =>
    route.fulfill({ json: { current: cart, items: [], nextCursor: null } }),
  );
  await page.route(`**/api/carts/${cartId}/validate`, (route) =>
    route.fulfill({
      json: {
        cartId,
        cartVersion: cart.version,
        validatedAt: new Date().toISOString(),
        hasChanges: !accepted,
        requiresAcceptance: !accepted,
        canCheckout: accepted,
        items: [],
      },
    }),
  );
  await page.route(`**/api/carts/${cartId}/reprice`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ expectedVersion: 2, acceptedItems: [] });
    accepted = true;
    cart.version = 3;
    await route.fulfill({ json: cart });
  });
  await page.route(`**/api/carts/${cartId}/checkout`, async (route) => {
    checkout.push(route.request().postDataJSON());
    await route.fulfill(
      checkout.length === 1
        ? { status: 503, json: { message: "Временный сбой" } }
        : { json: { id: "checkout" } },
    );
  });
  await page.goto("/clinic/cart");
  await expect(
    page.getByRole("button", { name: "Оформить заказ", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Принять.*изменения/ }).click();
  await expect(
    page.getByRole("button", { name: "Оформить заказ", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Оформить заказ", exact: true })
    .click();
  await expect(page.getByText("Временный сбой", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Оформить заказ", exact: true })
    .click();
  await expect(page).toHaveURL(/\/clinic\/orders$/);
  expect(checkout).toEqual([
    { expectedVersion: 3, idempotencyKey: `buyer-ui-${cartId}` },
    { expectedVersion: 3, idempotencyKey: `buyer-ui-${cartId}` },
  ]);
});

test("supplier confirms an order and returns to its own order list", async ({
  page,
}) => {
  await fixture(page, "SUPPLIER");
  const id = "55555555-5555-4555-8555-555555555555";
  const order = {
    id,
    orderNumber: "TEST-001",
    version: 1,
    supplierOrganizationId: organizationId,
    buyerOrganizationId: cityId,
    status: "AWAITING_CONFIRMATION",
    paymentStatus: "UNPAID",
    currency: "KZT",
    subtotalAmountMinor: "10000",
    shipments: [],
    items: [
      {
        id: "item",
        quantity: "1",
        unitPriceMinor: "10000",
        totalPriceMinor: "10000",
        currency: "KZT",
        acceptedQuantity: null,
        decisionReason: null,
        warehouseId: "warehouse",
        warehouse: { name: "Склад", code: "MAIN" },
        offer: { productVariant: { product: { canonicalName: "Товар" } } },
      },
    ],
  };
  let decisions: unknown;
  await page.route(`**/api/supplier-orders/${id}/workflow`, (route) =>
    route.fulfill({
      json: {
        order,
        status: order.status,
        paymentStatus: "UNPAID",
        claims: [],
        events: [],
        invoiceDocumentId: null,
      },
    }),
  );
  await page.route(`**/api/supplier-orders/${id}/confirm`, async (route) => {
    decisions = route.request().postDataJSON();
    order.status = "CONFIRMED";
    await route.fulfill({ json: order });
  });
  await page.goto(`/supplier/orders/${id}`);
  await expect(
    page.getByRole("heading", { name: "Заказ TEST-001" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Проверить и подтвердить", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Подтвердить заказ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Выставить счёт", exact: true }),
  ).toBeVisible();
  expect(decisions).toEqual({
    decisions: [{ itemId: "item", acceptedQuantity: 1 }],
  });
  await expect(
    page.getByRole("link", { name: "← Все заказы", exact: true }),
  ).toHaveAttribute("href", "/supplier/orders");
  await page.screenshot({
    path: "../../outputs/workspace-rebuild-order.png",
    fullPage: true,
  });
});
