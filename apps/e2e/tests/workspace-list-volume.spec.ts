import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { workspaceFixture } from "../fixtures/workspace-session";
import { workspaceOfferPageSchema, workspaceOrderPageSchema, workspaceCartPageSchema, workspaceSummarySchema } from "@marketplace/schemas";

test("A12 production list measurement with 1000 owned records", async ({ page, request }) => {
  test.setTimeout(120000);
  const target = new URL(process.env.DATABASE_URL!);
  if (target.pathname !== "/dentmarket_audit_20260914" || !["localhost", "127.0.0.1"].includes(target.hostname))
    throw new Error("Volume fixture requires the approved disposable database");
  const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  let queries = 0;
  db.$on("query", () => queries++);
  const buyerId = randomUUID(), supplierId = randomUUID(), foreignId = randomUUID(), userId = randomUUID(), productId = randomUUID(), warehouseId = randomUUID();
  const key = randomUUID(), size = 1000;
  const rows = Array.from({ length: size }, (_, index) => ({ index, variant: randomUUID(), packaging: randomUUID(), offer: randomUUID(), cart: randomUUID(), item: randomUUID(), checkout: randomUUID(), order: randomUUID(), createdAt: new Date(Date.now() - (size - index) * 1000) }));
  const base = "http://127.0.0.1:4012/api";
  const report: Record<string, unknown> = { size, budgets: { bytes: 1048576, warmApiP95Ms: 750, responseToRenderMs: 1500 }, routes: {}, browser: {} };
  try {
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity.name).toBe("dentmarket_audit_20260914");
    const unit = await db.unitOfMeasure.findFirstOrThrow();
    await db.user.create({ data: { id: userId, email: `volume-${key}@example.invalid`, displayName: "Volume fixture", status: "ACTIVE", emailVerifiedAt: new Date() } });
    for (const [id, capability, prefix] of [[buyerId, "BUYER", "81"], [supplierId, "SUPPLIER", "82"]] as const) {
      await db.organization.create({ data: { id, bin: prefix + String(Date.now()).slice(-10), legalName: `Volume ${capability} ${key}`, displayName: `Volume ${capability}`, status: "ACTIVE", capabilities: { create: { capability } } } });
      const role = await db.role.create({ data: { organizationId: id, code: "volume", name: "Volume fixture", permissions: { create: ["organization.view", "catalog.product.view", "order.create", "order.confirm", "inventory.view"].map(code => ({ permission: { connect: { code } } })) } } });
      await db.organizationMembership.create({ data: { userId, organizationId: id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
    }
    await db.supplierProfile.create({ data: { organizationId: supplierId } });
    await db.warehouse.create({ data: { id: warehouseId, supplierOrganizationId: supplierId, code: "volume", name: "Volume warehouse" } });
    const buyer = await workspaceFixture(db, "BUYER", { userId, organizationId: buyerId, displayName: "Volume BUYER" });
    const supplier = await workspaceFixture(db, "SUPPLIER", { userId, organizationId: supplierId, displayName: "Volume SUPPLIER" });
    await page.addInitScript(({ buyer, supplier }) => {
      sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify(buyer));
      sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify(supplier));
    }, { buyer, supplier });
    await db.product.create({ data: { id: productId, canonicalName: "Тестовый материал объёма", slug: `volume-${key}`, baseUnitId: unit.id, productType: "MATERIAL", status: "ACTIVE" } });
    await db.productVariant.createMany({ data: rows.map(r => ({ id: r.variant, productId, sku: `${key}-${r.index}`, saleUnitId: unit.id, status: "ACTIVE" })) });
    await db.productPackaging.createMany({ data: rows.map(r => ({ id: r.packaging, productVariantId: r.variant, unitId: unit.id, code: "base", name: "Единица", level: "BASE", quantityInBaseUnit: 1 })) });
    await db.supplierOffer.createMany({ data: rows.map(r => ({ id: r.offer, supplierOrganizationId: supplierId, productVariantId: r.variant, saleUnitId: unit.id, packagingId: r.packaging, supplierSku: `V-${r.index}`, status: "ACTIVE", createdAt: r.createdAt })) });
    await db.offerPrice.createMany({ data: rows.map(r => ({ offerId: r.offer, amountMinor: "10000", currency: "KZT", status: "ACTIVE", validFrom: new Date(), freshnessExpiresAt: new Date(Date.now() + 3600000) })) });
    await db.inventoryBalance.createMany({ data: rows.map(r => ({ supplierOrganizationId: supplierId, warehouseId, productVariantId: r.variant, offerId: r.offer, quantityOnHand: 10, quantityAvailable: 10, availabilityStatus: "IN_STOCK", freshnessStatus: "FRESH" })) });
    await db.cart.createMany({ data: rows.map(r => ({ id: r.cart, buyerOrganizationId: buyerId, status: "CHECKED_OUT", createdAt: r.createdAt })) });
    await db.cart.create({ data: { buyerOrganizationId: buyerId } });
    await db.cartItem.createMany({ data: rows.map(r => ({ id: r.item, cartId: r.cart, offerId: r.offer, quantity: 1, unitPriceMinor: "10000", totalPriceMinor: "10000", currency: "KZT", priceSource: "BASE", pricingSnapshot: { fixture: key } })) });
    await db.checkout.createMany({ data: rows.map(r => ({ id: r.checkout, cartId: r.cart, buyerOrganizationId: buyerId, totalAmountMinor: "10000", currency: "KZT", status: "COMPLETED", idempotencyKey: `${key}-${r.index}`, pricingSnapshot: { fixture: key } })) });
    await db.supplierOrder.createMany({ data: rows.map(r => ({ id: r.order, checkoutId: r.checkout, supplierOrganizationId: supplierId, buyerOrganizationId: buyerId, orderNumber: `V-${key}-${r.index}`, subtotalAmountMinor: "10000", currency: "KZT", createdAt: r.createdAt })) });
    await db.supplierOrderItem.createMany({ data: rows.map(r => ({ supplierOrderId: r.order, cartItemId: r.item, offerId: r.offer, productVariantId: r.variant, warehouseId, quantity: 1, unitPriceMinor: "10000", totalPriceMinor: "10000", currency: "KZT", offerSnapshot: { fixture: key }, inventorySnapshot: { fixture: key } })) });

    // Measure compiled service query counts independently from authenticated HTTP latency.
    const require = createRequire(path.resolve("../api/package.json"));
    const { WorkspaceReadsService } = require("./dist/src/modules/commerce/workspace-reads.service.js");
    const reads = new WorkspaceReadsService(db);
    const query = { q: "", limit: 50 };
    const routes = [
      { name: "offers", url: "/workspaces/supplier/offers", token: supplier.accessToken, count: 50, schema: workspaceOfferPageSchema, read: () => reads.offers(supplierId, query) },
      { name: "supplierOrders", url: "/workspaces/supplier/orders", token: supplier.accessToken, count: 50, schema: workspaceOrderPageSchema, read: () => reads.orders(supplierId, "supplier", query) },
      { name: "buyerOrders", url: "/workspaces/buyer/orders", token: buyer.accessToken, count: 50, schema: workspaceOrderPageSchema, read: () => reads.orders(buyerId, "buyer", query) },
      { name: "carts", url: "/workspaces/buyer/carts", token: buyer.accessToken, count: 0, schema: workspaceCartPageSchema, read: () => reads.carts(buyerId, query) },
      { name: "summary", url: "/workspaces/supplier/summary", token: supplier.accessToken, count: null, schema: workspaceSummarySchema, read: () => reads.summary(supplierId) },
    ];
    for (const route of routes) {
      queries = 0; await route.read(); const ormQueries = queries;
      const samples: number[] = []; let bytes = 0;
      for (let index = 0; index < 6; index++) {
        const start = performance.now();
        const response = await request.get(base + route.url, { headers: { authorization: `Bearer ${route.token}` } });
        const body = await response.body(); const elapsed = performance.now() - start;
        expect(response.status()).toBe(200);
        const parsed = JSON.parse(body.toString()); route.schema.parse(parsed);
        if (route.count !== null) expect(parsed.items).toHaveLength(route.count);
        else expect(parsed).toEqual({ orders: size, offers: size, publishedOffers: 0 });
        bytes = body.length; samples.push(Math.round(elapsed));
      }
      const p95 = Math.max(...samples.slice(1));
      (report.routes as Record<string, unknown>)[route.name] = { bytes, ormQueries, coldMs: samples[0], warmMs: samples.slice(1), warmP95Ms: p95, budgetPass: bytes <= 1048576 && p95 <= 750 };
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    for (const surface of [
      { name: "products", url: "/supplier/products", api: routes[0].url, rows: 50 },
      { name: "supplierOrders", url: "/supplier/orders", api: routes[1].url, rows: 50 },
      { name: "buyerOrders", url: "/clinic/orders", api: routes[2].url, rows: 50 },
      { name: "carts", url: "/clinic/cart", api: routes[3].url, rows: 0 },
      { name: "dashboard", url: "/supplier", api: routes[4].url, rows: 0 },
    ]) {
      let httpCount = 0, bytes = 0;
      const pending: Promise<void>[] = [];
      const onResponse = (response: import("@playwright/test").Response) => {
        if (!new URL(response.url()).pathname.startsWith("/api/")) return;
        httpCount++;
        pending.push(response.body().then(body => { bytes += body.length; }).catch(() => {}));
      };
      page.on("response", onResponse);
      const start = performance.now();
      const received = page.waitForResponse(response => new URL(response.url()).pathname === "/api" + surface.api);
      await page.goto(surface.url);
      const response = await received; await response.finished(); const receivedAt = performance.now();
      if (surface.rows) await expect(page.locator("tbody tr")).toHaveCount(surface.rows);
      else if (surface.name === "dashboard") await expect(page.getByText("1000", { exact: true })).toHaveCount(2);
      else await expect(page.getByText("Корзина пока пуста", { exact: true })).toBeVisible();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const done = performance.now();
      page.off("response", onResponse); await Promise.all(pending);
      (report.browser as Record<string, unknown>)[surface.name] = { httpCount, bytes, coldNavigationMs: Math.round(done - start), responseToRenderMs: Math.round(done - receivedAt), renderBudgetPass: done - receivedAt <= 1500 };
    }
    await writeFile(path.resolve("../../outputs/workspace-audit-a12-after.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    // Entire result sets remain reachable; ties, deleted anchors and newly added
    // rows must not duplicate or skip unchanged rows of this traversal.
    const get = async (url: string, token = supplier.accessToken) => {
      const response = await request.get(base + url, { headers: { authorization: `Bearer ${token}` } });
      expect(response.status()).toBe(200); return response.json();
    };
    const walk = async (url: string, token: string) => {
      const ids: string[] = []; let cursor: string | null = null;
      do {
        const result = await get(`${url}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, token);
        ids.push(...result.items.map((row: { id: string }) => row.id)); cursor = result.nextCursor;
      } while (cursor);
      expect(new Set(ids).size).toBe(size); expect(ids).toHaveLength(size);
    };
    await walk(routes[0].url, supplier.accessToken);
    await db.supplierOrder.updateMany({ where: { buyerOrganizationId: buyerId }, data: { createdAt: new Date(Date.now() - 60000) } });
    await walk(routes[1].url, supplier.accessToken);
    await walk(routes[2].url, buyer.accessToken);
    const first = await get(routes[1].url + "?limit=100");
    const boundaryId = first.items.at(-1).id;
    const boundary = await db.supplierOrder.findUniqueOrThrow({ where: { id: boundaryId } });
    await db.supplierOrder.delete({ where: { id: boundaryId } });
    const inserted = await db.supplierOrder.create({ data: { ...boundary, id: randomUUID(), orderNumber: `NEW-${key}`, createdAt: new Date() } });
    const next = await get(routes[1].url + "?limit=100&cursor=" + encodeURIComponent(first.nextCursor));
    expect(next.items).toHaveLength(100);
    expect(next.items.some((row: { id: string }) => first.items.some((old: { id: string }) => old.id === row.id))).toBe(false);
    const traversed: string[] = [...first.items, ...next.items].map(row => row.id);
    let continuation = next.nextCursor;
    while (continuation) {
      const result = await get(routes[1].url + "?limit=100&cursor=" + encodeURIComponent(continuation));
      traversed.push(...result.items.map((row: { id: string }) => row.id)); continuation = result.nextCursor;
    }
    expect(traversed).toHaveLength(size); expect(new Set(traversed).size).toBe(size);
    expect(traversed).not.toContain(inserted.id);
    const empty = await get(routes[1].url + "?status=PAID"); expect(empty).toEqual({ items: [], nextCursor: null });
    const filtered = await get(routes[0].url + "?q=V-999"); expect(filtered.items.map((row: { id: string }) => row.id)).toEqual([rows[999].offer]);
    const invalid = await request.get(base + routes[2].url + "?limit=100&cursor=" + encodeURIComponent(first.nextCursor), { headers: { authorization: `Bearer ${buyer.accessToken}` } });
    expect(invalid.status()).toBe(400);
    for (const suffix of ["?limit=101", "?cursor=invalid", "?status=unknown"]) {
      expect((await request.get(base + routes[1].url + suffix, { headers: { authorization: `Bearer ${supplier.accessToken}` } })).status()).toBe(400);
    }
    await db.organization.create({ data: { id: foreignId, bin: "83" + String(Date.now()).slice(-10), legalName: `Foreign volume ${key}`, displayName: "Foreign volume", status: "ACTIVE", capabilities: { create: { capability: "SUPPLIER" } } } });
    const foreignRole = await db.role.create({ data: { organizationId: foreignId, code: "volume", name: "Foreign volume", permissions: { create: ["catalog.product.view", "order.confirm"].map(code => ({ permission: { connect: { code } } })) } } });
    await db.organizationMembership.create({ data: { userId, organizationId: foreignId, status: "ACTIVE", roles: { create: { roleId: foreignRole.id } } } });
    const foreign = await workspaceFixture(db, "SUPPLIER", { userId, organizationId: foreignId, displayName: "Foreign volume" });
    expect(await get(routes[0].url, foreign.accessToken)).toEqual({ items: [], nextCursor: null });
    expect((await request.get(base + routes[0].url + "/" + rows[0].offer, { headers: { authorization: `Bearer ${foreign.accessToken}` } })).status()).toBe(404);
    expect((await request.get(base + routes[1].url + "?limit=100&cursor=" + encodeURIComponent(first.nextCursor), { headers: { authorization: `Bearer ${foreign.accessToken}` } })).status()).toBe(400);
    await db.rolePermission.deleteMany({ where: { roleId: foreignRole.id } });
    expect((await request.get(base + routes[0].url, { headers: { authorization: `Bearer ${foreign.accessToken}` } })).status()).toBe(403);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/supplier/products");
      await expect(page.locator("tbody tr")).toHaveCount(50);
      const firstText = await page.locator("tbody tr").first().innerText();
      await page.getByRole("button", { name: "Следующая страница", exact: true }).click();
      await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(50);
      expect(await page.locator("tbody tr").first().innerText()).not.toBe(firstText);
      await page.getByRole("button", { name: "Предыдущая страница", exact: true }).click();
      await expect(page.locator("tbody tr").first()).toHaveText(firstText, { useInnerText: true });
      await page.getByRole("textbox", { name: "Поиск по товарам" }).fill("V-999");
      await page.getByRole("button", { name: "Найти", exact: true }).click();
      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.locator("tbody tr")).toContainText("V-999");
    }
    const failedIds = rows.slice(0, 60).map(row => row.cart);
    await db.cart.updateMany({ where: { id: { in: failedIds } }, data: { status: "ABANDONED" } });
    await db.checkout.updateMany({ where: { cartId: { in: failedIds } }, data: { status: "FAILED" } });
    const { recoveredCartId } = require("./dist/src/modules/commerce/cart-recovery.js");
    const restoredId = recoveredCartId(failedIds[0]);
    await db.cart.create({ data: { id: restoredId, buyerOrganizationId: buyerId, status: "CHECKED_OUT" } });
    const failed: Array<{ id: string; recoveredCartId: string | null }> = [];
    let cursor: string | null = null;
    do {
      const result = await get(routes[3].url + "?limit=25" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), buyer.accessToken);
      workspaceCartPageSchema.parse(result); failed.push(...result.items); cursor = result.nextCursor;
    } while (cursor);
    expect(failed).toHaveLength(60); expect(new Set(failed.map(row => row.id)).size).toBe(60);
    expect(failed.find(row => row.id === failedIds[0])?.recoveredCartId).toBe(restoredId);
    const current = await db.cart.findFirstOrThrow({ where: { buyerOrganizationId: buyerId, status: "ACTIVE" } });
    await db.cartItem.create({ data: { cartId: current.id, offerId: rows[0].offer, quantity: 1, unitPriceMinor: "10000", totalPriceMinor: "10000", currency: "KZT", priceSource: "BASE", pricingSnapshot: {} } });
    await page.goto("/clinic/cart");
    const quantity = page.getByRole("textbox", { name: "Количество: Тестовый материал объёма", exact: true });
    await quantity.fill("3");
    await page.getByRole("button", { name: "Следующая страница", exact: true }).click();
    await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
    await expect(quantity).toHaveValue("3");
    for (const result of Object.values(report.routes as Record<string, { budgetPass: boolean }>)) expect(result.budgetPass).toBe(true);
    for (const result of Object.values(report.browser as Record<string, { renderBudgetPass: boolean }>)) expect(result.renderBudgetPass).toBe(true);
  } finally {
    await writeFile(path.resolve("../../outputs/workspace-audit-a12-after.json"), JSON.stringify(report, null, 2));
    await page.goto("about:blank").catch(() => {});
    await db.supplierOrderItem.deleteMany({ where: { supplierOrder: { buyerOrganizationId: buyerId } } });
    await db.commerceMetricEvent.deleteMany({ where: { supplierOrder: { buyerOrganizationId: buyerId } } });
    await db.supplierOrder.deleteMany({ where: { buyerOrganizationId: buyerId } });
    await db.checkout.deleteMany({ where: { buyerOrganizationId: buyerId } });
    await db.cart.deleteMany({ where: { buyerOrganizationId: buyerId } });
    await db.inventoryBalance.deleteMany({ where: { supplierOrganizationId: supplierId } });
    await db.supplierOffer.deleteMany({ where: { supplierOrganizationId: supplierId } });
    await db.productPackaging.deleteMany({ where: { productVariant: { productId } } });
    await db.productVariant.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.organization.deleteMany({ where: { id: { in: [buyerId, supplierId, foreignId] } } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
