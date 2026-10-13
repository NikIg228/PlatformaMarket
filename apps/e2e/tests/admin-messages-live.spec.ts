import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { actors, api, sessionKey } from '../fixtures/admin-messages';
const { NotificationsService } = require('../../api/dist/src/modules/notifications/notifications.service.js');

for (const initiator of ['clinic', 'supplier'] as const) test(`${initiator}: reciprocal chat, escalation, operator queue and public decision over real API`, async ({ browser }, info) => {
  const target = new URL(process.env.DATABASE_URL!); if (target.pathname !== '/dentmarket_audit_20260914' || !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Use the isolated audit DB');
  const db = new PrismaClient();
  const users = await actors(browser, db);
  const { clinic, supplier, operator, buyer, seller } = users;
  const requestor = users[initiator];
  const recipient = initiator === 'clinic' ? supplier : clinic;
  const marker = `AUDIT-${initiator}-${randomUUID().slice(0, 8)}`;
  try {
    let contextType: 'OFFER' | 'ORDER', contextId: string;
    if (initiator === 'clinic') {
      contextType = 'OFFER';
      contextId = (await db.supplierOffer.findFirstOrThrow({ where: { supplierOrganizationId: seller.organizationId, status: 'ACTIVE', publication: { status: 'PUBLISHED', marketplaceVisible: true }, conversations: { none: { buyerOrganizationId: buyer.organizationId } } } })).id;
    } else {
      contextType = 'ORDER';
      const cart = await db.cart.create({ data: { buyerOrganizationId: buyer.organizationId, status: 'CHECKED_OUT' } });
      const checkout = await db.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: buyer.organizationId, totalAmountMinor: '0', currency: 'KZT', idempotencyKey: marker, pricingSnapshot: {} } });
      contextId = (await db.supplierOrder.create({ data: { checkoutId: checkout.id, buyerOrganizationId: buyer.organizationId, supplierOrganizationId: seller.organizationId, orderNumber: marker, subtotalAmountMinor: '0', currency: 'KZT' } })).id;
    }
    await operator.goto('http://127.0.0.1:3000/admin?section=support');
    await expect(operator.getByRole('heading', { name: 'Обращения и споры', exact: true }).last()).toBeVisible();
    await operator.getByLabel('Порядок', { exact: true }).selectOption('recent');
    await recipient.goto(`http://127.0.0.1:3000/${initiator === 'clinic' ? 'supplier' : 'clinic'}/messages`);
    await requestor.goto(`http://127.0.0.1:3000/${initiator}/messages?contextType=${contextType}&contextId=${contextId}`);
    const chat = requestor.getByRole('region', { name: 'Сообщения', exact: true });
    await chat.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(`Первое сообщение ${marker}`);
    await chat.getByRole('button', { name: 'Отправить', exact: true }).click();
    await expect(chat.getByRole('list', { name: 'История сообщений' })).toContainText(`Первое сообщение ${marker}`);
    const conversation = await db.businessConversation.findFirstOrThrow({ where: { contextType, contextId, buyerOrganizationId: buyer.organizationId, supplierOrganizationId: seller.organizationId } });
    // The second organization sees the new chat through the real 30-second poll.
    const targetRow = recipient.locator('.dm-conversations-item').filter({ hasText: marker });
    await expect(targetRow).toBeVisible({ timeout: 40000 });
    await targetRow.click();
    const otherChat = recipient.getByRole('region', { name: 'Сообщения', exact: true });
    await expect(otherChat.getByRole('list', { name: 'История сообщений' })).toContainText(`Первое сообщение ${marker}`);
    await otherChat.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(`Ответ второй стороны ${marker}`);
    await otherChat.getByRole('button', { name: 'Отправить', exact: true }).click();
    await requestor.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(chat.getByRole('list', { name: 'История сообщений' })).toContainText(`Ответ второй стороны ${marker}`);
    await expect(chat.getByRole('listitem').filter({ hasText: `Первое сообщение ${marker}` })).toContainText('Прочитано представителем компании');
    const beforeOperator = await api(operator, sessionKey('operator'), `/conversations/${conversation.id}`);
    expect(beforeOperator.status).toBe(404);
    await chat.getByRole('button', { name: 'Действия с диалогом' }).click();
    await requestor.getByRole('menuitem', { name: 'Обратиться к оператору', exact: true }).click();
    const escalation = requestor.getByRole('dialog', { name: 'Обратиться к оператору', exact: true });
    await escalation.getByRole('textbox', { name: 'Причина обращения' }).fill(`Разобраться с поставкой ${marker}`);
    await escalation.getByRole('button', { name: 'Создать обращение', exact: true }).click();
    await expect(escalation).toBeHidden();
    await expect(chat.locator('.dm-conversation-status')).toContainText('Передано в поддержку');
    await recipient.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(otherChat.locator('.dm-conversation-status')).toContainText('Передано в поддержку');
    const updated = await db.businessConversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const ticketId = updated.supportTicketId!;
    const ticket = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.organizationId).toBe(initiator === 'clinic' ? buyer.organizationId : seller.organizationId);
    const denial = await api(requestor, sessionKey(initiator), `/conversations/${conversation.id}/resolve`, 'POST', { expectedVersion: updated.version });
    expect(denial.status).toBe(403);
    const event = await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: ticketId, eventType: 'SupportTicketCreated' } });
    const notifications = new NotificationsService(db, {}, {}, {});
    await notifications.projectOutboxEvent(event);
    expect(await notifications.projectOutboxEvent(event)).toBe(0);
    expect(await db.notification.count({ where: { aggregateId: ticketId, recipientOrganizationId: users.operatorOrg, eventType: 'SupportTicketCreated' } })).toBe(1);
    const queueEntry = operator.getByRole('row').filter({ hasText: ticket.number });
    await expect(queueEntry).toBeVisible({ timeout: 40_000 });
    await operator.getByLabel('Поиск обращения').fill(ticket.number); await operator.getByRole('button', { name: 'Найти', exact: true }).click();
    await expect(queueEntry).toBeVisible();
    await expect(operator.getByRole('button', { name: 'Уведомления поддержки: 1 непрочитанных', exact: true })).toBeVisible({ timeout: 40_000 });
    await operator.screenshot({ path: info.outputPath('operator-queue-' + initiator + '.png'), fullPage: true, animations: 'disabled' });
    await operator.getByRole('button', { name: 'Уведомления поддержки: 1 непрочитанных', exact: true }).click();
    await operator.getByRole('dialog', { name: 'Уведомления поддержки', exact: true }).getByRole('button', { name: 'Открыть обращение', exact: true }).click();
    const panel = operator.getByRole('dialog', { name: new RegExp(ticket.number) });
    await expect(panel).toContainText(`Разобраться с поставкой ${marker}`);
    await panel.getByRole('textbox', { name: 'Ответ', exact: true }).fill(`Внутренняя заметка ${marker}`);
    await panel.getByRole('checkbox', { name: 'Внутренняя заметка' }).check();
    await panel.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Ответ', exact: true })).toHaveValue('');
    await panel.getByRole('button', { name: 'Открыть связанный диалог', exact: true }).click();
    const operatorChat = operator.getByRole('region', { name: 'Сообщения', exact: true });
    await expect(operatorChat.getByRole('list', { name: 'История сообщений' })).toContainText(`Первое сообщение ${marker}`);
    await expect(operatorChat.getByRole('list', { name: 'История сообщений' })).toContainText(`Ответ второй стороны ${marker}`);
    await operatorChat.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(`Уточнение оператора ${marker}`);
    await operatorChat.getByRole('button', { name: 'Отправить', exact: true }).click();
    await expect(operatorChat.locator('.dm-conversation-status')).toContainText('На рассмотрении');
    await operator.screenshot({ path: info.outputPath(`operator-chat-${initiator}.png`), fullPage: true, animations: 'disabled' });
    await operatorChat.getByRole('button', { name: 'Действия с диалогом' }).click();
    await operator.getByRole('menuitem', { name: 'Завершить рассмотрение' }).click();
    const decision = operator.getByRole('dialog', { name: 'Решение оператора', exact: true });
    await decision.getByRole('textbox', { name: 'Решение для участников' }).fill(`Подтверждена замена ${marker}`);
    await decision.getByRole('button', { name: 'Опубликовать решение', exact: true }).click();
    await expect(decision).toBeHidden();
    for (const page of [clinic, supplier]) {
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      const partyChat = page.getByRole('region', { name: 'Сообщения', exact: true });
      await expect(partyChat.locator('.dm-conversation-status')).toContainText('Вопрос решён');
      await expect(partyChat.getByRole('list', { name: 'История сообщений' })).toContainText(`Решение оператора: Подтверждена замена ${marker}`);
      await expect(partyChat.getByText(`Внутренняя заметка ${marker}`, { exact: true })).toHaveCount(0);
    }
    await info.attach('real-http-summary', { body: JSON.stringify({ initiator, contextType, conversationId: conversation.id, ticketId, requests: users.requests.length, operatorNotificationCount: 1 }), contentType: 'application/json' });
  } finally { await users.close(); await db.$disconnect(); }
});
