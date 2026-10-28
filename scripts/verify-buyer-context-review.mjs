import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { startLocalAuthFixture } from './lib/local-auth-fixture.mjs';
import { assertPortsAvailable } from './lib/local-readiness.mjs';

// Real HTTP/SQL and browser acceptance on the approved disposable database.
// Synthetic fixtures are retained for inspection; sessions and owned servers close.
const root = path.resolve(import.meta.dirname, '..');
const origin = 'http://127.0.0.1:3103';
const adapter = path.join(root, '.tmp/buyer-context-review-20261029/next-adapter.mjs');
const output = path.join(root, 'output/playwright/buyer-context-review-20261029');
// Reproducible isolated build without touching the developer's .next directory.
// Run --build first, then use the db:test wrapper for the actual verification.
if (process.argv.includes('--build')) {
  const directory = path.dirname(adapter);
  await mkdir(directory, { recursive: true });
  await writeFile(adapter, 'export default {name:"buyer-context-review",modifyConfig(config){return {...config,distDir:"../../.tmp/buyer-context-review-20261029/next",typescript:{...config.typescript,tsconfigPath:"../../.tmp/buyer-context-review-20261029/tsconfig.json"}};}};');
  await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({ extends: '../../apps/web/tsconfig.json', compilerOptions: { tsBuildInfoFile: './web.tsbuildinfo' }, include: ['../../apps/web/**/*.ts', '../../apps/web/**/*.tsx', './next/types/**/*.ts'], exclude: ['../../node_modules', '../../apps/web/.next'] }));
  const nextEnv = path.join(root, 'apps/web/next-env.d.ts');
  const original = await readFile(nextEnv);
  let code;
  try {
    const windows = process.platform === 'win32';
    const child = spawn(windows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm', windows ? ['/d', '/s', '/c', 'npm run build --workspace=@marketplace/web'] : ['run', 'build', '--workspace=@marketplace/web'], {
      cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, NEXT_ADAPTER_PATH: adapter, DEPLOYMENT_PROFILE: 'go_live', NEXT_PUBLIC_DEPLOYMENT_PROFILE: 'go_live', INTERNAL_API_URL: 'http://127.0.0.1:4412/api', NEXT_TELEMETRY_DISABLED: '1' },
    });
    code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', value => resolve(value ?? 1)); });
  } finally { await writeFile(nextEnv, original); }
  process.exit(code);
}
await assertPortsAvailable([3103, 4412]);
await mkdir(output, { recursive: true });
const fixture = await startLocalAuthFixture({ operator: false, webApps: ['landing'], publicCatalog: true, apiPort: 4412, deploymentProfile: 'go_live' });
const db = fixture.db;
const passed = [];
let browser, web, page, ownedOfferId, phase = 'fixtures';
const step = async (name, work) => { phase = name; await work(); passed.push(name); console.log(`PASS ${name}`); };
const call = (route, token, body, status = body === undefined ? 200 : 201) => fixture.request(route, body, status, token);
async function grant(account, codes) {
  const role = await db.role.findFirstOrThrow({ where: { organizationId: account.organizationId, code: 'audit_local_auth' } });
  for (const code of codes) {
    const permission = await db.permission.findUniqueOrThrow({ where: { code } });
    await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
  }
  return role;
}
async function signIn(account) { return call('/auth/login', undefined, { email: account.email, password: account.password }); }
async function picture(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type=password]'), page.locator('input[type=email]')] });
}
try {
  const buyer = await fixture.account(61, 'BUYER');
  const second = await fixture.account(62, 'BUYER');
  const supplier = await fixture.account(63, 'SUPPLIER');
  const reader = await fixture.account(64, 'BUYER');
  const permissions = ['trust.review.create', 'order.approve', 'delivery.view'];
  await grant(buyer, permissions);
  const secondRole = await grant(second, permissions);
  await grant(supplier, ['trust.review.create']);
  for (const [account, name] of [[buyer, 'Проверочная клиника A'], [second, 'Проверочная клиника B']])
    await db.organization.update({ where: { id: account.organizationId }, data: { displayName: name, commerceDataset: 'TEST' } });
  await db.organization.update({ where: { id: supplier.organizationId }, data: { displayName: 'Проверочный поставщик', commerceDataset: 'TEST' } });
  await db.organizationMembership.create({ data: { userId: buyer.userId, organizationId: second.organizationId, status: 'ACTIVE', acceptedAt: new Date(), roles: { create: { roleId: secondRole.id } } } });
  const auth = await signIn(buyer), secondAuth = await signIn(second), supplierAuth = await signIn(supplier), readerAuth = await signIn(reader);
  assert.equal(auth.activeOrganizationId, buyer.organizationId);
  const unit = await db.unitOfMeasure.findUniqueOrThrow({ where: { code: 'piece' } });
  const product = await db.product.create({ data: { canonicalName: 'Проверочный товар для контекста', slug: fixture.runId, baseUnitId: unit.id, productType: 'MATERIAL', status: 'ACTIVE' } });
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: fixture.runId, saleUnitId: unit.id, packageQuantity: 1, status: 'ACTIVE' } });
  const packaging = await db.productPackaging.create({ data: { productVariantId: variant.id, unitId: unit.id, code: fixture.runId, name: 'Штука', level: 'BASE', quantityInBaseUnit: 1 } });
  const warehouse = await db.warehouse.create({ data: { supplierOrganizationId: supplier.organizationId, code: fixture.runId, name: 'Проверочный склад' } });
  const offer = await db.supplierOffer.create({ data: { supplierOrganizationId: supplier.organizationId, productVariantId: variant.id, saleUnitId: unit.id, packagingId: packaging.id, status: 'ACTIVE', publication: { create: { status: 'PUBLISHED', marketplaceVisible: true, publishedAt: new Date() } }, prices: { create: { amountMinor: '100', currency: 'KZT', status: 'ACTIVE', validFrom: new Date(Date.now() - 60000), lastConfirmedAt: new Date(), freshnessExpiresAt: new Date(Date.now() + 3600000) } } } });
  ownedOfferId = offer.id;
  const balance = await db.inventoryBalance.create({ data: { supplierOrganizationId: supplier.organizationId, warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id, quantityOnHand: '100', quantityAvailable: '100', availabilityStatus: 'IN_STOCK', freshnessStatus: 'FRESH', source: 'MANUAL', externalUpdatedAt: new Date(), lastSuccessfulSyncAt: new Date(), freshnessExpiresAt: new Date(Date.now() + 3600000) } });
  await db.inventoryLot.create({ data: { inventoryBalanceId: balance.id, supplierOrganizationId: supplier.organizationId, warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id, lotNumber: fixture.runId, quantityOnHand: '100', quantityAvailable: '100', status: 'ACTIVE', expirationDate: new Date('2035-12-31') } });
  const template = await db.documentTemplate.findUniqueOrThrow({ where: { code_version: { code: 'MARKETPLACE_SUPPLIER_AGREEMENT_RU', version: 1 } } });
  const operator = await db.organizationCapability.findFirstOrThrow({ where: { capability: 'MARKETPLACE_OPERATOR' } });
  const startsAt = new Date(Date.now() - 60000), endsAt = new Date(Date.now() + 86400000), metadata = { testFixture: fixture.runId, notLegallyBinding: true };
  const agreementDocument = await db.document.create({ data: { ownerOrganizationId: supplier.organizationId, templateId: template.id, kind: 'MARKETPLACE_SUPPLIER_AGREEMENT', format: 'PDF', source: 'GENERATED', status: 'SIGNED', title: 'Проверочный договор', documentNumber: fixture.runId, generatedAt: startsAt, immutableAt: startsAt, expiresAt: endsAt, metadata } });
  await db.marketplaceAgreement.create({ data: { agreementNumber: fixture.runId, supplierOrganizationId: supplier.organizationId, operatorOrganizationId: operator.organizationId, documentId: agreementDocument.id, templateId: template.id, templateVersion: template.version, status: 'ACTIVE', startsAt, endsAt, activatedAt: startsAt, autoRenew: false, metadata } });
  const makeOrder = async () => {
    const cart = await db.cart.create({ data: { buyerOrganizationId: buyer.organizationId, status: 'CHECKED_OUT' } });
    const cartItem = await db.cartItem.create({ data: { cartId: cart.id, offerId: offer.id, quantity: '3', unitPriceMinor: '100', totalPriceMinor: '300', currency: 'KZT', priceSource: 'BASE', pricingSnapshot: {} } });
    const checkout = await db.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: buyer.organizationId, totalAmountMinor: '300', currency: 'KZT', status: 'COMPLETED', idempotencyKey: randomUUID(), pricingSnapshot: {} } });
    const order = await db.supplierOrder.create({ data: { checkoutId: checkout.id, buyerOrganizationId: buyer.organizationId, supplierOrganizationId: supplier.organizationId, orderNumber: `SO-${checkout.id.replaceAll('-', '').slice(0, 12).toUpperCase()}-01`, status: 'IN_TRANSIT', paymentStatus: 'PAID', commerceDataset: 'TEST', subtotalAmountMinor: '300', currency: 'KZT', items: { create: { cartItemId: cartItem.id, offerId: offer.id, productVariantId: variant.id, warehouseId: warehouse.id, quantity: '3', acceptedQuantity: '3', unitPriceMinor: '100', totalPriceMinor: '300', currency: 'KZT', offerSnapshot: {}, inventorySnapshot: {}, status: 'CONFIRMED' } } }, include: { items: true } });
    const shipments = [];
    for (const [index, quantity] of ['1', '2'].entries()) shipments.push(await db.shipment.create({ data: { supplierOrderId: order.id, warehouseId: warehouse.id, shipmentNumber: `SHP-${order.orderNumber}-${(Date.now() + index).toString(36).toUpperCase()}`, method: 'SUPPLIER_CITY', status: 'IN_TRANSIT', recipientName: 'Проверочный получатель', items: { create: { supplierOrderItemId: order.items[0].id, quantity } }, fulfillmentSteps: { create: { type: 'INSTALLATION', status: 'PENDING', sequence: 1 } } }, include: { items: true } }));
    return { ...order, shipments };
  };
  const receive = async (order, index) => {
    const latest = await db.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
    const shipment = order.shipments[index];
    const command = { action: 'RECEIVE_SHIPMENT', expectedVersion: latest.version, shipmentId: shipment.id, items: shipment.items.map(item => ({ shipmentItemId: item.id, deliveredQuantity: item.quantity.toString() })), idempotencyKey: randomUUID() };
    const result = await call(`/supplier-orders/${order.id}/workflow`, auth.accessToken, command);
    assert.deepEqual(await call(`/supplier-orders/${order.id}/workflow`, auth.accessToken, command), result, 'Receipt replay must be identical');
  };
  const state = order => call(`/trust/orders/${order.id}/review-state`, auth.accessToken);
  const reviewInput = { overallRating: 5, dimensions: {}, comment: 'Получение подтверждено', idempotencyKey: randomUUID() };
  if (!process.argv.includes('--browser-only')) {
  const order = await makeOrder();
  await step('review authorization and invalid input', async () => {
    await call(`/trust/orders/${order.id}/review-state`, readerAuth.accessToken, undefined, 403);
    await call(`/trust/orders/${order.id}/review-state`, secondAuth.accessToken, undefined, 404);
    await call(`/trust/orders/${order.id}/reviews`, supplierAuth.accessToken, reviewInput, 404);
    await call(`/trust/orders/${order.id}/reviews`, auth.accessToken, { ...reviewInput, overallRating: 6 }, 400);
    await call('/trust/orders/invalid-id/review-state', auth.accessToken, undefined, 400);
    assert.equal(await db.verifiedReview.count({ where: { supplierOrderId: order.id } }), 0);
  });
  await step('partial and complete receipts independent of signatures and installation', async () => {
    assert.equal((await state(order)).eligible, false);
    await receive(order, 0);
    assert.equal((await state(order)).eligible, false);
    await call(`/trust/orders/${order.id}/reviews`, auth.accessToken, reviewInput, 409);
    await receive(order, 1);
    assert.equal((await state(order)).eligible, true);
    assert.equal((await db.supplierOrder.findUniqueOrThrow({ where: { id: order.id } })).status, 'PARTIALLY_FULFILLED');
    assert.equal(await db.document.count({ where: { supplierOrderId: order.id } }), 0);
    assert.equal(await db.fulfillmentStep.count({ where: { shipment: { supplierOrderId: order.id }, status: 'PENDING' } }), 2);
  });
  await step('concurrent review replay creates one review revision and audit', async () => {
    const responses = await Promise.all([1, 2].map(() => call(`/trust/orders/${order.id}/reviews`, auth.accessToken, reviewInput)));
    assert.equal(responses[0].id, responses[1].id);
    assert.equal(await db.verifiedReview.count({ where: { supplierOrderId: order.id } }), 1);
    assert.equal(await db.verifiedReviewRevision.count({ where: { reviewId: responses[0].id } }), 1);
    assert.equal(await db.auditLog.count({ where: { entityId: responses[0].id, action: 'trust.review.created' } }), 1);
    await call(`/trust/orders/${order.id}/reviews`, auth.accessToken, { ...reviewInput, idempotencyKey: randomUUID() }, 409);
    assert.equal((await state(order)).review.id, responses[0].id);
  });
  await step('audit failure rolls back the review and its revision', async () => {
    const rollback = await makeOrder(); await receive(rollback, 0); await receive(rollback, 1);
    const require = createRequire(import.meta.url);
    const { TrustCommerceService } = require('../apps/api/dist/src/modules/trust-commerce/trust-commerce.service.js');
    const service = new TrustCommerceService({ $transaction: work => db.$transaction(tx => work({
      $queryRaw: tx.$queryRaw.bind(tx), supplierOrder: tx.supplierOrder, verifiedReview: tx.verifiedReview, verifiedReviewRevision: tx.verifiedReviewRevision,
      auditLog: { create: async () => { throw Error('injected audit failure'); } },
    })) });
    const key = randomUUID();
    await assert.rejects(service.createReview(rollback.id, { ...reviewInput, idempotencyKey: key }, { organizationId: buyer.organizationId, actorId: buyer.userId }), /injected audit failure/);
    assert.equal(await db.verifiedReview.count({ where: { supplierOrderId: rollback.id } }), 0);
    assert.equal(await db.verifiedReviewRevision.count({ where: { review: { supplierOrderId: rollback.id } } }), 0);
  });
  }
  const uiOrders = [await makeOrder(), await makeOrder()];
  for (const current of uiOrders) { await receive(current, 0); await receive(current, 1); }
  const cartA = await call(`/buyers/${buyer.organizationId}/carts`, auth.accessToken, { currency: 'KZT' });
  const cartB = await call(`/buyers/${second.organizationId}/carts`, secondAuth.accessToken, { currency: 'KZT' });
  await call(`/carts/${cartA.id}/items`, auth.accessToken, { offerId: offer.id, quantity: 1 });
  await call(`/carts/${cartB.id}/items`, secondAuth.accessToken, { offerId: offer.id, quantity: 2 });
  assert.equal((await call(`/carts/${cartA.id}/validate`, auth.accessToken, {}, 200)).canCheckout, true);
  assert.equal((await call(`/carts/${cartB.id}/validate`, secondAuth.accessToken, {}, 200)).canCheckout, true);
  phase = 'frontend startup';
  web = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', 'apps/web', '--hostname', '127.0.0.1', '--port', '3103'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', DEPLOYMENT_PROFILE: 'go_live', NEXT_PUBLIC_DEPLOYMENT_PROFILE: 'go_live', NEXT_ADAPTER_PATH: adapter, INTERNAL_API_URL: fixture.apiUrl, NEXT_TELEMETRY_DISABLED: '1' } });
  web.stdout.resume(); web.stderr.resume();
  const deadline = Date.now() + 60000; let ready = false;
  while (Date.now() < deadline) {
    if (web.exitCode !== null) throw Error('Owned frontend exited');
    try { ready = (await fetch(origin + '/login', { signal: AbortSignal.timeout(2500) })).ok; } catch {}
    if (ready) break; await delay(300);
  }
  assert.ok(ready, 'Frontend startup budget');
  browser = await chromium.launch({ headless: true });
  for (const [index, width] of [1440, 390].entries()) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    await step(`login and explicit organization context ${width}`, async () => {
      await page.goto(`${origin}/login?signedOut=1&returnTo=/clinic/cart`);
      await page.getByLabel('Рабочий email').fill(buyer.email);
      await page.getByLabel('Пароль', { exact: false }).and(page.locator('input')).fill(buyer.password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await page.getByLabel('Организация и кабинет').selectOption({ label: 'Проверочная клиника A · Клиника' });
      await page.getByRole('button', { name: 'Открыть выбранную организацию' }).click();
      await expect(page).toHaveURL(origin + '/clinic/cart');
      await expect(page.getByRole('combobox', { name: 'Покупатель', exact: true })).toHaveValue(buyer.organizationId);
      const contextBounds = await page.locator('[aria-label="Контекст покупателя"]').boundingBox();
      const headerBounds = await page.locator('header[aria-label="События организации"]').boundingBox();
      assert(contextBounds && headerBounds && contextBounds.y >= headerBounds.y + headerBounds.height, 'Context must not overlap the workspace header');
      const confirmation = page.getByRole('checkbox', { name: 'Подтверждаю покупку от организации: Проверочная клиника A' });
      await expect(confirmation).not.toBeChecked();
      await expect(page.getByRole('button', { name: 'Оформить заказ', exact: true })).toBeDisabled();
      await confirmation.focus(); await page.keyboard.press('Space'); await expect(confirmation).toBeChecked();
      await expect(page.getByRole('button', { name: 'Оформить заказ', exact: true })).toBeEnabled();
      await picture(`cart-confirmation-${width}`);
    });
    await step(`personal mode preserves organization carts and blocks purchases ${width}`, async () => {
      await page.getByRole('combobox', { name: 'Покупатель', exact: true }).selectOption('personal');
      await expect(page).toHaveURL(origin + '/catalog');
      await expect(page.getByText(/Личный режим: можно просматривать каталог/)).toBeVisible();
      await page.goto(origin + '/clinic/cart');
      await expect(page.getByRole('button', { name: 'Оформить заказ', exact: true })).toHaveCount(0);
      assert.equal((await db.cart.findUniqueOrThrow({ where: { id: cartA.id } })).buyerOrganizationId, buyer.organizationId);
      assert.equal((await db.cart.findUniqueOrThrow({ where: { id: cartB.id } })).buyerOrganizationId, second.organizationId);
      await picture(`personal-${width}`);
    });
    await step(`organization switch resets confirmation and rejects foreign cart ${width}`, async () => {
      await page.getByRole('combobox', { name: 'Покупатель', exact: true }).selectOption(second.organizationId);
      await expect(page).toHaveURL(origin + '/catalog');
      await page.goto(origin + '/clinic/cart');
      await expect(page.getByRole('combobox', { name: 'Покупатель', exact: true })).toHaveValue(second.organizationId);
      await expect(page.getByRole('checkbox', { name: 'Подтверждаю покупку от организации: Проверочная клиника B' })).not.toBeChecked();
      const foreignStatus = await page.evaluate(async id => {
        const session = JSON.parse(sessionStorage.getItem('dentmarket:buyer-session') ?? 'null');
        return (await fetch(`/api/carts/${id}/validate`, { method: 'POST', headers: { authorization: `Bearer ${session.accessToken}` } })).status;
      }, cartA.id);
      assert.equal(foreignStatus, 403);
      await picture(`second-organization-${width}`);
      await page.getByRole('combobox', { name: 'Покупатель', exact: true }).selectOption(buyer.organizationId);
      await expect(page).toHaveURL(origin + '/catalog');
    });
    await step(`review loading error recovery and uncertain submit ${width}`, async () => {
      const current = uiOrders[index];
      let readFailure = true;
      await page.route(`**/api/trust/orders/${current.id}/review-state`, route => readFailure ? route.fulfill({ status: 503, json: { message: 'Synthetic unavailable' } }) : route.continue());
      await page.goto(`${origin}/clinic/orders/${current.id}`);
      await expect(page.getByText('Не удалось проверить право на отзыв.')).toBeVisible();
      readFailure = false; await page.getByRole('button', { name: 'Повторить проверку', exact: true }).click();
      const rating = page.getByRole('combobox', { name: 'Общая оценка', exact: true });
      await rating.selectOption('5'); await page.getByRole('textbox', { name: 'Комментарий к отзыву', exact: true }).fill('Все товары получены. Документы и монтаж ещё не завершены.');
      const computed = await rating.evaluate(element => { const parent = element.parentElement; const style = getComputedStyle(parent); return { height: parent.getBoundingClientRect().height, radius: style.borderRadius, font: getComputedStyle(element).fontFamily, fontSize: getComputedStyle(element).fontSize, overflow: document.documentElement.scrollWidth > innerWidth }; });
      await writeFile(path.join(output, `controls-${width}.json`), JSON.stringify(computed, null, 2));
      assert.equal(computed.height, 44); assert.equal(computed.radius, '8px'); assert.match(computed.font, /Manrope/); assert.equal(computed.overflow, false);
      await rating.focus(); await picture(`review-form-${width}`);
      await page.locator('section').filter({ has: rating }).screenshot({ path: path.join(output, `review-section-${width}.png`), animations: 'disabled' });
      let postCount = 0;
      await page.route(`**/api/trust/orders/${current.id}/reviews`, async route => {
        postCount++;
        if (postCount === 1) return route.fulfill({ status: 503, json: { message: 'Synthetic unavailable' } });
        await route.fetch(); await route.abort('failed');
      });
      await page.getByRole('button', { name: 'Отправить отзыв', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Комментарий к отзыву', exact: true })).toHaveValue('Все товары получены. Документы и монтаж ещё не завершены.');
      await page.getByRole('button', { name: 'Повторить отправку', exact: true }).click();
      await expect(page.getByText(/Отзыв сохранён/)).toBeVisible();
      await page.reload(); await expect(page.getByText(/Отзыв сохранён/)).toBeVisible();
      assert.equal(postCount, 2); assert.equal(await db.verifiedReview.count({ where: { supplierOrderId: current.id } }), 1);
      await expect(page.getByRole('button', { name: 'Отправить отзыв', exact: true })).toHaveCount(0);
      await picture(`review-saved-${width}`);
    });
    await context.close(); page = undefined;
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'PASS', profile: 'go_live, NODE_ENV=test API, production-built web', passed }, null, 2));
} catch (error) {
  if (page) await picture('failure').catch(() => {});
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'FAIL', phase, passed, message: String(error.message).slice(0, 2000) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (web?.exitCode === null) { const stopped = new Promise(resolve => web.once('exit', resolve)); web.kill(); await Promise.race([stopped, delay(3000)]); if (web.exitCode === null) web.kill('SIGKILL'); }
  try {
    if (ownedOfferId) {
      await db.offerPublication.update({ where: { offerId: ownedOfferId }, data: { marketplaceVisible: false, status: 'HIDDEN' } });
      await db.supplierOffer.update({ where: { id: ownedOfferId }, data: { status: 'ARCHIVED' } });
    }
  } finally { await fixture.stop(); }
}
