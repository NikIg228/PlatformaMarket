import type { CartValidation } from "./types";

export function cartChangeNotice(validation: CartValidation | null) {
  if (!validation?.hasChanges && !validation?.requiresAcceptance) return null;
  const unavailable = validation.items.some(item => item.status === "UNAVAILABLE");
  const price = validation.requiresAcceptance || validation.items.some(item => item.changes.some(change => change === "PRICE" || change === "OFFER_RULES"));
  const title = unavailable ? "Предложение больше недоступно" : price ? "Условия покупки изменились" : "Доступное количество изменилось";
  const description = unavailable ? "Проверьте позиции в корзине и выберите другого поставщика." : price
    ? "Проверьте изменения в корзине перед оформлением." : "Проверьте количество товара в корзине.";
  // validatedAt changes on every poll; only changed commercial data is a new event.
  const key = JSON.stringify([validation.cartId, title, validation.items.filter(item => item.status !== "UNCHANGED")], (name, value: unknown) => name === "resolvedAt" ? undefined : value);
  return { title, description, key };
}
