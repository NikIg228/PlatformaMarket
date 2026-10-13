import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { startLocalAuthFixture } from './lib/local-auth-fixture.mjs';
import { assertPortsAvailable } from './lib/local-readiness.mjs';

// Built canonical source; separate generated artifacts, synthetic accounts and DB.
// Tokens/passwords stay in memory. Screenshots mask fields; no trace/HAR is made.
const root = path.resolve(import.meta.dirname, '..');
const origin = 'http://127.0.0.1:3103';
const adapter = path.resolve(root, '.tmp/auth-navigation-2026-10-14/next-adapter.mjs');
const identityOnly = process.argv.includes('--identity');
const lifecycleOnly = process.argv.includes('--lifecycle');
const output = path.resolve(root, `output/playwright/auth-navigation-2026-10-14${identityOnly ? '-identity' : lifecycleOnly ? '-lifecycle' : ''}`);
await assertPortsAvailable([3103, 4113]);
await mkdir(output, { recursive: true });
const fixture = await startLocalAuthFixture({ operator: false, apiPort: 4113, webApps: ['landing'], publicCatalog: true });
let web, browser, currentPage, scenario = 'startup';
const results = [];
const key = role => `dentmarket:${role === 'clinic' ? 'buyer' : 'supplier'}-session`;
const stored = (page, role) => page.evaluate(k => JSON.parse(sessionStorage.getItem(k) ?? 'null'), key(role));
async function picture(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('input')] });
}
async function step(name, work) {
  scenario = name; await work(); results.push(name); console.log(`PASS ${name}`);
}
async function pageFor(context, width = 1440) {
  const page = await context.newPage(); await page.setViewportSize({ width, height: 900 });
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000); currentPage = page; return page;
}
async function login(page, account, destination) {
  await page.goto(`${origin}/login?signedOut=1&returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Рабочий email').fill(account.email);
  await page.getByLabel('Пароль', { exact: false }).and(page.locator('input')).fill(account.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}
async function logout(page) {
  await page.getByRole('button', { name: 'Меню профиля', exact: true }).click();
  const action = page.getByRole('menuitem', { name: 'Выйти', exact: true });
  await action.focus(); await action.press('Enter');
}
async function operatorLogin(page, account, destination = '/admin?section=settings') {
  await page.goto(`${origin}/admin/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email оператора').fill(account.email);
  await page.getByLabel('Пароль оператора').fill(account.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(origin + destination);
}
try {
  web = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', 'apps/web', '--hostname', '127.0.0.1', '--port', '3103'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', DEPLOYMENT_PROFILE: 'pilot', NEXT_PUBLIC_DEPLOYMENT_PROFILE: 'pilot', NEXT_ADAPTER_PATH: adapter, INTERNAL_API_URL: fixture.apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
  });
  web.stdout.resume(); web.stderr.resume();
  const deadline = Date.now() + 60000; let ready = false;
  while (Date.now() < deadline) {
    if (web.exitCode !== null) throw Error('Owned frontend exited during startup');
    try { ready = (await fetch(origin + '/login', { signal: AbortSignal.timeout(3000) })).ok; } catch {}
    if (ready) break; await delay(300);
  }
  assert.ok(ready, 'Owned frontend readiness deadline');
  browser = await chromium.launch({ headless: true });
  const buyer = await fixture.account(21, 'BUYER'), supplier = await fixture.account(22, 'SUPPLIER'), operator = await fixture.account(23, 'MARKETPLACE_OPERATOR');

  if (!identityOnly && !lifecycleOnly) {
  for (const [person, destination, width] of [[buyer, '/supplier/settings', 1440], [supplier, '/clinic/settings', 390]]) {
    await step(`incompatible-role-${width}`, async () => {
      const context = await browser.newContext(); const page = await pageFor(context, width);
      await login(page, person, destination);
      await expect(page.getByRole('region', { name: 'Выберите кабинет' }).getByRole('alert')).toContainText('Нет доступа к запрошенному кабинету');
      await expect(page).toHaveURL(/\/login\?/);
      const control = page.getByRole('button', { name: 'Войти другим аккаунтом' });
      const styles = await control.evaluate(element => { const s = getComputedStyle(element); return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, height: element.getBoundingClientRect().height, radius: s.borderRadius }; });
      assert.equal(styles.height, 44); assert.equal(styles.size, '14px'); assert.equal(styles.radius, '8px');
      await writeFile(path.join(output, `controls-${width}.json`), JSON.stringify(styles, null, 2));
      await control.focus(); await picture(page, `incompatible-role-${width}`); await control.press('Enter');
      await expect(page.getByLabel('Рабочий email')).toBeVisible();
      await expect(page.getByText('Нет доступа к запрошенному кабинету', { exact: true })).toHaveCount(0);
      await context.close();
    });
  }

  for (const [role, person, width] of [['clinic', buyer, 1440], ['supplier', supplier, 390]]) {
    await step(`${role}-logout-recovery-and-sibling-${width}`, async () => {
      const context = await browser.newContext(); const page = await pageFor(context, width);
      await login(page, person, `/${role}/settings`);
      await expect(page).toHaveURL(origin + `/${role}/settings`);
      await expect(page.getByRole('button', { name: 'Меню профиля', exact: true })).toBeVisible();
      const selected = await stored(page, role); assert.ok(selected?.sessionId);
      const rootSession = await fixture.db.authSession.findUniqueOrThrow({ where: { id: selected.sessionId } });
      const popup = page.waitForEvent('popup');
      await page.evaluate(url => { window.open(url, '_blank'); }, origin + `/${role}/settings`);
      const sibling = await popup; sibling.setDefaultTimeout(15000);
      await expect(sibling.getByRole('button', { name: 'Меню профиля', exact: true })).toBeVisible();
      assert.equal((await stored(sibling, role)).sessionId, selected.sessionId);
      let mode = 'network', calls = 0;
      await page.route('**/api/auth/session-logout', async route => {
        calls += 1;
        if (mode === 'network') return route.abort('failed');
        if (mode === 'server') return route.fulfill({ status: 503, json: { message: 'synthetic failure' } });
        if (mode === 'lost') { await route.fetch(); return route.abort('failed'); }
        return route.continue();
      });
      await logout(page);
      await expect(page.getByRole('alert').filter({ hasText: 'Выход не подтверждён' })).toBeVisible();
      assert.equal((await stored(page, role)).sessionId, selected.sessionId);
      mode = 'server'; await logout(page);
      await expect(page.getByRole('alert').filter({ hasText: 'Сервер не подтвердил выход' })).toBeVisible();
      mode = 'lost'; await logout(page);
      await expect(page.getByRole('alert').filter({ hasText: 'Выход не подтверждён' })).toBeVisible();
      assert.equal((await fixture.db.authSession.findUniqueOrThrow({ where: { id: selected.sessionId } })).status, 'REVOKED');
      await picture(page, `${role}-lost-response`);
      mode = 'success'; await logout(page);
      await expect(page).toHaveURL(/\/login\?signedOut=1$/);
      await expect(sibling).toHaveURL(/\/login\?signedOut=1$/);
      await expect(page.getByLabel('Рабочий email')).toBeVisible();
      assert.equal(calls, 4); assert.equal(await stored(page, role), null);
      assert.equal((await fixture.db.authSession.findUniqueOrThrow({ where: { id: rootSession.originLoginSessionId } })).status, 'REVOKED');
      await fixture.request('/auth/workspace-context', undefined, 401, selected.accessToken);
      await page.goto(origin + '/login'); await expect(page.getByLabel('Рабочий email')).toBeVisible();
      await page.goto(origin + `/${role}/settings`);
      await expect(page.getByRole('button', { name: 'Меню профиля', exact: true })).toHaveCount(0);
      await picture(page, `${role}-revoked-direct-entry`);
      await context.close();
    });
  }

  await step('admin-safe-return-and-exact-logout', async () => {
    const context = await browser.newContext(); const page = await pageFor(context);
    await operatorLogin(page, operator);
    const selected = await page.evaluate(() => JSON.parse(sessionStorage.getItem('dentmarket_admin_session')));
    const another = await pageFor(context, 390); await operatorLogin(another, operator);
    const newer = await another.evaluate(() => JSON.parse(sessionStorage.getItem('dentmarket_admin_session')));
    assert.notEqual(selected.sessionId, newer.sessionId);
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await expect(page).toHaveURL(origin + '/admin/login');
    await fixture.request('/organizations', undefined, 401, selected.accessToken);
    await fixture.request('/organizations', undefined, 200, newer.accessToken);
    assert.equal((await another.evaluate(() => JSON.parse(sessionStorage.getItem('dentmarket_admin_session')))).sessionId, newer.sessionId);
    await picture(page, 'admin-after-logout'); await context.close();
  });
  }
  if (identityOnly) {
    await step('workspace-refresh-refuses-another-identity', async () => {
      const secondBuyer = await fixture.account(24, 'BUYER');
      const context = await browser.newContext(); const page = await pageFor(context);
      await login(page, buyer, '/clinic/settings'); await expect(page).toHaveURL(origin + '/clinic/settings');
      const selected = await stored(page, 'clinic');
      const other = await pageFor(context); await login(other, secondBuyer, '/clinic/settings'); await expect(other).toHaveURL(origin + '/clinic/settings');
      const newer = await stored(other, 'clinic');
      assert.notEqual(selected.sessionId, newer.sessionId);
      await page.evaluate(k => { const session = JSON.parse(sessionStorage.getItem(k)); session.accessTokenExpiresAt = Date.now() - 60000; sessionStorage.setItem(k, JSON.stringify(session)); }, key('clinic'));
      await page.reload();
      await expect(page.getByRole('button', { name: 'Меню профиля', exact: true })).toHaveCount(0);
      await expect.poll(() => stored(page, 'clinic')).toBeNull();
      assert.equal((await stored(other, 'clinic')).sessionId, newer.sessionId);
      await fixture.request('/auth/workspace-context', undefined, 200, newer.accessToken);
      await picture(page, 'workspace-identity-denied');
      await context.close();
    });
    await step('admin-refresh-refuses-new-login-and-retains-return', async () => {
      const context = await browser.newContext(); const page = await pageFor(context, 390);
      await operatorLogin(page, operator);
      const other = await pageFor(context); await operatorLogin(other, operator);
      const newer = await other.evaluate(() => JSON.parse(sessionStorage.getItem('dentmarket_admin_session')));
      await page.evaluate(() => { const k = 'dentmarket_admin_session'; const session = JSON.parse(sessionStorage.getItem(k)); session.expiresAt = Date.now() - 60000; sessionStorage.setItem(k, JSON.stringify(session)); });
      await page.reload();
      await expect(page).toHaveURL(/\/admin\/login\?returnTo=%2Fadmin%3Fsection%3Dsettings&notice=session-changed$/);
      await expect(page.getByRole('alert').filter({ hasText: 'Аккаунт изменён в другой вкладке' })).toBeVisible();
      assert.equal((await other.evaluate(() => JSON.parse(sessionStorage.getItem('dentmarket_admin_session')))).sessionId, newer.sessionId);
      await picture(page, 'admin-identity-denied-mobile'); await context.close();
    });
    await step('multiple-capabilities-and-organizations-require-selection', async () => {
      const multi = await fixture.account(25, 'BUYER');
      await fixture.db.organizationCapability.create({ data: { organizationId: multi.organizationId, capability: 'SUPPLIER' } });
      const otherOrganization = await fixture.account(26, 'BUYER');
      const role = await fixture.db.role.findFirstOrThrow({ where: { organizationId: otherOrganization.organizationId, code: 'audit_local_auth' } });
      await fixture.db.organizationMembership.create({ data: { userId: multi.userId, organizationId: otherOrganization.organizationId, status: 'ACTIVE', acceptedAt: new Date(), roles: { create: { roleId: role.id } } } });
      const context = await browser.newContext(); const page = await pageFor(context);
      await login(page, multi, '/clinic/settings');
      const choices = page.getByLabel('Организация и кабинет'); await expect(choices).toBeVisible();
      await expect(choices.locator('option')).toHaveCount(2);
      await choices.selectOption('1'); await picture(page, 'organization-choice');
      await page.getByRole('button', { name: 'Открыть выбранную организацию' }).click();
      await expect(page).toHaveURL(origin + '/clinic/settings');
      const selected = await stored(page, 'clinic');
      assert.ok([multi.organizationId, otherOrganization.organizationId].includes(selected.organizationId));
      await context.close();
    });
  }
  if (lifecycleOnly) {
    await step('expired-access-refresh-then-logout-pending-and-back', async () => {
      const context = await browser.newContext(); const page = await pageFor(context, 390);
      await login(page, buyer, '/clinic/settings'); await expect(page).toHaveURL(origin + '/clinic/settings');
      const selected = await stored(page, 'clinic');
      const expiredToken = await fixture.sessionProof(selected.sessionId, { expired: true });
      await page.evaluate(({ k, token }) => { const session = JSON.parse(sessionStorage.getItem(k)); session.accessToken = token; session.accessTokenExpiresAt = Date.now() - 60000; sessionStorage.setItem(k, JSON.stringify(session)); }, { k: key('clinic'), token: expiredToken });
      let refreshes = 0;
      page.on('request', request => { if (request.url().endsWith('/auth/refresh')) refreshes += 1; });
      await page.reload(); await expect(page.getByRole('button', { name: 'Меню профиля', exact: true })).toBeVisible();
      assert.equal(refreshes, 1); assert.equal((await stored(page, 'clinic')).sessionId, selected.sessionId);
      let release; let calls = 0;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/auth/session-logout', async route => { calls += 1; await gate; await route.continue(); });
      await logout(page);
      await page.getByRole('button', { name: 'Меню профиля', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'Выходим…', exact: true })).toBeDisabled();
      assert.equal(calls, 1); await picture(page, 'logout-pending-mobile'); release();
      await expect(page).toHaveURL(/\/login\?signedOut=1$/);
      await page.goBack();
      await expect(page.getByRole('button', { name: 'Меню профиля', exact: true })).toHaveCount(0);
      await fixture.request('/auth/workspace-context', undefined, 401, selected.accessToken);
      await context.close();
    });
    await step('membership-revocation-blocks-workspace-after-refresh', async () => {
      const context = await browser.newContext(); const page = await pageFor(context);
      await login(page, supplier, '/supplier/settings'); await expect(page).toHaveURL(origin + '/supplier/settings');
      const selected = await stored(page, 'supplier');
      await fixture.db.organizationMembership.updateMany({ where: { userId: supplier.userId, organizationId: supplier.organizationId }, data: { status: 'REVOKED' } });
      await page.reload();
      await expect(page.getByRole('button', { name: 'Меню профиля', exact: true })).toHaveCount(0);
      await expect.poll(() => stored(page, 'supplier')).toBeNull();
      const denied = await fetch(fixture.apiUrl + '/auth/workspace-context', { headers: { authorization: `Bearer ${selected.accessToken}` } });
      assert.ok([401, 403].includes(denied.status), 'Removed membership must deny access');
      await picture(page, 'membership-revoked'); await context.close();
    });
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'PASS', scenarios: results, database: 'dentmarket_audit_20260914' }, null, 2));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await picture(currentPage, 'failure-masked').catch(() => undefined);
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'FAIL', scenario, passed: results, error: String(error.message).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[JWT]') }, null, 2));
  console.error(`FAIL ${scenario}; inspect masked screenshot and result.json`); process.exitCode = 1;
} finally {
  await browser?.close();
  if (web && web.exitCode === null) {
    const exited = new Promise(resolve => web.once('exit', resolve)); web.kill(); await Promise.race([exited, delay(5000)]);
    if (web.exitCode === null) web.kill('SIGKILL');
  }
  await fixture.stop();
}
