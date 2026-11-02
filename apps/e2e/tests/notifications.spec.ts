import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`notification card replacement, expiry, recovery and field errors ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/ui-kit");
    await page.clock.install();
    const toast = page.locator(".dm-save-toast");
    await page.getByRole("button", { name: "Показать warning", exact: true }).click();
    await expect(toast).toHaveCount(1); await expect(toast).toHaveAttribute("role", "status");
    await expect(toast).toHaveCSS("background-color", "rgb(244, 197, 66)");
    await expect(toast).toHaveCSS("color", "rgb(23, 32, 30)");
    await page.getByRole("button", { name: "Показать error", exact: true }).click();
    await expect(toast).toHaveCount(1); await expect(toast).toHaveAttribute("role", "alert");
    await expect(toast).toContainText("Пример: error");
    await page.clock.fastForward(4500);
    await page.getByRole("button", { name: "Показать success", exact: true }).click();
    await page.clock.fastForward(1000); await expect(toast).toContainText("Пример: success");
    await page.clock.fastForward(4300); await expect(toast).toHaveCount(0);
    const input = page.getByRole("textbox", { name: "Черновик уведомления" });
    await input.fill("Сохранить мой ввод");
    await page.getByRole("button", { name: "Проверить восстановление", exact: true }).click();
    await expect(toast).toContainText("Действие не завершено");
    await page.clock.fastForward(5300); await expect(toast).toHaveCount(0);
    await expect(input).toHaveValue("Сохранить мой ввод");
    await page.getByRole("button", { name: "Повторить действие", exact: true }).click();
    await expect(toast).toContainText("Черновик сохранён");
    await toast.getByRole("button", { name: "Закрыть уведомление" }).focus();
    await page.keyboard.press("Enter"); await expect(toast).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Поле с ошибкой", exact: true })).toHaveAttribute("aria-invalid", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`cards-${width}.png`), fullPage: true });
  });

  test(`one persistent network card, verified recovery and dialog focus ${width}`, async ({ page, context }, info) => {
    let ready = false, probes = 0;
    await page.route("**/api/health/ready", route => { probes++; return route.fulfill({ status: ready ? 200 : 503, json: { status: ready ? "ready" : "unavailable" } }); });
    await page.setViewportSize({ width, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/ui-kit");
    const trigger = page.getByRole("button", { name: "Диалог уведомлений", exact: true });
    await trigger.click(); const dialog = page.getByRole("dialog");
    const notify = dialog.getByRole("button", { name: "Уведомление в диалоге", exact: true });
    await notify.click(); const toast = page.locator(".dm-save-toast");
    await expect(toast).toContainText("внутри диалога");
    await toast.getByRole("button", { name: "Закрыть уведомление" }).focus(); await page.keyboard.press("Enter");
    await expect(notify).toBeFocused();
    await page.clock.install(); await context.setOffline(true);
    await expect(toast).toHaveCount(1); await expect(toast).toContainText("Нет подключения к сети");
    await expect(page.locator(".dm-connection-status")).toHaveCount(0);
    await page.clock.runFor(6100); await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(toast).toHaveCount(1); await expect(toast).toContainText("Нет подключения к сети");
    await page.screenshot({ path: info.outputPath(`offline-dialog-${width}.png`), animations: "disabled" });
    await toast.getByRole("button", { name: "Закрыть уведомление" }).focus(); await page.keyboard.press("Enter");
    await expect(toast).toHaveCount(0); await expect(notify).toBeFocused();
    await context.setOffline(false); await expect.poll(() => probes).toBe(1);
    await expect(toast).toContainText("Сервис пока недоступен"); await expect(toast).toHaveCount(1);
    ready = true; await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(toast).toContainText("Связь восстановлена"); await expect(toast).toHaveCount(1);
    await expect(page.locator("[data-connection-notice]")).toHaveCount(0);
    await page.clock.runFor(5300); await expect(toast).toHaveCount(0);
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`auth error uses the shared solid card ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 }); await page.goto("/reset-password");
    const error = page.locator('.dm-feedback[data-tone="error"]');
    await expect(error).toContainText("Ссылка восстановления неполная");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveCSS("background-color", "rgb(163, 59, 53)");
    await expect(error).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.getByRole("button", { name: "Изменить пароль", exact: true })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Вернуться ко входу" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`auth-error-${width}.png`), fullPage: true });
  });
}
