/** Monetary input is an integer minor-unit value. Never round it through Number. */
export function formatMoney(amountMinor: string | number | bigint | null | undefined, currency = "KZT") {
  if (amountMinor == null) return "По запросу";
  if (typeof amountMinor === "number" && !Number.isSafeInteger(amountMinor)) return "Сумма недоступна";
  const raw = String(amountMinor);
  if (!/^-?\d+$/.test(raw)) return "Сумма недоступна";
  const value = BigInt(raw);
  const absolute = value < BigInt(0) ? -value : value;
  const major = absolute / BigInt(100);
  const fraction = absolute % BigInt(100);
  const grouped = new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(major);
  const symbol = new Intl.NumberFormat("ru-KZ", { style: "currency", currency }).formatToParts(0).find(part => part.type === "currency")?.value ?? currency;
  return `${value < BigInt(0) ? "−" : ""}${grouped}${fraction ? `,${fraction.toString().padStart(2, "0")}` : ""}\u00a0${symbol}`;
}
