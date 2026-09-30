import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../fixtures/workspace-session";
import { verifyCommercialEditor } from "../fixtures/offer-commercial-editor";
import { verifyCartRecoveryUI } from "../fixtures/cart-recovery";

test.skip(process.env.CHECKOUT_SNAPSHOT_E2E !== "true", "Requires the isolated checkout snapshot configuration");

for (const width of [1440, 390]) {
  test(`live checkout consent survives a second price change at ${width}px`, async ({ page, request }) => {
    const target = new URL(process.env.DATABASE_URL!);
    if (target.pathname !== "/dentmarket_audit_20260914" || !["localhost", "127.0.0.1"].includes(target.hostname))
      throw new Error("Refusing fixture writes outside the approved disposable database");
    const db = new PrismaClient();
    const key = randomUUID();
    const buyerId = randomUUID(), userId = randomUUID(), productId = randomUUID(), variantId = randomUUID(), offerId = randomUUID();
    const balanceId = randomUUID(), priceId = randomUUID(), lotId = randomUUID(), supplierRoleId = randomUUID(), secondWarehouseId = randomUUID(), thirdWarehouseId = randomUUID();
    const base = "http://127.0.0.1:4012/api";
    try {
      // workspaceFixture also verifies this exact disposable database identity.
      const unit = await db.unitOfMeasure.findFirstOrThrow();
      const warehouse = await db.warehouse.findFirstOrThrow({ where: { supplier: { organization: {
        bin: { startsWith: "980" }, status: "ACTIVE",
      } } } });
      await db.organization.create({ data: { id: buyerId, bin: `8${String(Date.now()).slice(-11)}`,
        legalName: `Snapshot clinic ${key}`, displayName: "Проверка согласия", status: "ACTIVE",
        capabilities: { create: { capability: "BUYER" } } } });
      await db.user.create({ data: { id: userId, email: `snapshot-${key}@example.invalid`, displayName: "Проверка согласия", status: "ACTIVE", emailVerifiedAt: new Date() } });
      const role = await db.role.create({ data: { organizationId: buyerId, code: "snapshot-buyer", name: "Snapshot buyer",
        permissions: { create: ["organization.view", "order.create", "catalog.product.view"].map(code => ({ permission: { connect: { code } } })) } } });
      await db.organizationMembership.create({ data: { userId, organizationId: buyerId, status: "ACTIVE", acceptedAt: new Date(), roles: { create: { roleId: role.id } } } });
      const session = await workspaceFixture(db, "BUYER", { userId, organizationId: buyerId, displayName: "Проверка согласия" });
      await page.addInitScript(session => sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify(session)), session);
      await db.product.create({ data: { id: productId, canonicalName: "Товар проверки согласия", slug: `snapshot-${key}`, baseUnitId: unit.id, productType: "MATERIAL", status: "ACTIVE" } });
      await db.productVariant.create({ data: { id: variantId, productId, sku: `snapshot-${key}`, saleUnitId: unit.id, status: "ACTIVE" } });
      await db.supplierOffer.create({ data: { id: offerId, supplierOrganizationId: warehouse.supplierOrganizationId,
        productVariantId: variantId, saleUnitId: unit.id, confirmationMode: "MANUAL", status: "ACTIVE",
        publication: { create: { status: "PUBLISHED", marketplaceVisible: true } } } });
      await db.offerPrice.create({ data: { id: priceId, offerId, amountMinor: "10000", currency: "KZT", vatRate: "12",
        status: "ACTIVE", validFrom: new Date(Date.now() - 60000), freshnessExpiresAt: new Date(Date.now() + 3600000) } });
      await db.inventoryBalance.create({ data: { id: balanceId, supplierOrganizationId: warehouse.supplierOrganizationId,
        warehouseId: warehouse.id, productVariantId: variantId, offerId, quantityOnHand: 10, quantityAvailable: 10,
        availabilityStatus: "IN_STOCK", freshnessStatus: "FRESH", freshnessExpiresAt: new Date(Date.now() + 3600000) } });
      await db.inventoryLot.create({ data: { id: lotId, inventoryBalanceId: balanceId, supplierOrganizationId: warehouse.supplierOrganizationId,
        warehouseId: warehouse.id, productVariantId: variantId, offerId, lotNumber: key, quantityOnHand: 10, quantityAvailable: 10,
        status: "ACTIVE", expirationDate: new Date("2035-12-31") } });
      const headers = { authorization: `Bearer ${session.accessToken}` };
      const cartResponse = await request.post(`${base}/buyers/${buyerId}/carts`, { headers, data: { currency: "KZT" } });
      expect(cartResponse.status()).toBe(201);
      const cart = await cartResponse.json();
      const added = await request.post(`${base}/carts/${cart.id}/items`, { headers, data: { offerId, quantity: 1 } });
      expect(added.status()).toBe(201);
      await db.offerPrice.update({ where: { id: priceId }, data: { amountMinor: "12000", vatRate: "16" } });
      await db.supplierOffer.update({ where: { id: offerId }, data: { baseUnitsPerSaleUnit: "10" } });
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/clinic/cart");
      const checkout = page.getByRole("button", { name: "Оформить заказ", exact: true });
      const accept = page.getByRole("button", { name: "Принять изменения", exact: true });
      await expect(checkout).toBeDisabled();
      await expect(page.getByText("НДС: включён, ставка 12% → включён, ставка 16%", { exact: true })).toBeVisible();
      await expect(page.getByText("Базовых единиц в единице продажи: 1 → 10", { exact: true })).toBeVisible();
      await page.screenshot({ path: `../../outputs/workspace-audit-a01-consent-${width}.png`, fullPage: true });
      await db.offerPrice.update({ where: { id: priceId }, data: { amountMinor: "13000" } });
      const conflict = page.waitForResponse(response => response.url().endsWith(`/carts/${cart.id}/reprice`));
      await accept.focus();
      await page.keyboard.press("Enter");
      expect((await conflict).status()).toBe(409);
      await expect(checkout).toBeDisabled();
      await expect(page.getByRole("alert").filter({ hasText: "Offer terms changed since they were displayed" })).toBeVisible();
      await expect(accept).toBeEnabled();
      const accepted = page.waitForResponse(response => response.url().endsWith(`/carts/${cart.id}/reprice`));
      await accept.click();
      expect((await accepted).status()).toBe(201);
      await expect(checkout).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await checkout.click();
      await expect(page).toHaveURL(/\/clinic\/orders$/);
      const orders = await db.supplierOrder.findMany({ where: { buyerOrganizationId: buyerId }, include: { items: true } });
      expect(orders).toHaveLength(1);
      expect(orders[0].items[0].unitPriceMinor.toString()).toBe("13000");
      expect(await db.inventoryReservation.count({ where: { inventoryBalanceId: balanceId } })).toBe(1);
      // Real API/UI boundary for expiry after reserve. Targeted payment fixture;
      // document upload and recall mutation have separate integration coverage.
      const order = orders[0];
      await db.supplierOrderItem.update({ where: { id: order.items[0].id }, data: { acceptedQuantity: 1 } });
      await db.supplierOrder.update({ where: { id: order.id }, data: { status: "AWAITING_PAYMENT" } });
      await db.orderTransferClaim.create({ data: { supplierOrderId: order.id, invoiceDocumentId: randomUUID(), documentId: randomUUID(),
        amountMinor: order.subtotalAmountMinor, currency: "KZT", paidAt: new Date(), comment: "Проверка запрета списания просроченной партии" } });
      await db.role.create({ data: { id: supplierRoleId, organizationId: warehouse.supplierOrganizationId, code: key, name: "Lot guard fixture",
        permissions: { create: ["organization.view", "order.confirm", "payment.transfer.confirm", "shipment.manage", "catalog.product.view", "pricing.manage", "inventory.adjust", "inventory.view"].map(code => ({ permission: { connect: { code } } })) } } });
      await db.organizationMembership.create({ data: { userId, organizationId: warehouse.supplierOrganizationId, status: "ACTIVE",
        roles: { create: { roleId: supplierRoleId } } } });
      const supplierSession = await workspaceFixture(db, "SUPPLIER", { userId, organizationId: warehouse.supplierOrganizationId, displayName: "Проверка партии" });
      await page.addInitScript(session => sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify(session)), supplierSession);
      await db.inventoryLot.update({ where: { id: lotId }, data: { expirationDate: new Date(Date.now() - 1000) } });
      await db.inventoryReservation.updateMany({ where: { inventoryBalanceId: balanceId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await page.clock.install();
      await page.goto(`/supplier/orders/${order.id}`);
      const confirmTransfer = page.getByRole("button", { name: "Подтверждаю поступление полной суммы", exact: true });
      await expect(confirmTransfer).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Перевод заявлен. Автоматическая отмена и снятие резерва приостановлены" })).toBeVisible();
      await db.supplierOrder.update({ where: { id: order.id }, data: { version: { increment: 1 } } });
      const staleWrite = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/supplier-orders/${order.id}/workflow`));
      await confirmTransfer.click();
      expect((await staleWrite).status()).toBe(409);
      const actionError = page.getByRole("status").filter({ hasText: "Заказ изменился. Обновите страницу и проверьте условия" });
      await expect(actionError).toBeVisible();
      await expect(confirmTransfer).toBeEnabled();
      const backgroundRead = page.waitForResponse(response => response.request().method() === "GET" && response.url().endsWith(`/supplier-orders/${order.id}/workflow`));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      expect((await backgroundRead).status()).toBe(200);
      await expect(actionError).toBeVisible();
      const polledRead = page.waitForResponse(response => response.request().method() === "GET" && response.url().endsWith(`/supplier-orders/${order.id}/workflow`));
      await page.clock.runFor(5100);
      expect((await polledRead).status()).toBe(200);
      await expect(actionError).toBeVisible();
      const refused = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/supplier-orders/${order.id}/workflow`));
      await confirmTransfer.click();
      const refusedResponse = await refused;
      expect(refusedResponse.status()).toBe(409);
      expect(refusedResponse.request().postDataJSON().expectedVersion).toBe(order.version + 1);
      await expect(page.getByRole("status").filter({ hasText: "Партия отозвана, просрочена или резерв изменился" })).toBeVisible();
      await expect(page.getByText("перевод заявлен — ожидается подтверждение поставщика (pending)", { exact: false })).toBeVisible();
      expect((await db.supplierOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("UNPAID");
      await page.screenshot({ path: `../../outputs/workspace-audit-a02-expiry-${width}.png`, fullPage: true });
      // Lose a real committed write response; retry must replay its key even
      // after a successful GET has observed the incremented order version.
      const commands: Array<{ idempotencyKey: string; expectedVersion: number }> = [];
      await page.route(`**/supplier-orders/${order.id}/workflow`, async route => {
        if (route.request().method() !== "POST" || route.request().postDataJSON().action !== "REQUEST_PAYMENT_DETAILS") return route.continue();
        commands.push(route.request().postDataJSON());
        if (commands.length === 1) {
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
          return route.abort("failed");
        }
        return route.continue();
      });
      await page.getByLabel("Что нужно уточнить по оплате").fill("Уточните перевод для отозванной партии");
      const clarify = page.getByRole("button", { name: "Запросить уточнение", exact: true });
      const lostResponse = page.waitForEvent("requestfailed", req => req.method() === "POST" && req.url().endsWith(`/supplier-orders/${order.id}/workflow`));
      await clarify.click(); await lostResponse;
      await expect(clarify).toBeEnabled();
      const refreshAfterCommit = page.waitForResponse(response => response.request().method() === "GET" && response.url().endsWith(`/supplier-orders/${order.id}/workflow`));
      await page.getByRole("button", { name: "Обновить условия", exact: true }).click();
      await refreshAfterCommit;
      await clarify.click();
      await expect(page.getByRole("status").filter({ hasText: "Изменение сохранено. Обе стороны увидят обновлённый статус." })).toBeVisible();
      expect(commands).toHaveLength(2);
      expect(commands[1]).toEqual(commands[0]);
      expect(await db.orderWorkflowEvent.count({ where: { supplierOrderId: order.id, action: "REQUEST_PAYMENT_DETAILS" } })).toBe(1);
      await expect(clarify).toBeEnabled();
      let failNextRead = true;
      await page.route(`**/supplier-orders/${order.id}/workflow`, async route => {
        if (route.request().method() === "GET" && failNextRead) {
          failNextRead = false;
          return route.fulfill({ status: 503, json: { message: "Проверка ошибки обновления" } });
        }
        return route.fallback();
      });
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.getByRole("status").filter({ hasText: "Проверка ошибки обновления" })).toBeVisible();
      await page.getByRole("button", { name: "Повторить загрузку" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Проверка ошибки обновления" })).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: "Изменение сохранено. Обе стороны увидят обновлённый статус." })).toBeVisible();
      // Separate shipment-planning precondition: an already-paid two-warehouse
      // order. Payment ingestion itself is deliberately outside this fixture.
      await db.inventoryLot.update({ where: { id: lotId }, data: { expirationDate: new Date("2035-12-31") } });
      await db.warehouse.create({ data: { id: secondWarehouseId, supplierOrganizationId: warehouse.supplierOrganizationId,
        code: key, name: "Второй склад проверки" } });
      const secondCart = await db.cart.create({ data: { buyerOrganizationId: buyerId, status: "CHECKED_OUT", items: { create: {
        offerId, quantity: 2, unitPriceMinor: "13000", totalPriceMinor: "26000", currency: "KZT", priceSource: "BASE", pricingSnapshot: { testFixture: key },
      } } }, include: { items: true } });
      const secondItem = await db.supplierOrderItem.create({ data: { supplierOrderId: order.id, cartItemId: secondCart.items[0].id,
        offerId, productVariantId: variantId, warehouseId: secondWarehouseId, quantity: 2, acceptedQuantity: 2,
        unitPriceMinor: "13000", totalPriceMinor: "26000", currency: "KZT", offerSnapshot: { testFixture: key }, inventorySnapshot: { testFixture: key } } });
      await db.supplierOrder.update({ where: { id: order.id }, data: { status: "PAID", paymentStatus: "PAID", subtotalAmountMinor: "39000" } });
      await page.reload();
      const warehouseSelect = page.getByLabel("Склад", { exact: true });
      await expect(warehouseSelect.locator("option")).toHaveCount(2);
      await warehouseSelect.selectOption(warehouse.id);
      await expect(warehouseSelect).toHaveValue(warehouse.id);
      const optionIds = await warehouseSelect.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
      const toSecond = optionIds.indexOf(warehouse.id) === 0 ? "ArrowDown" : "ArrowUp";
      await warehouseSelect.focus(); await page.keyboard.press(toSecond);
      await expect(warehouseSelect).toHaveValue(secondWarehouseId);
      await page.keyboard.press(toSecond === "ArrowDown" ? "ArrowUp" : "ArrowDown");
      await expect(warehouseSelect).toHaveValue(warehouse.id);
      await page.getByLabel("Получатель", { exact: true }).fill("Получатель двух складов");
      await page.getByLabel("Адрес доставки", { exact: true }).fill("Адрес проверки");
      const createShipment = page.getByRole("button", { name: "Создать отгрузку", exact: true });
      await createShipment.click();
      await expect(warehouseSelect).toHaveValue(secondWarehouseId);
      await expect(page.getByLabel("Получатель", { exact: true })).toHaveValue("Получатель двух складов");
      await expect(page.getByLabel("Адрес доставки", { exact: true })).toHaveValue("Адрес проверки");
      // Another session allocates one of the two remaining units before this
      // screen refreshes. The rejected command must refresh, preserving fields.
      const concurrent = await request.post(`${base}/supplier-orders/${order.id}/shipments`, { headers: { authorization: `Bearer ${supplierSession.accessToken}` },
        data: { warehouseId: secondWarehouseId, method: "PICKUP", recipientName: "Вторая сессия", fulfillmentSteps: [], items: [{ supplierOrderItemId: secondItem.id, quantity: 1 }] } });
      expect(concurrent.status()).toBe(201);
      const overallocated = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/supplier-orders/${order.id}/shipments`));
      await createShipment.click();
      expect((await overallocated).status()).toBe(409);
      await expect(page.getByRole("alert").filter({ hasText: "Shipment quantity exceeds" })).toBeVisible();
      await expect(createShipment).toBeEnabled();
      await expect(page.getByLabel("Адрес доставки", { exact: true })).toHaveValue("Адрес проверки");
      await createShipment.click();
      await expect(page.getByText("Все подтверждённые позиции распределены по отгрузкам.", { exact: true })).toBeVisible();
      await expect(warehouseSelect).toHaveCount(0);
      const planned = await db.shipmentItem.findMany({ where: { shipment: { supplierOrderId: order.id } }, include: { shipment: true } });
      expect(planned.filter(line => line.supplierOrderItemId === secondItem.id).reduce((sum, line) => sum + Number(line.quantity), 0)).toBe(2);
      expect(planned.every(line => line.shipment.warehouseId === (line.supplierOrderItemId === secondItem.id ? secondWarehouseId : warehouse.id))).toBe(true);
      await page.screenshot({ path: `../../outputs/workspace-audit-a04-warehouses-${width}.png`, fullPage: true });
      await verifyCartRecoveryUI({ db, page, request, buyerId, token: session.accessToken, offerId, key, width });
      await verifyCommercialEditor({ db, page, request, supplierId: warehouse.supplierOrganizationId, token: supplierSession.accessToken,
        offerId, variantId, unitId: unit.id, warehouseA: warehouse.id, warehouseB: secondWarehouseId, warehouseC: thirdWarehouseId, key, width });
    } finally {
      await page.goto("about:blank");
      const checkouts = await db.checkout.findMany({ where: { buyerOrganizationId: buyerId }, select: { id: true } });
      const reservations = await db.inventoryReservation.findMany({ where: { inventoryBalanceId: balanceId }, select: { id: true } });
      const orderIds = (await db.supplierOrder.findMany({ where: { buyerOrganizationId: buyerId }, select: { id: true } })).map(row => row.id);
      const shipmentIds = (await db.shipment.findMany({ where: { supplierOrderId: { in: orderIds } }, select: { id: true } })).map(row => row.id);
      const balanceIds = (await db.inventoryBalance.findMany({ where: { productVariantId: variantId }, select: { id: true } })).map(row => row.id);
      const cartIds = (await db.cart.findMany({ where: { buyerOrganizationId: buyerId }, select: { id: true } })).map(row => row.id);
      await db.outboxEvent.deleteMany({ where: { aggregateType: "Cart", aggregateId: { in: cartIds } } });
      await db.idempotencyRecord.deleteMany({ where: { scope: { contains: `:${offerId}:` } } });
      await db.fulfillmentStep.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
      await db.shipmentItem.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
      await db.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: shipmentIds } } });
      await db.inventoryReservation.deleteMany({ where: { inventoryBalanceId: balanceId } });
      await db.orderTransferClaim.deleteMany({ where: { supplierOrder: { buyerOrganizationId: buyerId } } });
      await db.orderWorkflowEvent.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: orderIds } } });
      await db.supplierOrderItem.deleteMany({ where: { supplierOrder: { buyerOrganizationId: buyerId } } });
      await db.supplierOrder.deleteMany({ where: { buyerOrganizationId: buyerId } });
      await db.checkout.deleteMany({ where: { buyerOrganizationId: buyerId } });
      await db.cart.deleteMany({ where: { buyerOrganizationId: buyerId } });
      await db.complianceCheck.deleteMany({ where: { OR: [{ offerId }, { buyerOrganizationId: buyerId }] } });
      await db.auditLog.deleteMany({ where: { actorId: userId } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: [buyerId, offerId, ...balanceIds, ...checkouts.map(row => row.id), ...reservations.map(row => row.id)] } } });
      await db.inventoryLot.deleteMany({ where: { id: lotId } });
      await db.inventoryBalance.deleteMany({ where: { productVariantId: variantId } });
      await db.warehouse.deleteMany({ where: { id: { in: [secondWarehouseId, thirdWarehouseId] } } });
      await db.supplierOffer.deleteMany({ where: { id: offerId } });
      await db.productPackaging.deleteMany({ where: { productVariantId: variantId } });
      await db.productVariant.deleteMany({ where: { id: variantId } });
      await db.product.deleteMany({ where: { id: productId } });
      await db.organization.deleteMany({ where: { id: buyerId } });
      await db.role.deleteMany({ where: { id: supplierRoleId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  });
}
