import { beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WaybillRendererService } from "./waybill-renderer.service";
import { waybillSnapshot } from "./shipment-waybill.rules";
import { waybillTestShipment } from "./shipment-waybill.test-fixture";
import { invoiceTestId as id, invoiceTestRevision } from "./order-invoice.test-fixture";
let getDocument: typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"];
beforeAll(async () => { ({ getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")); }, 30000);
describe("waybill PDF", () => {
  it("keeps actual quantities, exact totals, Cyrillic and preview markings on every page", async () => {
    const base = waybillSnapshot(waybillTestShipment(), invoiceTestRevision(1), invoiceTestRevision(2), 1, { id: id(91), name: "Тестовый сотрудник" });
    for (const long of [false, true]) {
      const snapshot = { ...base, lines: long ? Array.from({ length: 25 }, (_, i) => ({ ...base.lines[0], name: `Материал ${i + 1}: Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі ${"длинное название ".repeat(i === 1 ? 150 : 3)}` })) : base.lines };
      if (long) { snapshot.totalMinor = "145000"; snapshot.baseMinor = "125000"; snapshot.vatMinor = "20000"; }
      const bytes = await new WaybillRendererService().render(snapshot);
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }); const pdf = await task.promise;
      try {
        const text: string[] = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n), content = await page.getTextContent();
          const items = content.items.filter(item => "str" in item && item.str.trim());
          const pageText = items.map(item => "str" in item ? item.str : "").join("\n"); text.push(pageText);
          expect(pageText).toContain("ПРЕДПРОСМОТР — НЕ ПОДПИСАНО"); expect(pageText).toContain(`Страница ${n} из ${pdf.numPages}`);
          for (const item of items) if ("str" in item) { expect(item.transform[4]).toBeGreaterThanOrEqual(39); expect(item.transform[4] + item.width).toBeLessThanOrEqual(803); expect(item.transform[5]).toBeGreaterThan(10); }
        }
        expect(text.join("\n")).toContain(long ? "Материал 25" : "Сумма партии: 58,00");
        expect(text.join("\n")).toContain("Подписи сторон отсутствуют");
      } finally { await task.destroy(); }
      if (process.env.WAYBILL_PDF_OUTPUT) { mkdirSync(process.env.WAYBILL_PDF_OUTPUT, { recursive: true }); writeFileSync(join(process.env.WAYBILL_PDF_OUTPUT, long ? "waybill-long.pdf" : "waybill-preview.pdf"), bytes); }
    }
  }, 30000);
});
