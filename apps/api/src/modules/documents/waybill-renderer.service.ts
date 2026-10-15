import { Injectable } from "@nestjs/common";
import { vatLabel, type ShipmentWaybillSnapshot } from "@marketplace/schemas";
import PDFDocument from "pdfkit";
import { join } from "node:path";
import { assertPdfCharacters } from "./document-renderer.service";
import { invoiceMoney } from "./invoice-renderer.service";

@Injectable()
export class WaybillRendererService {
  render(snapshot: ShipmentWaybillSnapshot) {
    const text = [
      "ПРЕДПРОСМОТР — НЕ ПОДПИСАНО",
      `Накладная ${snapshot.number} · версия ${snapshot.version} · ${snapshot.date}`,
      `Заказ ${snapshot.orderNumber} · партия ${snapshot.shipmentNumber}`,
      `Поставщик: ${snapshot.supplier.source.legalName}; БИН/ИИН ${snapshot.supplier.source.identifier}`,
      `Юридический адрес: ${snapshot.supplier.source.legalAddressText}`,
      `Получатель: ${snapshot.buyer.source.legalName}; БИН/ИИН ${snapshot.buyer.source.identifier}`,
      `Юридический адрес: ${snapshot.buyer.source.legalAddressText}`,
      `Склад: ${snapshot.warehouse.name}; ${snapshot.warehouse.address}`,
      `Доставка / самовывоз: ${snapshot.recipient.name}; ${snapshot.recipient.address}`,
      `Перевозчик: ${snapshot.carrierName ?? "не указан"}; трек / транспортный документ: ${snapshot.trackingNumber ?? "не указан"}`,
      "",
    ].join("\n");
    assertPdfCharacters(JSON.stringify(snapshot));
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", bufferPages: true,
        margins: { top: 40, bottom: 45, left: 40, right: 40 }, info: { Title: `${snapshot.number} — предпросмотр` } });
      const chunks: Buffer[] = []; doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
      try {
        const width = 762, bottom = 540, widths = [24, 230, 50, 65, 65, 90, 90, 148];
        const xs = widths.map((_, i) => 40 + widths.slice(0, i).reduce((a, b) => a + b, 0));
        const pageHeading = () => { doc.fontSize(9).text(`${snapshot.number} · R${snapshot.version} · ПРЕДПРОСМОТР — НЕ ПОДПИСАНО`, 40, 22, { width }); doc.y = 45; };
        doc.font(join(__dirname, "fonts", "NotoSans.ttf")); doc.on("pageAdded", pageHeading); pageHeading();
        doc.fontSize(17).text("Товарная накладная", { width }).moveDown(0.4);
        doc.fontSize(10).text(text, { width, lineGap: 2 }).moveDown(0.4);
        const header = () => {
          const y = doc.y; doc.fontSize(8);
          ["№", "Наименование / артикул / НДС", "Ед.", "В заказе", "В партии", "Цена, ₸", "НДС, ₸", "Сумма, ₸"].forEach((label, i) => doc.text(label, xs[i] + 3, y, { width: widths[i] - 6, lineBreak: false }));
          doc.y = y + 20; doc.moveTo(40, doc.y - 5).lineTo(802, doc.y - 5).stroke();
        };
        const wrap = (text: string, width: number) => {
          const lines: string[] = []; let line = "";
          for (const char of text) {
            if (char === "\n") { lines.push(line); line = ""; }
            else if (doc.widthOfString(line + char) > width && line) { lines.push(line); line = char; }
            else line += char;
          }
          lines.push(line); return lines;
        };
        if (doc.y + 55 > bottom) doc.addPage(); header();
        snapshot.lines.forEach((line, index) => {
          doc.fontSize(9);
          const values = [String(index + 1), `${line.name}\n${line.article}\n${line.gift ? "Подарок" : vatLabel(line.tax?.declaration.selection)}`,
            line.unit, line.orderedQuantity, line.quantity, invoiceMoney(line.unitPriceMinor), invoiceMoney(line.tax?.vatMinor ?? "0"), invoiceMoney(line.totalMinor)];
          const lines = values.map((value, i) => wrap(value, widths[i] - 6));
          const count = Math.max(...lines.map(value => value.length)); let offset = 0;
          if (count * 13 + 8 < bottom - 65 && doc.y + count * 13 + 8 > bottom) { doc.addPage(); header(); doc.fontSize(9); }
          while (offset < count) {
            if (doc.y + 25 > bottom) { doc.addPage(); header(); doc.fontSize(9); }
            const take = Math.min(count - offset, Math.floor((bottom - doc.y - 8) / 13)), y = doc.y;
            lines.forEach((value, i) => value.slice(offset, offset + take).forEach((part, row) => doc.text(part, xs[i] + 3, y + row * 13, { width: widths[i] - 6, lineBreak: false })));
            doc.y = y + take * 13 + 8; offset += take;
          }
          doc.moveTo(40, doc.y - 3).lineTo(802, doc.y - 3).lineWidth(0.2).stroke();
        });
        if (doc.y + 180 > bottom) doc.addPage();
        doc.fontSize(12).text(`Сумма партии: ${invoiceMoney(snapshot.totalMinor)} ₸`, 40, doc.y + 12, { width });
        doc.fontSize(10).text(`Без НДС: ${invoiceMoney(snapshot.baseMinor)} ₸; в том числе НДС: ${invoiceMoney(snapshot.vatMinor)} ₸.`, { width }).moveDown();
        doc.fontSize(9).text(`Подготовил(а) в системе: ${snapshot.preparedBy.name}.\nОтпуск разрешил: ____________________    Отпустил: ____________________\nПолучил: ____________________    Доверенность (при применимости): ____________________`, { width, lineGap: 3 }).moveDown();
        doc.text("Это предпросмотр по составу партии. Факт передачи и получения товара не подтверждён.\nПодписи сторон отсутствуют. Документ не завершает поставку, оплату или документальную приёмку.", { width });
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i); doc.page.margins.bottom = 0;
          doc.fontSize(8).text(`Страница ${i + 1} из ${pages.count} · ${snapshot.templateVersion}`, 40, 570, { width, lineBreak: false });
        }
        doc.end();
      } catch (error) { reject(error); doc.end(); }
    });
  }
}
