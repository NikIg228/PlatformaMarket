import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export async function verifyOrderReturnUI({ db, page, request, orderId, buyerRoleId, supplierId, supplierToken, key, width }: {
  db: PrismaClient; page: Page; request: APIRequestContext; orderId: string; buyerRoleId: string; supplierId: string; supplierToken: string; key: string; width: number;
}) {
  // Establish a paid, unshipped fixture. Money ingestion has a separate PG proof.
  await db.rolePermission.create({ data: { roleId: buyerRoleId, permissionId: (await db.permission.findUniqueOrThrow({ where: { code: "order.approve" } })).id } });
  const order = await db.supplierOrder.findUniqueOrThrow({ where: { id: orderId } });
  await db.orderTransferClaim.updateMany({ where: { supplierOrderId: orderId }, data: { status: "CONFIRMED", receivedAmountMinor: order.subtotalAmountMinor, confirmedAt: new Date() } });
  await page.goto(`/clinic/orders/${orderId}`);
  await page.getByLabel("Причина и комментарий к возврату").fill("Заказ больше не требуется, остановите отправку");
  const requested = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/supplier-orders/${orderId}/workflow`));
  await page.getByRole("button", { name: "Отправить заявку на возврат", exact: true }).click();
  expect((await requested).status()).toBe(201);
  await expect(page.getByText("Ожидает решения поставщика", { exact: true })).toBeVisible();
  await page.goto(`/supplier/orders/${orderId}`);
  await page.getByLabel("Комментарий к решению о возврате").fill("Все отгрузки остановлены до отправки");
  await page.getByRole("button", { name: "Подтвердить остановку заказа и возврат", exact: true }).click();
  await expect(page.getByText("Согласован", { exact: true })).toBeVisible();
  const value = await db.orderManualReturn.findFirstOrThrow({ where: { supplierOrderId: orderId } });
  const storageKey = `core03-live-${key}/refund.pdf`, checksumSha256 = "b".repeat(64);
  await db.uploadAsset.create({ data: { organizationId: supplierId, purpose: "DOCUMENT", storageKey, originalName: "refund.pdf", safeName: "refund.pdf", declaredMime: "application/pdf", detectedMime: "application/pdf", sizeBytes: 1, checksumSha256, status: "CLEAN" } });
  const doc = await db.document.create({ data: { ownerOrganizationId: supplierId, supplierOrderId: orderId, kind: "PAYMENT_PROOF", format: "PDF", source: "UPLOADED", status: "GENERATED", title: "Synthetic refund", documentNumber: randomUUID(), amountMinor: value.amountMinor, currency: "KZT", storageKey, checksumSha256, immutableAt: new Date() } });
  const version = (await db.supplierOrder.findUniqueOrThrow({ where: { id: orderId } })).version;
  const sent = await request.post(`http://127.0.0.1:4012/api/supplier-orders/${orderId}/workflow`, { headers: { authorization: `Bearer ${supplierToken}` },
    data: { action: "SEND_MANUAL_REFUND", returnId: value.id, documentId: doc.id, expectedVersion: version, idempotencyKey: randomUUID() } });
  expect(sent.status()).toBe(201);
  await page.goto(`/clinic/orders/${orderId}`);
  const receive = page.getByRole("button", { name: "Подтвердить получение возврата", exact: true });
  await expect(receive).toBeDisabled();
  await page.getByRole("checkbox", { name: "Деньги в указанной сумме поступили на счёт клиники" }).check();
  await receive.click();
  await expect(page.getByText("Клиника подтвердила получение денег", { exact: true })).toBeVisible();
  expect((await db.orderManualReturn.findUniqueOrThrow({ where: { id: value.id } })).status).toBe("REFUND_RECEIVED");
  expect((await db.supplierOrder.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe("REFUNDED");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `../../outputs/core03-live-refund-${width}.png`, fullPage: true });
}
