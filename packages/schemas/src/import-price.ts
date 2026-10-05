/** Decimal currency conversion shared by the import preview and processing. */
export function importPriceMinor(value: unknown, unit: "MAJOR" | "MINOR" = "MINOR"): string | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (unit === "MINOR") return /^[1-9]\d{0,19}$/.test(text) ? text : null;
  if (!/^\d{1,18}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return amount > 0n && amount.toString().length <= 20 ? amount.toString() : null;
}
