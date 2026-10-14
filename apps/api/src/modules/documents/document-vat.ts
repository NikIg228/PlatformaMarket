import { orderLineVat, sumVatLines, vatLabel, type VatLineSnapshot } from "@marketplace/schemas";

function money(minor: string): string {
  const amount = BigInt(minor);
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
}
export function documentTaxTemplate(kind: string, body: string, data: Record<string, unknown>): string {
  const invoice = data.invoice as { taxSummary?: unknown } | undefined;
  return kind === "INVOICE" && typeof invoice?.taxSummary === "string" && !body.includes("invoice.taxSummary")
    ? `${body}\n\nНалоговые условия:\n{{invoice.taxSummary}}` : body;
}
export function documentVat(items: readonly { offerSnapshot: unknown; totalPriceMinor: { toString(): string } }[]) {
  const lines = items.map(item => orderLineVat(item.offerSnapshot, item.totalPriceMinor.toString()));
  const groups = new Map<string, { label: string; lines: VatLineSnapshot[] }>();
  for (const line of lines) {
    if (!line) continue;
    const selection = line.declaration.selection;
    const key = JSON.stringify([selection.mode, selection.rate, selection.basis]);
    const group = groups.get(key) ?? { label: vatLabel(selection), lines: [] };
    group.lines.push(line); groups.set(key, group);
  }
  const totals = [...groups.values()].map(group => ({ label: group.label, ...sumVatLines(group.lines) }));
  const unknownCount = lines.filter(line => line === null).length;
  return {
    lines, totals, unknownCount,
    lineText: lines.map(line => line ? `${vatLabel(line.declaration.selection)}; база ${money(line.baseMinor)}; НДС ${money(line.vatMinor)}` : "НДС не уточнён"),
    summary: [...totals.map(group => `${group.label}: база ${money(group.baseMinor)}, НДС ${money(group.vatMinor)}, итог ${money(group.grossMinor)}`),
      ...(unknownCount ? [`НДС не уточнён: строк ${unknownCount}`] : [])].join("\n"),
  };
}
