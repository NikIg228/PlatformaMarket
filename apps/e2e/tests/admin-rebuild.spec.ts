import { test, expect } from '@playwright/test';
import { id } from './messages.fixture';

test('operator receives a newly escalated ticket without manually refreshing the queue', async ({ page }, info) => {
  await page.clock.install();
  const rows: object[] = [];
  let reads = 0;
  const unknown: string[] = [];
  await page.addInitScript(({ organizationId }) => sessionStorage.setItem('dentmarket_admin_session', JSON.stringify({ accessToken: 'synthetic-operator-ui-audit', sessionId: '10000000-0000-4000-8000-000000000001', user: {id: '20000000-0000-4000-8000-000000000001'}, expiresAt: Date.now() + 3600000, activeOrganizationId: organizationId, organizationId })), { organizationId: id(1) });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    let json: unknown;
    if (path === '/organizations') return route.fulfill({ json: [{ id: id(1), capabilities: [{ capability: 'MARKETPLACE_OPERATOR' }] }] });
    if (path.startsWith('/notifications/')) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: new Date().toISOString() } });
    if (path === '/support/tickets') { reads++; json = rows; }
    else if (path === '/operations/work-queue/assignees') json = [];
    else if (path === '/access-control/permissions') json = ['support.ticket.view', 'support.ticket.create', 'support.ticket.manage'];
    else { unknown.push(path); return route.fulfill({ status: 500, json: { message: 'Unexpected audit endpoint' } }); }
    await route.fulfill({ json });
  });
  await page.goto('/admin?section=support');
  await expect(page.getByText('Обращений нет', { exact: true })).toBeVisible();
  const before = reads;
  rows.push({ id: id(100), number: 'AUDIT-NEW-REQUEST', subject: 'Новая эскалация клиники', description: 'Просим помочь с поставкой', status: 'OPEN', priority: 'NORMAL', assigneeId: null, slaDueAt: null });
  await page.clock.fastForward(61000);
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
  await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(page.getByText(/AUDIT-NEW-REQUEST/)).toBeVisible();
  const automatic = { before, after: reads, ticketVisible: await page.getByText(/AUDIT-NEW-REQUEST/).count(), notificationControls: await page.getByRole('button', { name: /Уведомлен/ }).count() };
  await info.attach('operator-automatic-discovery', { body: JSON.stringify(automatic), contentType: 'application/json' });
  expect(automatic.after, 'The support queue should revalidate after a new request or focus').toBeGreaterThan(before);
  expect(automatic.ticketVisible, 'The operator should discover the new request without a manual refresh').toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/AUDIT-NEW-REQUEST/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('operator-manual-refresh.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText(/AUDIT-NEW-REQUEST/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeFocused();
  const computed = await page.getByRole('button', { name: 'Найти', exact: true }).evaluate(node => ({ height: node.getBoundingClientRect().height, font: getComputedStyle(node).fontFamily, radius: getComputedStyle(node).borderRadius }));
  expect(computed.height).toBeGreaterThanOrEqual(44); expect(computed.font).toContain('Manrope'); expect(computed.radius).toBe('8px');
  await info.attach('mobile-computed', { body: JSON.stringify(computed), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('operator-mobile-390.png'), fullPage: true, animations: 'disabled' });
  expect(unknown).toEqual([]);
});

test('operator ticket recovery initializes the saved status, priority and assignee', async ({ page }, info) => {
  let failDetail = true;
  const writes: unknown[] = [];
  const ticket = { id: id(201), number: 'AUDIT-RECOVERY', subject: 'Проверка восстановления', description: 'Сохранённое закрытое обращение', version: 8,
    status: 'CLOSED', priority: 'HIGH', assigneeId: id(2), slaDueAt: '2026-10-15T12:00:00.000Z', messages: [], links: [], hasOlder: false };
  await page.addInitScript(({ organizationId }) => sessionStorage.setItem('dentmarket_admin_session', JSON.stringify({ accessToken: 'synthetic-operator-ui-audit', activeOrganizationId: organizationId, organizationId })), { organizationId: id(1) });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    let json: unknown;
    if (path === '/organizations') return route.fulfill({ json: [{ id: id(1), capabilities: [{ capability: 'MARKETPLACE_OPERATOR' }] }] });
    if (path.startsWith('/notifications/')) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: new Date().toISOString() } });
    if (path === '/support/tickets') json = [ticket];
    else if (path === '/operations/work-queue/assignees') json = [{ id: id(2), displayName: 'Назначенный оператор' }];
    else if (path === '/access-control/permissions') json = ['support.ticket.view', 'support.ticket.create', 'support.ticket.manage'];
    else if (path.endsWith('/history')) json = [];
    else if (path === `/support/tickets/${ticket.id}`) {
      if (request.method() === 'PATCH') { writes.push(request.postDataJSON()); json = ticket; }
      else if (failDetail) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'Сбой первой загрузки' } });
      else json = ticket;
    } else return route.fulfill({ status: 500, json: { message: 'Unexpected audit endpoint' } });
    await route.fulfill({ json });
  });
  await page.goto('/admin?section=support');
  await page.getByRole('button', { name: 'Открыть обращение', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Повторить загрузку', exact: true })).toBeVisible();
  failDetail = false;
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /AUDIT-RECOVERY/ });
  const recovered = { status: await dialog.getByLabel('Статус', { exact: true }).inputValue(), priority: await dialog.getByLabel('Приоритет', { exact: true }).inputValue(), assignee: await dialog.getByLabel('Ответственный', { exact: true }).inputValue() };
  expect.soft(recovered.status).toBe('CLOSED'); expect.soft(recovered.priority).toBe('HIGH'); expect.soft(recovered.assignee).toBe(id(2));
  await expect(dialog.getByRole('button', { name: 'Повторить загрузку' })).toHaveCount(0);
  await dialog.getByLabel('Причина изменения', { exact: true }).fill('Уточняем внутреннюю историю обращения');
  await dialog.getByRole('button', { name: 'Сохранить решение', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  await info.attach('recovery-overwrite', { body: JSON.stringify({ stored: ticket, recovered, submitted: writes[0] }), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath('operator-recovery.png'), fullPage: true, animations: 'disabled' });
});

for (const width of [1440, 390]) test('operator password form and recovery ' + width, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/auth/operator/login', route => route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Email или пароль указаны неверно' } }));
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Вход в кабинет' })).toBeVisible();
  await expect(page.getByText(/Google|Apple|MFA|двухфактор/)).toHaveCount(0);
  await page.getByLabel('Email оператора').fill('invalid@example.invalid');
  await page.getByLabel('Пароль оператора').fill('synthetic-only');
  await page.getByRole('button', { name: 'Войти', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Вход не выполнен' })).toContainText('Email или пароль');
  await expect(page.getByLabel('Email оператора')).toHaveValue('invalid@example.invalid');
  await expect(page.getByLabel('Пароль оператора')).toHaveValue('synthetic-only');
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Показать пароль' }).click();
  await expect(page.getByLabel('Пароль оператора')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Скрыть пароль' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('Email оператора')).toHaveCSS('font-family', /Manrope/);
  await page.getByLabel('Пароль оператора').fill('');
  await page.screenshot({ path: info.outputPath('admin-login-' + width + '.png'), fullPage: true, animations: 'disabled' });
});
