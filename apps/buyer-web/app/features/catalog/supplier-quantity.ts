/** Maximum selectable sale units in a supplier offer, owner decision 31.10.2026. */
export const MAX_SUPPLIER_QUANTITY = 100;
type QuantityOffer = { minimumOrderQuantity?: string; orderIncrement?: string };

export function quantityRules(offer: QuantityOffer) {
  return { min: Number(offer.minimumOrderQuantity ?? 1), step: Number(offer.orderIncrement ?? 1) };
}
export function initialQuantity(offer: QuantityOffer) {
  const { min, step } = quantityRules(offer);
  return String(Number((Math.ceil(min / step - 1e-9) * step).toFixed(6)));
}
export function validQuantity(value: string, offer: QuantityOffer) {
  const n = Number(value);
  const { min, step } = quantityRules(offer);
  return value.trim() !== "" && Number.isFinite(n) && n > 0 && n >= min && n <= MAX_SUPPLIER_QUANTITY && step > 0
    && Math.abs(n / step - Math.round(n / step)) < 1e-7;
}
