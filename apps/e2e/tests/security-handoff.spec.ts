import { expect, test } from "@playwright/test";
import { installPilotWorkspace } from "../fixtures/workspace-session";

test.use({ trace: "off", screenshot: "off" });
for (const capability of ["BUYER", "SUPPLIER"] as const) {
  test(`${capability}: browser-bound handoff denies a foreign browser and preserves normal exchange`, async ({ page, browser, baseURL }) => {
    const fixture = await installPilotWorkspace(page, capability);
    const victim = await browser.newContext();
    const other = await victim.newPage();
    const key = `dentmarket:${capability.toLowerCase()}-session`;
    const target = capability === "BUYER" ? "/clinic/settings" : "/supplier/settings";
    try {
      await page.goto(target);
      const token = await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)!).accessToken as string, key);
      const issued = await page.request.post("/api/auth/handoff", { headers: { authorization: `Bearer ${token}` }, data: { capability } });
      expect(issued.status()).toBe(201);
      const handoff = await issued.json();
      const envelope = { capability, organizationId: fixture.organizationId, handoffCode: handoff.handoffCode };
      const exchange = other.waitForResponse(r => r.url().endsWith("/api/auth/handoff/exchange"));
      await other.goto(`${baseURL}${target}#session=${encodeURIComponent(JSON.stringify(envelope))}`);
      expect((await exchange).status()).toBe(401);
      await expect(other.getByText("Не удалось завершить переход в кабинет.", { exact: false })).toBeVisible();
      expect(await other.evaluate(k => sessionStorage.getItem(k), key)).toBeNull();
      expect((await victim.cookies()).some(c => c.name.startsWith("mp_refresh"))).toBe(false);

      // The rejected browser must not burn the legitimate browser's one-use code.
      await page.goto("about:blank");
      const accepted = page.waitForResponse(r => r.url().endsWith("/api/auth/handoff/exchange"));
      await page.goto(`${baseURL}${target}#session=${encodeURIComponent(JSON.stringify(envelope))}`);
      expect((await accepted).status()).toBe(201);
      await expect(page).toHaveURL(`${baseURL}${target}`);
      await expect.poll(() => page.evaluate(k => JSON.parse(sessionStorage.getItem(k) ?? "null")?.organizationId, key)).toBe(fixture.organizationId);
      expect((await page.request.post("/api/auth/handoff/exchange", { data: { handoffCode: handoff.handoffCode } })).status()).toBe(401);

      await other.goto("about:blank");
      await other.goto(`${baseURL}${target}#session=${encodeURIComponent(JSON.stringify({ capability, organizationId: fixture.organizationId, accessToken: token, accessTokenExpiresAt: Date.now() + 900000 }))}`);
      await expect(other.getByText("Переход в кабинет не подтверждён.", { exact: false })).toBeVisible();
      expect(await other.evaluate(k => sessionStorage.getItem(k), key)).toBeNull();
    } finally { await victim.close(); await fixture.dispose(); }
  });
}
