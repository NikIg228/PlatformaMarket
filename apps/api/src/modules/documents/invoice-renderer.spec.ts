import { beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { InvoiceRendererService, invoiceAmountWords } from "./invoice-renderer.service";
import { invoiceSnapshot } from "./order-invoice.rules";
import { invoiceTestOrder, invoiceTestRevision } from "./order-invoice.test-fixture";
let getDocument: typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"];
beforeAll(async () => { ({ getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")); }, 30000);
describe("invoice PDF", () => {
  it("keeps exact large amounts in words", () => {
    expect(invoiceAmountWords("11600")).toBe("Сто шестнадцать тенге 00 тиын");
    expect(invoiceAmountWords("210105")).toBe("Две тысячи сто один тенге 05 тиын");
    expect(invoiceAmountWords("900719925474099301")).toContain("квадриллион");
  });
  it("renders a marked preview and a confirmed multipage invoice without clipped cells", async () => {
    const renderer = new InvoiceRendererService();
    const base = invoiceSnapshot(invoiceTestOrder(), invoiceTestRevision(1), invoiceTestRevision(2), "PM-INV-2026-00000001", 1);
    for (const long of [false, true]) {
      const snapshot = { ...base, lines: long ? Array.from({ length: 45 }, (_, index) => ({ ...base.lines[0], name: `Материал ${index + 1}: ${"Длинное наименование упаковки Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі. ".repeat(index === 2 ? 80 : 3)}` })) : base.lines };
      if (long) { snapshot.totalMinor = "522000"; snapshot.baseMinor = "450000"; snapshot.vatMinor = "72000"; }
      const bytes = await renderer.render(snapshot, long ? { name: "Тестовый поставщик", at: new Date("2026-10-15T10:00:00Z") } : undefined);
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
      const pdf = await task.promise; const texts: string[] = [];
      try {
        expect(pdf.numPages).toBeGreaterThanOrEqual(long ? 4 : 1);
        for (let number = 1; number <= pdf.numPages; number++) {
          const page = await pdf.getPage(number), content = await page.getTextContent();
          const items = content.items.filter(item => "str" in item).filter(item => item.str.trim());
          texts.push(items.map(item => item.str).join("\n"));
          for (const item of items) {
            expect(item.transform[4]).toBeGreaterThanOrEqual(39.5);
            expect(item.transform[4] + item.width).toBeLessThanOrEqual(556);
            expect(item.transform[5]).toBeGreaterThan(20);
            expect(item.transform[5]).toBeLessThan(810);
          }
          expect(texts.at(-1)).toContain(`Страница ${number} из ${pdf.numPages}`);
        }
        const text = texts.join("\n");
        expect(text).toContain(long ? "Тестовый поставщик" : "ПРОЕКТ");
        expect(text).toContain("KZ86125KZT5004100100"); expect(text).toContain(invoiceAmountWords(snapshot.totalMinor));
        if (long) { expect(text).toContain("Материал 45"); expect(text.match(/Наименование \/ артикул/g)?.length).toBeGreaterThan(2); }
      } finally { await task.destroy(); }
      if (process.env.INVOICE_PDF_OUTPUT) {
        mkdirSync(process.env.INVOICE_PDF_OUTPUT, { recursive: true });
        writeFileSync(join(process.env.INVOICE_PDF_OUTPUT, long ? "invoice-long.pdf" : "invoice-preview.pdf"), bytes);
      }
    }
  }, 30000);
});
