import { sumVatLines, vatLabel, type VatLineSnapshot } from "@marketplace/schemas";
import { formatMoney } from "./money";
import styles from "./vat-breakdown.module.css";

export function VatLineAmount({ tax, currency }: { tax: VatLineSnapshot | null | undefined; currency: string }) {
  if (!tax) return <small className={styles.line}>НДС не уточнён поставщиком</small>;
  return <small className={styles.line}>{vatLabel(tax.declaration.selection)} · НДС {formatMoney(tax.vatMinor, currency)} · без НДС {formatMoney(tax.baseMinor, currency)}</small>;
}
export function VatBreakdown({ lines, currency }: { lines: Array<VatLineSnapshot | null | undefined>; currency: string }) {
  if (!lines.length) return null;
  const known = lines.filter((line): line is VatLineSnapshot => Boolean(line));
  const unknown = lines.length - known.length;
  const groups = new Map<string, VatLineSnapshot[]>();
  for (const line of known) { const key = vatLabel(line.declaration.selection); groups.set(key, [...(groups.get(key) ?? []), line]); }
  const total = sumVatLines(known);
  return <section className={styles.summary} aria-label="Расчёт НДС">
    <h3>Расчёт НДС{unknown ? " по подтверждённым позициям" : ""}</h3>
    {known.length ? <><p>Сумма без НДС: {formatMoney(total.baseMinor, currency)} · НДС: {formatMoney(total.vatMinor, currency)}</p>
      <ul>{[...groups].map(([label, values]) => { const amounts = sumVatLines(values); return <li key={label}>{label}: сумма {formatMoney(amounts.grossMinor, currency)}, НДС {formatMoney(amounts.vatMinor, currency)}</li>; })}</ul></> : null}
    {unknown ? <p>Позиций с неуточнённым НДС: {unknown}. Они не включены в налоговую разбивку.</p> : null}
  </section>;
}
