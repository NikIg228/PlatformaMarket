import { expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomInt, randomUUID, randomBytes } from 'node:crypto';
import { installPilotWorkspace } from './workspace-session';

import { passwordHash } from '../../api/src/modules/identity/password-codec';

export async function api(page: Page, key: string, path: string, method = 'GET', data?: unknown) {
  return page.evaluate(async ({ key, path, method, data }) => {
    const session = JSON.parse(sessionStorage.getItem(key)!);
    const response = await fetch('/api' + path, { method, headers: { authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { key, path, method, data });
}
export const sessionKey = (role: string) => role === 'operator' ? 'dentmarket_admin_session' : `dentmarket:${role === 'clinic' ? 'buyer' : 'supplier'}-session`;

export async function actors(browser: Browser, db: PrismaClient) {
  expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe('dentmarket_audit_20260914');
  const contexts = await Promise.all([1440, 390, 1440].map(width => browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })));
  const requests: { path: string; status: number }[] = [];
  for (const context of contexts) await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    // Only the API origin changes. The real server checks the original JWT,
    // active membership, permissions and tenant; no response is fabricated.
    const response = await route.fetch({ url: `http://127.0.0.1:4412${url.pathname}${url.search}` });
    requests.push({ path: url.pathname, status: response.status() });
    await route.fulfill({ response });
  });
  const [clinic, supplier, operator] = await Promise.all(contexts.map(context => context.newPage()));
  const rights = ['support.ticket.view', 'support.ticket.create', 'notification.view'];
  const buyer = await installPilotWorkspace(clinic, 'BUYER', rights);
  const seller = await installPilotWorkspace(supplier, 'SUPPLIER', rights);
  const unique = randomUUID();
  const org = await db.organization.create({ data: { bin: String(randomInt(100000000000, 999999999999)), legalName: 'Messages audit operator', displayName: 'Оператор аудита', capabilities: { create: { capability: 'MARKETPLACE_OPERATOR' } } } });
  const password = randomBytes(24).toString('base64url');
  const user = await db.user.create({ data: { email: `messages-audit-${unique}@example.invalid`, displayName: 'Оператор аудита', emailVerifiedAt: new Date(), passwordHash: passwordHash(password) } });
  const role = await db.role.create({ data: { organizationId: org.id, code: 'audit-operator', name: 'Оператор аудита', permissions: { create: [...rights, 'support.ticket.manage', 'organization.view', 'catalog.product.view'].map(code => ({ permission: { connect: { code } } })) } } });
  await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, status: 'ACTIVE', roles: { create: { roleId: role.id } } } });
  await operator.goto('http://127.0.0.1:3000/admin/login');
  await operator.getByLabel('Email оператора').fill(user.email); await operator.getByLabel('Пароль оператора').fill(password);
  await operator.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(operator).toHaveURL(/\/admin\/?$/);
  return { clinic, supplier, operator, buyer, seller, operatorOrg: org.id, requests,
    async close() { await Promise.all(contexts.map(context => context.close())); await buyer.dispose(); await seller.dispose();
      await db.authSession.updateMany({ where: { userId: user.id }, data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'messages_audit_finished' } }); }
  };
}
