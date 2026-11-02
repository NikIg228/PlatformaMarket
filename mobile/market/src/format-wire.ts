export type Locale = "ru" | "kk";

/** Display a verified timestamp in the device zone, with an explicit offset. */
export function formatTimestamp(value: string | null | undefined, locale: Locale, timeZone?: string): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23", timeZoneName: "shortOffset", ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch { return null; }
}

/** Decimal placement for display only. Never converts a monetary wire value to Number. */
export function formatMinor(amount: string | null, currency: string | null, locale: Locale): string | null {
  if (amount === null || currency === null || !/^-?\d+(?:\.\d+)?$/.test(amount) || !/^[A-Z]{3}$/.test(currency)) return null;
  try {
    // Unknown currency exponents must not be guessed. KZT is the conservative fallback
    // on engines lacking the optional ISO currency inventory.
    const inventory = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : ["KZT"];
    if (!inventory.includes(currency)) return null;
    const digits = new Intl.NumberFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    if (digits === undefined || digits < 0) return null;
    const negative = amount.startsWith("-");
    const [whole, fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
    const padded = whole!.padStart(digits + 1, "0");
    const integer = (digits ? padded.slice(0, -digits) : padded).replace(/^0+(?=\d)/, "");
    const decimal = (digits ? padded.slice(-digits) : "") + fraction;
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return `${negative ? "−" : ""}${grouped}${decimal ? `,${decimal}` : ""} ${currency}`;
  } catch { return null; }
}
