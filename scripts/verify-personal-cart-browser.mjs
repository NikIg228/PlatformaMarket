import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { startLocalAuthFixture } from './lib/local-auth-fixture.mjs';
import { assertPortsAvailable } from './lib/local-readiness.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = 'http://127.0.0.1:3103';
const directory = path.join(root, '.tmp/personal-cart-browser');
const adapter = path.join(directory, 'next-adapter.mjs');
const output = path.join(root, 'output/playwright/personal-cart');
await mkdir(directory, { recursive: true });
if (process.argv.includes('--build')) {
  await writeFile(adapter, 'export default {name:"personal-cart",modifyConfig(config){return {...config,distDir:"../../.tmp/personal-cart-browser/next",typescript:{...config.typescript,tsconfigPath:"../../.tmp/personal-cart-browser/tsconfig.json"}};}};');
  await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({ extends: '../../apps/web/tsconfig.json', compilerOptions: { tsBuildInfoFile: './web.tsbuildinfo' }, include: ['../../apps/web/**/*.ts', '../../apps/web/**/*.tsx', './next/types/**/*.ts'], exclude: ['../../node_modules', '../../apps/web/.next'] }));
  const nextEnv = path.join(root, 'apps/web/next-env.d.ts'), original = await readFile(nextEnv);
  let code;
  try {
    const child = spawn(process.execPath, [process.env.npm_execpath, 'run', 'build', '--workspace=@marketplace/web'], {
      cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, NEXT_ADAPTER_PATH: adapter, DEPLOYMENT_PROFILE: 'go_live', NEXT_PUBLIC_DEPLOYMENT_PROFILE: 'go_live', INTERNAL_API_URL: 'http://127.0.0.1:4412/api', NEXT_TELEMETRY_DISABLED: '1' },
    });
    code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', value => resolve(value ?? 1)); });
  } finally { await writeFile(nextEnv, original); }
  process.exit(code);
}
await assertPortsAvailable([3103, 4412]);
await mkdir(output, { recursive: true });
const fixture = await startLocalAuthFixture({ operator: false, webApps: ['landing'], publicCatalog: true, apiPort: 4412, deploymentProfile: 'go_live' });
const db = fixture.db, passed = [];
let browser, web, page, ownedOfferId, phase = 'fixtures';
const step = async (name, work) => { phase = name; await work(); passed.push(name); console.log(`PASS ${name}`); };
async function picture(name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input[type=password]'), page.locator('input[type=email]')] });
}
try {
  const personal = await fixture.account(71, 'BUYER'), other = await fixture.account(72, 'BUYER');
  const clinic = await fixture.account(73, 'BUYER'), supplier = await fixture.account(74, 'SUPPLIER');
  // Genuine verified users with no organization membership, followed by normal UI login.
  await db.organizationMembership.deleteMany({ where: { userId: { in: [personal.userId, other.userId] } } });
  for (const [account, name] of [[personal, 'Личный покупатель А'], [other, 'Личный покупатель Б'], [clinic, 'Представитель клиники']])
    await db.user.update({ where: { id: account.userId }, data: { displayName: name } });
  await db.organization.update({ where: { id: clinic.organizationId }, data: { displayName: 'Проверочная клиника', commerceDataset: 'TEST' } });
  await db.organization.update({ where: { id: supplier.organizationId }, data: { displayName: 'Проверочный поставщик', commerceDataset: 'TEST' } });
  const unit = await db.unitOfMeasure.findUniqueOrThrow({ where: { code: 'piece' } });
  const name = 'Материал для проверки личной корзины';
  const product = await db.product.create({ data: { canonicalName: name, slug: fixture.runId, baseUnitId: unit.id, productType: 'MATERIAL', status: 'ACTIVE' } });
  const variant = await db.productVariant.create({ data: { productId: product.id, sku: fixture.runId, saleUnitId: unit.id, packageQuantity: 1, status: 'ACTIVE' } });
  const packaging = await db.productPackaging.create({ data: { productVariantId: variant.id, unitId: unit.id, code: fixture.runId, name: 'Штука', level: 'BASE', quantityInBaseUnit: 1 } });
  const clinicProfile = await db.organizationProfile.findUniqueOrThrow({ where: { organizationId: clinic.organizationId }, include: { deliveryAddress: true } });
  const warehouse = await db.warehouse.create({ data: { supplierOrganizationId: supplier.organizationId, code: fixture.runId, name: 'Проверочный склад', cityId: clinicProfile.deliveryAddress.cityId } });
  const offer = await db.supplierOffer.create({ data: { supplierOrganizationId: supplier.organizationId, productVariantId: variant.id, saleUnitId: unit.id, packagingId: packaging.id, status: 'ACTIVE', publication: { create: { status: 'PUBLISHED', marketplaceVisible: true, publishedAt: new Date() } }, prices: { create: { amountMinor: '100000', currency: 'KZT', status: 'ACTIVE', validFrom: new Date(Date.now() - 60000), lastConfirmedAt: new Date(), freshnessExpiresAt: new Date(Date.now() + 3600000) } } } });
  ownedOfferId = offer.id;
  const balance = await db.inventoryBalance.create({ data: { supplierOrganizationId: supplier.organizationId, warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id, quantityOnHand: '100', quantityAvailable: '100', availabilityStatus: 'IN_STOCK', freshnessStatus: 'FRESH', source: 'MANUAL', externalUpdatedAt: new Date(), lastSuccessfulSyncAt: new Date(), freshnessExpiresAt: new Date(Date.now() + 3600000) } });
  await db.inventoryLot.create({ data: { inventoryBalanceId: balance.id, supplierOrganizationId: supplier.organizationId, warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id, lotNumber: fixture.runId, quantityOnHand: '100', quantityAvailable: '100', status: 'ACTIVE', expirationDate: new Date('2035-12-31') } });
  const template = await db.documentTemplate.findUniqueOrThrow({ where: { code_version: { code: 'MARKETPLACE_SUPPLIER_AGREEMENT_RU', version: 1 } } });
  const operator = await db.organizationCapability.findFirstOrThrow({ where: { capability: 'MARKETPLACE_OPERATOR' } });
  const startsAt = new Date(Date.now() - 60000), endsAt = new Date(Date.now() + 86400000), metadata = { testFixture: fixture.runId, notLegallyBinding: true };
  const document = await db.document.create({ data: { ownerOrganizationId: supplier.organizationId, templateId: template.id, kind: 'MARKETPLACE_SUPPLIER_AGREEMENT', format: 'PDF', source: 'GENERATED', status: 'SIGNED', title: 'Проверочный договор', documentNumber: fixture.runId, generatedAt: startsAt, immutableAt: startsAt, expiresAt: endsAt, metadata } });
  await db.marketplaceAgreement.create({ data: { agreementNumber: fixture.runId, supplierOrganizationId: supplier.organizationId, operatorOrganizationId: operator.organizationId, documentId: document.id, templateId: template.id, templateVersion: template.version, status: 'ACTIVE', startsAt, endsAt, activatedAt: startsAt, autoRenew: false, metadata } });
  web = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3103'], {
    cwd: path.join(root, 'apps/web'), windowsHide: true, stdio: 'ignore', env: { ...process.env, NEXT_ADAPTER_PATH: adapter, INTERNAL_API_URL: 'http://127.0.0.1:4412/api', DEPLOYMENT_PROFILE: 'go_live', NEXT_PUBLIC_DEPLOYMENT_PROFILE: 'go_live', NODE_ENV: 'production' },
  });
  const deadline = Date.now() + 60000;
  while (true) {
    assert.equal(web.exitCode, null, 'Owned web exited');
    if (await fetch(origin + '/login').then(r => r.ok).catch(() => false)) break;
    assert.ok(Date.now() < deadline, 'Owned web readiness timeout'); await delay(300);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  const signIn = async account => {
    await page.goto(origin + '/login?signedOut=1&personal=1');
    await page.getByLabel('Рабочий email').fill(account.email);
    await page.getByLabel('Пароль', { exact: false }).fill(account.password);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(origin + '/personal/cart');
    await expect(page.getByRole('heading', { name: 'Личная корзина', exact: true })).toBeVisible();
  };
  const readCart = () => db.personalCart.findUniqueOrThrow({ where: { ownerUserId: personal.userId }, include: { items: true } });
  const quantity = () => page.getByRole('spinbutton', { name: `Количество: ${name}`, exact: true });
  await step('personal login without membership and empty state', async () => {
    await signIn(personal); await expect(page.getByText('Корзина пока пуста', { exact: true })).toBeVisible();
    await picture('empty-desktop');
  });
  await step('product add, persisted cart and keyboard quantity edit', async () => {
    await page.getByRole('link', { name: 'В каталог', exact: true }).first().click();
    await expect(page).toHaveURL(origin + '/catalog');
    await expect(page.getByRole('combobox', { name: 'Покупатель', exact: true })).toHaveCount(0);
    await page.goto(`${origin}/products/${product.id}`);
    await page.getByRole('button', { name: 'В корзину', exact: true }).click();
    await page.getByRole('link', { name: 'Перейти в корзину', exact: true }).click();
    await expect(quantity()).toHaveValue('1');
    await quantity().fill('4');
    await page.getByRole('button', { name: 'Сохранить количество', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect.poll(async () => (await readCart()).items[0].quantity.toString()).toBe('4');
    await page.reload(); await expect(quantity()).toHaveValue('4');
    await picture('cart-desktop');
  });
  await step('price diff and explicit acceptance', async () => {
    await db.offerPrice.updateMany({ where: { offerId: offer.id }, data: { amountMinor: '150000' } });
    await page.reload();
    await expect(page.getByText('Условия изменились', { exact: true })).toBeVisible();
    assert.equal((await readCart()).items[0].pricingSnapshot.unitPriceMinor, '100000');
    await picture('price-diff-desktop');
    await page.getByRole('button', { name: 'Принять показанные условия', exact: true }).click();
    await expect.poll(async () => (await readCart()).items[0].pricingSnapshot.unitPriceMinor).toBe('150000');
  });
  await step('network recovery preserves quantity draft', async () => {
    await quantity().fill('3');
    await page.route('**/api/personal/carts/*/items/*', route => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue());
    await page.getByRole('button', { name: 'Сохранить количество', exact: true }).click();
    await expect(page.getByText(/Результат записи пока неизвестен/)).toBeVisible();
    await expect(quantity()).toHaveValue('3');
    await page.unroute('**/api/personal/carts/*/items/*');
    await page.getByRole('button', { name: 'Повторить проверку', exact: true }).click();
    await expect(quantity()).toHaveValue('3');
    await page.getByRole('button', { name: 'Сохранить количество', exact: true }).click();
    await expect.poll(async () => (await readCart()).items[0].quantity.toString()).toBe('3');
  });
  await step('mobile Kazakh, shared controls and no overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(origin + '/personal/cart?lang=kk');
    await expect(page.getByRole('heading', { name: 'Жеке себет', exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: `Саны: ${name}` })).toHaveValue('3');
    const styles = await page.getByRole('spinbutton').evaluate(input => {
      const control = input.closest('.dm-input');
      if (!control) throw new Error('Quantity must use the shared DmInput adapter');
      return { height: control.getBoundingClientRect().height, inputHeight: input.getBoundingClientRect().height,
        radius: getComputedStyle(control).borderRadius, font: getComputedStyle(input).fontFamily,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    await writeFile(path.join(output, 'computed-styles.json'), JSON.stringify(styles, null, 2));
    assert.ok(styles.height >= 44); assert.equal(styles.radius, '8px'); assert.equal(styles.overflow, false);
    await picture('cart-mobile-kk');
  });
  await step('account change cannot show the previous personal cart', async () => {
    await signIn(other); await expect(page.getByText('Корзина пока пуста', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
    assert.equal((await readCart()).items[0].quantity.toString(), '3');
  });
  await step('clinic member personal cart stays separate from organization cart', async () => {
    await signIn(clinic); await expect(page.getByText('Корзина пока пуста', { exact: true })).toBeVisible();
    await page.goto(`${origin}/products/${product.id}`); await page.getByRole('button', { name: 'В корзину', exact: true }).click();
    await page.getByRole('link', { name: 'Перейти в корзину', exact: true }).click();
    await expect(quantity()).toHaveValue('1');
    assert.equal(await db.cart.count({ where: { buyerOrganizationId: clinic.organizationId } }), 0);
    assert.equal(await db.personalCart.count({ where: { ownerUserId: clinic.userId } }), 1);
  });
  await step('switch back to clinic and add to its independent cart', async () => {
    await page.goto(origin + '/clinic/cart');
    const exchange = page.waitForResponse(response => response.url().endsWith('/api/auth/handoff/exchange') && response.request().method() === 'POST');
    await page.getByRole('link', { name: 'Войти в кабинет клиники', exact: true }).click();
    assert.equal((await exchange).status(), 201);
    const buyer = page.getByRole('combobox', { name: 'Покупатель', exact: true });
    await expect(buyer).toBeEnabled();
    await buyer.click();
    await page.getByRole('option', { name: 'Проверочная клиника', exact: true }).click();
    await expect(page).toHaveURL(origin + '/catalog');
    await page.goto(`${origin}/products/${product.id}`);
    await page.getByRole('button', { name: 'В корзину', exact: true }).click();
    await page.getByRole('link', { name: 'Перейти в корзину', exact: true }).click();
    await expect(page).toHaveURL(origin + '/clinic/cart');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Подтверждаю покупку от организации: Проверочная клиника', exact: true })).toBeVisible();
    const organizationCart = await db.cart.findFirstOrThrow({ where: { buyerOrganizationId: clinic.organizationId }, include: { items: true } });
    assert.equal(organizationCart.items[0].offerId, offer.id);
    const personalCart = await db.personalCart.findUniqueOrThrow({ where: { ownerUserId: clinic.userId }, include: { items: true } });
    assert.notEqual(organizationCart.id, personalCart.id);
    assert.equal(personalCart.items[0].quantity.toString(), '1');
    await picture('clinic-cart-mobile');
    await page.goto(origin + '/personal/cart');
    await expect(quantity()).toHaveValue('1');
  });
  await step('unavailable removal and no inventory reservation', async () => {
    await db.supplierOffer.update({ where: { id: offer.id }, data: { status: 'INACTIVE' } });
    await page.reload(); await expect(page.getByText('Предложение сейчас недоступно', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Удалить: ${name}`, exact: true }).click();
    await expect(page.getByText('Корзина пока пуста', { exact: true })).toBeVisible();
    assert.equal(await db.inventoryReservation.count({ where: { inventoryBalanceId: balance.id } }), 0);
    assert.equal(await db.checkout.count({ where: { buyerOrganizationId: clinic.organizationId } }), 0);
  });
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'PASS', profile: 'go_live/test API, isolated production web', passed }, null, 2));
} catch (error) {
  if (page) await picture('failure').catch(() => {});
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'FAIL', phase, passed, message: String(error.message).slice(0, 2000) }, null, 2));
  throw new Error(`Personal cart browser failed at ${phase}: ${String(error.message).slice(0, 1500)}`);
} finally {
  await browser?.close();
  if (web?.exitCode === null) { const stopped = new Promise(resolve => web.once('exit', resolve)); web.kill(); await Promise.race([stopped, delay(3000)]); if (web.exitCode === null) web.kill('SIGKILL'); }
  try {
    if (ownedOfferId) await db.offerPublication.update({ where: { offerId: ownedOfferId }, data: { marketplaceVisible: false, status: 'HIDDEN' } });
  } finally { await fixture.stop(); }
}
