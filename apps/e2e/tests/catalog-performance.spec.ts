import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Use the same compiled app, isolated API dataset, browser and viewport in both
// runs. This is measurement evidence, not a timing threshold on a developer PC.
for (const width of [390, 1440]) test(`catalog cold/warm measurement ${width}`, async ({ browser }, testInfo) => {
  const samples: unknown[] = [];
  for (let sample = 0; sample < 3; sample++) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Performance.enable");
      for (const cache of ["cold", "warm"]) {
        let requests = 0;
        const count = () => requests++;
        page.on("request", count);
        await page.goto("http://127.0.0.1:3000/catalog?sort=PRICE_ASC");
        await expect(page.getByTestId("product-card")).toHaveCount(24);
        await expect(page.locator('section[aria-label="Каталог товаров"]')).toBeVisible();
        const browserMetrics = await page.evaluate(() => ({
          navigation: performance.getEntriesByType("navigation").map(entry => entry.toJSON()),
          scripts: performance.getEntriesByType("resource").filter(entry => entry.name.includes(".js")).map(entry => entry.toJSON()),
          domNodes: document.getElementsByTagName("*").length,
        }));
        const { metrics } = await session.send("Performance.getMetrics");
        samples.push({ sample, cache, width, requests, ...browserMetrics,
          runtime: Object.fromEntries(metrics.filter(({ name }) => ["ScriptDuration", "TaskDuration", "JSHeapUsedSize"].includes(name)).map(({ name, value }) => [name, value])) });
        page.off("request", count);
      }
    } finally { await context.close(); }
  }
  const path = testInfo.outputPath(`catalog-${width}.json`);
  await writeFile(path, JSON.stringify(samples, null, 2));
  await testInfo.attach(`catalog-${width}.json`, { path, contentType: "application/json" });
});
