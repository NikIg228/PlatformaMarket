import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import path from "node:path";

export async function verifyReservationExpiryUI({ db, page, request, cartId, token, key, width }: {
  db: PrismaClient; page: Page; request: APIRequestContext; cartId: string; token: string; key: string; width: number;
}) {
  const cart = await db.cart.findUniqueOrThrow({ where: { id: cartId } });
  const result = await request.post(`http://127.0.0.1:4012/api/carts/${cartId}/checkout`, {
    headers: { authorization: `Bearer ${token}` }, data: { expectedVersion: cart.version, idempotencyKey: `expiry-ui-${key}` },
  });
  expect(result.status()).toBe(201);
  const checkout = await result.json();
  const order = checkout.supplierOrders[0];
  const reservation = await db.inventoryReservation.findUniqueOrThrow({ where: { supplierOrderItemId: order.items[0].id } });
  await page.goto(`/clinic/orders/${order.id}`);
  await expect(page.getByText(/Локальный резерв действует до/)).toBeVisible();
  const require = createRequire(path.resolve(process.cwd(), "../api/package.json"));
  const { SupplierAccessService } = require("./dist/src/modules/suppliers/supplier-access.service.js");
  const { DataFreshnessService } = require("./dist/src/modules/inventory/data-freshness.service.js");
  const { InventoryService } = require("./dist/src/modules/inventory/inventory.service.js");
  const { ReservationExpiryService } = require("./dist/src/modules/inventory/reservation-expiry.service.js");
  const access = new SupplierAccessService(db);
  const inventory = new InventoryService(db, access, new DataFreshnessService(db, access));
  const worker = new ReservationExpiryService(db, inventory, {});
  const deadline = new Date(Date.now() - 1000);
  await db.inventoryReservation.update({ where: { id: reservation.id }, data: { expiresAt: deadline } });
  expect(await worker.expireOrder(order.id, deadline)).toBe(true);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Срок резерва истёк" })).toBeVisible();
  await expect(page.getByText("Оплата не была заявлена до окончания срока.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отправить квитанцию", exact: true })).toHaveCount(0);
  expect((await db.supplierOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  expect((await db.inventoryReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("EXPIRED");
  await page.screenshot({ path: `../../outputs/workspace-audit-a10-expired-${width}.png`, fullPage: true });
}
