/** Parse user-entered KZT without floating-point multiplication. */
export function offerPriceMinor(value: string): number {
  const text = value.trim().replace(",", ".");
  if (!/^\d{1,14}(?:\.\d{1,2})?$/.test(text)) throw new Error("Укажите положительную цену в тенге, не более двух знаков после запятой.");
  const [whole, fraction = ""] = text.split(".");
  const amount = BigInt(whole!) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Цена выходит за допустимые границы.");
  return Number(amount);
}

export function offerPriceText(minor: string): string {
  if (!/^\d+$/.test(minor)) return "";
  return `${BigInt(minor) / BigInt(100)}.${(BigInt(minor) % BigInt(100)).toString().padStart(2, "0")}`;
}

export function offerQuantity(value: string, allowZero = false): number {
  const text = value.trim().replace(",", ".");
  if (!/^\d{1,6}(?:\.\d{1,6})?$/.test(text)) throw new Error("Количество должно быть числом до 999999 с точностью до 6 знаков.");
  const quantity = Number(text);
  if (!Number.isFinite(quantity) || (allowZero ? quantity < 0 : quantity <= 0)) throw new Error("Проверьте количество: партия и шаг должны быть больше нуля.");
  return quantity;
}
