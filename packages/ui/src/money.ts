/** Monetary input is an integer minor-unit value. Never round it through Number. */
export function parseMoneyInput(value: string): string | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,18}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return minor > BigInt(0) && minor <= BigInt("99999999999999999999") ? minor.toString() : null;
}

export function moneyInputValue(minor: string): string {
  const amount = BigInt(minor);
  return `${amount / BigInt(100)}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}

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
