import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { installPilotWorkspace, workspaceFixture } from "../fixtures/workspace-session";

async function cleanupConversationFiles(db: PrismaClient, actorId: string) {
  const storageRoot = resolve(process.env.LOCAL_STORAGE_PATH ?? resolve(__dirname, "../../api/.local-storage"));
  const files = await db.uploadAsset.findMany({ where: { uploadedById: actorId, purpose: "conversation", deletedAt: null } });
  for (const file of files) {
    const path = resolve(storageRoot, file.storageKey);
    if (!path.startsWith(storageRoot + sep)) throw new Error("Synthetic attachment cleanup escaped storage");
    await unlink(path).catch(error => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; });
    await db.uploadAsset.update({ where: { id: file.id }, data: { status: "REJECTED", deletedAt: new Date(), rejectionReason: "Synthetic browser fixture finished" } });
  }
}

test.use({ trace: "off", screenshot: "off" });
test("CORE06: buyer, mobile supplier and operator conversation workflow", async ({ page, browser }) => {
  const db = new PrismaClient();
  const supplierContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const operatorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const supplierPage = await supplierContext.newPage(), operatorPage = await operatorContext.newPage();
  for (const surface of [page, supplierPage, operatorPage]) surface.setDefaultTimeout(15_000);
  const rights = ["support.ticket.view", "support.ticket.create", "notification.view"];
  const buyer = await installPilotWorkspace(page, "BUYER", rights);
  const supplier = await installPilotWorkspace(supplierPage, "SUPPLIER", rights);
  const key = randomUUID();
  let operatorId: string | undefined;
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const offer = await db.supplierOffer.findFirstOrThrow({ where: { supplierOrganizationId: supplier.organizationId, status: "ACTIVE", publication: { status: "PUBLISHED", marketplaceVisible: true }, conversations: { none: { buyerOrganizationId: buyer.organizationId } } } });
    const org = await db.organization.create({ data: { bin: `95${String(Date.now()).slice(-10)}`, legalName: `Core06 ${key}`, displayName: "Synthetic operator", capabilities: { create: { capability: "MARKETPLACE_OPERATOR" } } } });
    const user = await db.user.create({ data: { email: `core06-${key}@example.invalid`, displayName: "Synthetic operator", emailVerifiedAt: new Date() } }); operatorId = user.id;
    const role = await db.role.create({ data: { organizationId: org.id, code: "operator", name: "Оператор", permissions: { create: [...rights, "support.ticket.manage", "organization.view", "catalog.product.view"].map(code => ({ permission: { connect: { code } } })) } } });
    await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
    const session = await workspaceFixture(db, "MARKETPLACE_OPERATOR", { userId: user.id, organizationId: org.id, displayName: org.displayName });
    await operatorPage.addInitScript(({ session, actorId }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ ...session, actorId, user: { id: actorId }, activeOrganizationId: session.organizationId })), { session, actorId: user.id });
    await page.goto(`/clinic/messages?contextType=OFFER&contextId=${offer.id}`);
    const chat = page.getByRole("region", { name: "Сообщения", exact: true });
    await expect(chat.locator(".dm-conversation-context")).toContainText(supplier.displayName);
    await chat.getByLabel("Файлы сообщения").setInputFiles({ name: "Комплектация.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nSynthetic attachment") });
    await expect(chat.getByRole("button", { name: "Убрать Комплектация.pdf" })).toBeEnabled();
    await chat.getByLabel("Сообщение", { exact: true }).fill(`Вопрос покупателя ${key}`);
    await chat.getByRole("button", { name: "Отправить", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(chat.getByRole("list", { name: "История сообщений" }).getByText(`Вопрос покупателя ${key}`)).toBeVisible();
    const conversation = await db.businessConversation.findFirstOrThrow({ where: { contextId: offer.id, buyerOrganizationId: buyer.organizationId, supplierOrganizationId: supplier.organizationId } });
    await supplierPage.goto(`/supplier/messages?conversationId=${conversation.id}`);
    const supplierChat = supplierPage.getByRole("region", { name: "Сообщения", exact: true });
    await expect(supplierChat.getByText(`Вопрос покупателя ${key}`, { exact: true }).last()).toBeVisible();
    const fileResponse = supplierPage.waitForResponse(response => response.url().includes("/attachments/") && response.request().method() === "GET");
    const fileDownload = supplierPage.waitForEvent("download");
    await supplierChat.getByRole("button", { name: "Скачать Комплектация.pdf" }).click();
    const downloaded = await fileResponse;
    expect(downloaded.status()).toBe(200); expect(downloaded.headers()["cache-control"]).toBe("private, no-store");
    const savedDownload = await fileDownload;
    expect(await savedDownload.failure()).toBeNull();
    expect((await readFile((await savedDownload.path())!)).toString()).toBe("%PDF-1.7\nSynthetic attachment");
    await supplierChat.getByLabel("Сообщение", { exact: true }).fill(`Ответ поставщика ${key}`);
    let failSend = true;
    await supplierPage.route(`**/conversations/${conversation.id}/messages`, async route => { if (failSend) { failSend = false; await route.abort("failed"); } else await route.continue(); });
    await supplierChat.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(supplierPage.locator('.dm-save-toast').filter({ hasText: "Результат пока неизвестен" })).toContainText("Текст и файлы сохранены");
    await expect(supplierChat.getByLabel("Сообщение", { exact: true })).toHaveValue(`Ответ поставщика ${key}`);
    await supplierChat.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(supplierChat.getByRole("list", { name: "История сообщений" }).getByText(`Ответ поставщика ${key}`)).toBeVisible();
    expect(await db.conversationMessage.count({ where: { conversationId: conversation.id, body: `Ответ поставщика ${key}` } })).toBe(1);
    await supplierPage.screenshot({ path: test.info().outputPath("conversation-supplier-390.png"), fullPage: true });
    expect(await supplierPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(chat.getByRole("list", { name: "История сообщений" }).getByText(`Ответ поставщика ${key}`)).toBeVisible();
    await chat.getByRole("button", { name: "Действия с диалогом" }).click();
    await page.getByRole("menuitem", { name: "Вопрос решён", exact: true }).click();
    await expect(chat.locator(".dm-conversation-status")).toContainText("Вопрос решён");
    await chat.getByRole("button", { name: "Действия с диалогом" }).click();
    await page.getByRole("menuitem", { name: "Обратиться к оператору" }).click();
    const escalationDialog = page.getByRole("dialog", { name: "Обратиться к оператору", exact: true });
    await escalationDialog.getByRole("textbox", { name: "Причина обращения" }).fill(`Нужна помощь оператора ${key}`);
    await escalationDialog.getByRole("button", { name: "Создать обращение" }).click();
    await expect(escalationDialog).toBeHidden();
    await expect(chat.locator(".dm-conversation-status")).toContainText("Передано в поддержку");
    await operatorPage.goto("/admin?section=overview");
    const queue = operatorPage.getByRole("region", { name: "Операционная очередь" });
    const assignmentOpener = queue.getByRole("button", { name: "Назначение и история" }).first();
    await assignmentOpener.focus(); await operatorPage.keyboard.press("Enter");
    await expect(operatorPage.getByRole("dialog")).toBeVisible();
    await operatorPage.keyboard.press("Escape");
    await expect(operatorPage.getByRole("dialog")).toBeHidden();
    await expect(assignmentOpener).toBeFocused();
    await operatorPage.goto("/admin?section=support");
    const support = operatorPage.getByRole("region", { name: "Обращения и диалоги" });
    await expect(support).toBeVisible();
    const updated = await db.businessConversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const ticket = await db.supportTicket.findUniqueOrThrow({ where: { id: updated.supportTicketId! } });
    const opener = support.getByRole("row").filter({ hasText: ticket.number }).getByRole("button", { name: "Открыть обращение" });
    await opener.focus(); await operatorPage.keyboard.press("Enter");
    const dialog = operatorPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await operatorPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await operatorPage.keyboard.press("Enter");
    await dialog.getByLabel("Ответственный", { exact: true }).selectOption(user.id);
    await dialog.getByLabel("Причина изменения").fill("Назначение ответственного по обращению");
    await dialog.getByRole("button", { name: "Сохранить решение" }).click();
    await expect(operatorPage.locator('.dm-save-toast[role="status"]')).toContainText("Изменение обращения сохранено.");
    await dialog.getByRole("button", { name: "Открыть связанный диалог" }).click();
    await expect(support).toBeFocused();
    const operatorChat = operatorPage.getByRole("region", { name: "Сообщения", exact: true });
    await expect(operatorChat.getByRole("button", { name: "Скачать Комплектация.pdf" })).toBeVisible();
    await operatorChat.getByLabel("Сообщение", { exact: true }).fill(`Ответ оператора ${key}`);
    await operatorChat.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(operatorChat.getByRole("list", { name: "История сообщений" }).getByText(`Ответ оператора ${key}`)).toBeVisible();
    await expect(operatorChat.locator(".dm-conversation-status")).toContainText("На рассмотрении");
    await operatorPage.screenshot({ path: test.info().outputPath("conversation-operator-1440.png"), fullPage: true });
    await page.reload();
    await expect(chat.getByRole("listitem").filter({ hasText: `Ответ оператора ${key}` }).getByText("Synthetic operator · Оператор площадки")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("conversation-buyer-1440.png"), fullPage: true });
    await operatorChat.getByRole("button", { name: "Действия с диалогом" }).click();
    await operatorPage.getByRole("menuitem", { name: "Завершить рассмотрение" }).click();
    const resolution = operatorPage.getByRole("dialog", { name: "Решение оператора", exact: true });
    await expect(resolution.getByRole("button", { name: "Опубликовать решение" })).toBeDisabled();
    await resolution.getByRole("textbox", { name: "Решение для участников" }).fill(`Подтверждена замена ${key}`);
    await operatorPage.screenshot({ path: test.info().outputPath("conversation-decision-1440.png"), fullPage: true, animations: "disabled" });
    const styles = await resolution.evaluate(surface => {
      const input = surface.querySelector("textarea")!, button = Array.from(surface.querySelectorAll("button")).find(item => item.textContent?.includes("Опубликовать решение"))!;
      return { dialogRadius: getComputedStyle(surface).borderRadius, dialogWidth: surface.getBoundingClientRect().width,
        font: getComputedStyle(input).fontFamily, buttonRadius: getComputedStyle(button).borderRadius, buttonHeight: button.getBoundingClientRect().height, background: getComputedStyle(surface).backgroundColor };
    });
    await test.info().attach("operator-dialog-computed-styles", { body: JSON.stringify(styles), contentType: "application/json" });
    expect(styles.font).toContain("Manrope"); expect(styles.buttonHeight).toBeGreaterThanOrEqual(44); expect(styles.buttonRadius).toBe("8px");
    await resolution.getByRole("button", { name: "Опубликовать решение" }).click();
    await expect(resolution).toBeHidden();
    await expect(operatorChat.locator(".dm-conversation-status")).toContainText("Вопрос решён");
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe("RESOLVED");
    for (const target of [page, supplierPage]) {
      await target.reload();
      const partyChat = target.getByRole("region", { name: "Сообщения", exact: true });
      await expect(partyChat.locator(".dm-conversation-status")).toContainText("Вопрос решён");
      await expect(partyChat.getByRole("list", { name: "История сообщений" })).toContainText(`Решение оператора: Подтверждена замена ${key}`);
    }
    await supplierChat.getByRole("button", { name: "Действия с диалогом" }).click();
    await supplierPage.getByRole("menuitem", { name: "Повторно обратиться к оператору" }).click();
    const reopenDialog = supplierPage.getByRole("dialog", { name: "Обратиться к оператору", exact: true });
    await reopenDialog.getByRole("textbox", { name: "Причина обращения" }).fill(`Нужна повторная проверка ${key}`);
    await reopenDialog.getByRole("button", { name: "Создать обращение" }).click();
    await expect(supplierChat.locator(".dm-conversation-status")).toContainText("Передано в поддержку");
    await operatorPage.goto("/admin?section=support");
    await opener.click();
    await dialog.getByLabel("Статус", { exact: true }).selectOption("CLOSED");
    await dialog.getByLabel("Причина изменения", { exact: true }).fill(`Private rationale ${key}`);
    await expect(dialog.getByRole("button", { name: "Сохранить решение" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Решение для участников" }).fill(`Повторная проверка завершена ${key}`);
    await dialog.getByRole("button", { name: "Сохранить решение" }).click();
    await expect(operatorPage.locator('.dm-save-toast[role="status"]')).toContainText("Изменение обращения сохранено.");
    for (const target of [page, supplierPage]) {
      await target.reload();
      const partyChat = target.getByRole("region", { name: "Сообщения", exact: true });
      await expect(partyChat.locator(".dm-conversation-status")).toContainText("Вопрос решён");
      await expect(partyChat.getByRole("list", { name: "История сообщений" })).toContainText(`Решение оператора: Повторная проверка завершена ${key}`);
      await expect(partyChat.getByText(`Private rationale ${key}`, { exact: true })).toHaveCount(0);
    }
    // The supported create route is stable both for an empty inbox and for
    // an organization that already has tickets from other isolated fixtures.
    await supplierPage.goto("/supplier/support?mode=new");
    const compose = supplierPage.getByRole("region", { name: "Новое обращение", exact: true });
    await compose.getByRole("textbox", { name: /^Тема(?:\s*\*)?$/ }).fill(`Обращение ${key}`);
    await compose.getByRole("textbox", { name: /^Описание(?:\s*\*)?$/ }).fill("Проверка создания обращения поставщиком");
    await compose.getByRole("button", { name: "Отправить обращение", exact: true }).click();
    await expect(supplierPage.locator('.dm-save-toast[role="status"]')).toContainText("Обращение отправлено");
    expect(await db.supportTicket.count({ where: { organizationId: supplier.organizationId, subject: `Обращение ${key}` } })).toBe(1);
    expect(await supplierPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } catch (error) {
    console.log("CORE06 operator accessibility", await operatorPage.evaluate(() => {
      const panel = document.querySelector('section[aria-label="Сообщения"]');
      const textarea = panel?.querySelector("textarea");
      const hiddenAncestors: string[] = [];
      for (let node = textarea as Element | null; node; node = node.parentElement) if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("inert")) hiddenAncestors.push(node.tagName);
      return { panelPresent: Boolean(panel), inputPresent: Boolean(textarea), inputId: textarea?.id, labels: Array.from(panel?.querySelectorAll("label") ?? []).map(label => ({ text: label.textContent, for: label.htmlFor })), hiddenAncestors };
    }).catch(() => null));
    await operatorPage.screenshot({ path: test.info().outputPath("operator-failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled([page.goto("about:blank"), supplierContext.close(), operatorContext.close()]);
    await buyer.dispose(); await supplier.dispose();
    if (operatorId) await db.authSession.updateMany({ where: { userId: operatorId }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "core06_browser_finished" } });
    await cleanupConversationFiles(db, buyer.userId);
    await db.$disconnect();
  }
});
