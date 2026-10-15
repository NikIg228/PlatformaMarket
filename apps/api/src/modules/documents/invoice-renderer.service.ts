import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { join } from "node:path";
import { vatLabel, type OrderInvoiceSnapshot } from "@marketplace/schemas";
import { assertPdfCharacters } from "./document-renderer.service";

export function invoiceMoney(minor: string) {
  const value = BigInt(minor);
  return `${(value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${(value % 100n).toString().padStart(2, "0")}`;
}
export function invoiceAmountWords(minor: string) {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const ranks = [["", "", ""], ["тысяча", "тысячи", "тысяч"], ["миллион", "миллиона", "миллионов"], ["миллиард", "миллиарда", "миллиардов"], ["триллион", "триллиона", "триллионов"], ["квадриллион", "квадриллиона", "квадриллионов"], ["квинтиллион", "квинтиллиона", "квинтиллионов"]];
  const amount = BigInt(minor); let whole = amount / 100n, rank = 0; const groups: string[] = [];
  while (whole > 0n) {
    const n = Number(whole % 1000n), tail = n % 100, one = n % 10;
    if (n) {
      const words = [hundreds[Math.floor(n / 100)]];
      if (tail >= 10 && tail < 20) words.push(teens[tail - 10]);
      else words.push(tens[Math.floor(tail / 10)], rank === 1 && one === 1 ? "одна" : rank === 1 && one === 2 ? "две" : units[one]);
      words.push(ranks[rank][tail >= 11 && tail <= 14 ? 2 : one === 1 ? 0 : one >= 2 && one <= 4 ? 1 : 2]);
      groups.unshift(words.filter(Boolean).join(" "));
    }
    whole /= 1000n; rank++;
  }
  const result = `${groups.join(" ") || "ноль"} тенге ${(amount % 100n).toString().padStart(2, "0")} тиын`;
  return result[0].toUpperCase() + result.slice(1);
}

@Injectable()
export class InvoiceRendererService {
  render(snapshot: OrderInvoiceSnapshot, confirmation?: { name: string; at: Date }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margins: { left: 40, right: 40, top: 40, bottom: 45 }, bufferPages: true,
        info: { Title: `Счёт ${snapshot.number} R${snapshot.version}`, Producer: "Platforma.Market" } });
      const chunks: Buffer[] = []; doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
      try {
        assertPdfCharacters(JSON.stringify(snapshot));
        if (confirmation) assertPdfCharacters(confirmation.name);
        doc.font(join(__dirname, "fonts", "NotoSans.ttf"));
        const width = 515, bottom = 780;
        const paragraph = (text: string, size = 10, gap = 6) => {
          doc.fontSize(size); const height = doc.heightOfString(text, { width });
          if (doc.y + height > bottom) doc.addPage();
          doc.text(text, 40, doc.y, { width, lineGap: 2 }); doc.y += gap;
        };
        paragraph("Platforma.Market · сервис подготовки документов", 9, 10);
        paragraph(`Счёт на оплату № ${snapshot.number}`, 17, 6);
        paragraph(`Дата: ${snapshot.date} · Версия R${String(snapshot.version).padStart(2, "0")} · Заказ ${snapshot.orderNumber}`, 10, 10);
        paragraph(confirmation ? "Выставление подтверждено поставщиком" : "ПРОЕКТ — НЕ ВЫСТАВЛЕН. Не использовать для оплаты.", 11, 12);
        for (const [label, party] of [["Поставщик", snapshot.supplier], ["Покупатель", snapshot.buyer]] as const) {
          const source = party.source;
          paragraph(`${label}: ${source.legalName}\n${party.fields.legalForm === "INDIVIDUAL_ENTREPRENEUR" ? "ИИН" : "БИН"}: ${source.identifier}\nЮридический адрес: ${source.legalAddressText}\nКонтакт: ${source.profile?.contactName ?? ""}, ${source.profile?.phone ?? ""}, ${source.profile?.email ?? ""}`);
        }
        paragraph(`Получатель: ${snapshot.supplier.source.legalName}\nИИК: ${snapshot.bankAccount.iban} · КБе: ${snapshot.bankAccount.kbe}\nБанк: ${snapshot.bankAccount.bankName} · БИК: ${snapshot.bankAccount.bic}\nНазначение платежа: оплата по счёту ${snapshot.number}, заказ ${snapshot.orderNumber}.`, 10, 12);
        const widths = [20, 210, 45, 80, 80, 80], xs = [40]; widths.forEach(w => xs.push(xs[xs.length - 1] + w));
        const headers = ["№", "Наименование / артикул", "Кол-во", "Цена, ₸", "НДС, ₸", "Сумма, ₸"];
        const tableHeader = () => {
          if (doc.y + 28 > bottom) doc.addPage();
          const y = doc.y; doc.fontSize(8);
          headers.forEach((text, i) => doc.text(text, xs[i] + 3, y + 5, { width: widths[i] - 6, lineBreak: false }));
          doc.moveTo(40, y + 23).lineTo(555, y + 23).lineWidth(0.6).stroke(); doc.y = y + 27;
        };
        const wrap = (text: string, available: number) => {
          const lines: string[] = []; let line = "";
          for (const character of text) {
            if (character === "\n") { lines.push(line); line = ""; continue; }
            if (doc.widthOfString(line + character) > available && line) { lines.push(line); line = character; } else line += character;
          }
          lines.push(line); return lines;
        };
        tableHeader();
        snapshot.lines.forEach((item, index) => {
          doc.fontSize(9);
          const cells = [String(index + 1), `${item.name}${item.article ? `\nАртикул: ${item.article}` : ""}\n${item.gift ? "Подарок" : vatLabel(item.tax?.declaration.selection)}`,
            `${item.quantity}\n${item.unit}`, invoiceMoney(item.unitPriceMinor), invoiceMoney(item.tax?.vatMinor ?? "0"), invoiceMoney(item.totalMinor)];
          const wrapped = cells.map((text, i) => wrap(text, widths[i] - 6)); let offset = 0;
          const count = Math.max(...wrapped.map(lines => lines.length));
          if (count * 13 + 8 <= bottom - 67 && doc.y + count * 13 + 8 > bottom) {
            doc.addPage(); tableHeader(); doc.fontSize(9);
          }
          while (offset < count) {
            if (doc.y + 23 > bottom) { doc.addPage(); tableHeader(); doc.fontSize(9); }
            const take = Math.min(count - offset, Math.floor((bottom - doc.y - 9) / 13));
            const y = doc.y;
            wrapped.forEach((lines, i) => lines.slice(offset, offset + take).forEach((line, row) => doc.text(line, xs[i] + 3, y + row * 13, { width: widths[i] - 6, lineBreak: false })));
            doc.y = y + take * 13 + 8; offset += take;
          }
          doc.moveTo(40, doc.y - 3).lineTo(555, doc.y - 3).lineWidth(0.2).stroke();
        });
        doc.y += 10;
        // Keep totals, acknowledgement and the explanatory footer together.
        if (doc.y + 240 > bottom) doc.addPage();
        paragraph(`Без НДС: ${invoiceMoney(snapshot.baseMinor)} ₸\nВ том числе НДС: ${invoiceMoney(snapshot.vatMinor)} ₸`, 11);
        const groups = new Map<string, { base: bigint; tax: bigint }>();
        for (const line of snapshot.lines) if (line.tax) {
          const label = vatLabel(line.tax.declaration.selection), group = groups.get(label) ?? { base: 0n, tax: 0n };
          group.base += BigInt(line.tax.baseMinor); group.tax += BigInt(line.tax.vatMinor); groups.set(label, group);
        }
        for (const [label, group] of groups) paragraph(`${label}: база ${invoiceMoney(group.base.toString())} ₸; НДС ${invoiceMoney(group.tax.toString())} ₸`, 9);
        paragraph(`К оплате: ${invoiceMoney(snapshot.totalMinor)} ₸`, 15, 8);
        paragraph(invoiceAmountWords(snapshot.totalMinor), 10, 12);
        paragraph(confirmation ? `Выставление подтвердил(а): ${confirmation.name}.\n${confirmation.at.toISOString()} (UTC). Это подтверждение в системе, не ЭЦП.` : "Предпросмотр. Выставление требует отдельного подтверждения поставщиком.", 9);
        paragraph("Счёт на оплату не является ЭСФ, чеком или документом передачи товара. Цена и итог уже учитывают применимый НДС.", 8);
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          const margin = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.fontSize(8).text(`${snapshot.number} · R${snapshot.version} · Страница ${i + 1} из ${pages.count}`, 40, 805, { width, lineBreak: false });
          doc.page.margins.bottom = margin;
        }
        doc.end();
      } catch (error) { reject(error); doc.end(); }
    });
  }
}
