import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { verifyReservationExpiryUI } from "./reservation-expiry";

export async function verifyCartRecoveryUI({ db, page, request, buyerId, token, offerId, key, width }: {
  db: PrismaClient; page: Page; request: APIRequestContext; buyerId: string; token: string; offerId: string; key: string; width: number;
}) {
  const base = "http://127.0.0.1:4012/api";
  const headers = { authorization: `Bearer ${token}` };
  const created = await request.post(`${base}/buyers/${buyerId}/carts`, { headers, data: { currency: "KZT" } });
  expect(created.status()).toBe(201);
  const source = await created.json();
  expect((await request.post(`${base}/carts/${source.id}/items`, { headers, data: { offerId, quantity: 1 } })).status()).toBe(201);
  // Browser precondition is the persisted outcome of compensation. The real
  // partial reserve failure/compensation itself is tested by the PostgreSQL gate.
  await db.checkout.create({ data: { cartId: source.id, buyerOrganizationId: buyerId, status: "FAILED",
    totalAmountMinor: "13000", currency: "KZT", idempotencyKey: `failed-ui-${key}`, pricingSnapshot: [] } });
  await db.cart.update({ where: { id: source.id }, data: { status: "ABANDONED", version: { increment: 1 } } });
  await db.offerPublication.update({ where: { offerId }, data: { marketplaceVisible: false } });
  await db.offerPrice.updateMany({ where: { offerId, status: "ACTIVE" }, data: { amountMinor: "14000" } });
  const commands: unknown[] = [], recoveredIds: string[] = [];
  await page.route(`**/carts/${source.id}/recover`, async route => {
    commands.push(route.request().postDataJSON());
    const result = await route.fetch();
    expect(result.status()).toBe(201);
    recoveredIds.push((await result.json()).id);
    if (commands.length === 1) return route.abort("failed");
    return route.fulfill({ response: result });
  });
  await page.goto("/clinic/cart");
  const recover = page.getByRole("button", { name: "Восстановить состав корзины", exact: true });
  await expect(recover).toBeVisible();
  const lost = page.waitForEvent("requestfailed", req => req.url().endsWith(`/carts/${source.id}/recover`));
  await recover.focus(); await page.keyboard.press("Enter"); await lost;
  await expect(page.getByRole("alert").filter({ hasText: "Повтор восстановления не создаст вторую корзину" })).toBeVisible();
  await expect(recover).toBeEnabled(); await recover.click();
  await expect(page.getByRole("status").filter({ hasText: "Состав восстановлен" })).toBeVisible();
  expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]);
  expect(recoveredIds[0]).toBe(recoveredIds[1]); expect(recoveredIds[0]).not.toBe(source.id);
  await expect(page.getByRole("button", { name: "Оформить заказ", exact: true })).toBeDisabled();
  const current = await db.cart.findUniqueOrThrow({ where: { id: recoveredIds[0] }, include: { items: true } });
  expect(current.items).toHaveLength(1); expect(current.items[0].offerId).toBe(offerId);
  expect((await db.cart.findUniqueOrThrow({ where: { id: source.id } })).status).toBe("ABANDONED");
  await page.screenshot({ path: `../../outputs/workspace-audit-a16-unavailable-${width}.png`, fullPage: true });
  await db.offerPublication.update({ where: { offerId }, data: { marketplaceVisible: true } });
  await page.reload();
  await expect(page.getByRole("button", { name: "Восстановить состав корзины", exact: true })).toHaveCount(0);
  const accept = page.getByRole("button", { name: "Принять изменения", exact: true });
  await expect(accept).toBeEnabled();
  await expect(page.getByRole("button", { name: "Оформить заказ", exact: true })).toBeDisabled();
  await accept.click();
  await expect(page.getByRole("button", { name: "Оформить заказ", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await verifyReservationExpiryUI({ db, page, request, cartId: current.id, token, key, width });
  await db.offerPrice.updateMany({ where: { offerId, status: "ACTIVE" }, data: { amountMinor: "13000" } });
}
