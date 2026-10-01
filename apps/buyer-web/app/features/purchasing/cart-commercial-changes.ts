import type { CartLineSnapshotResponse } from "@marketplace/schemas";
import { sameAcceptedPromotion } from "@marketplace/schemas/promotion-snapshot";

const amount = (value: string | null | undefined) => value?.replace(".", ",") ?? "не указано";
const sourceName = (source: string) => ({ BASE: "обычная цена", TIER: "цена за объём", CONTRACT: "договорная цена" })[source] ?? "не указан";

export function cartCommercialChanges(previous: CartLineSnapshotResponse, current: CartLineSnapshotResponse) {
  const before = previous.commercialTerms;
  const after = current.commercialTerms;
  const changes: string[] = [];
  const promotionLabel = (value: CartLineSnapshotResponse["promotion"]) => value ? `${value.name}, версия ${value.revision}${value.gift ? `; подарок: ${value.gift.name} × ${value.gift.quantity}` : "; без подарка"}` : "без акции";
  if (!sameAcceptedPromotion(previous.promotion, current.promotion))
    changes.push(`Акция: ${promotionLabel(previous.promotion)} → ${promotionLabel(current.promotion)}`);
  const compare = (label: string, oldValue: string, newValue: string, changed = oldValue !== newValue) => {
    if (changed) changes.push(`${label}: ${oldValue} → ${newValue}`);
  };
  if (!before && after) changes.push("Уточнены условия ранее сохранённой корзины:");
  compare("Единица продажи", before?.saleUnitName ?? "не указана", after?.saleUnitName ?? "не указана", before?.saleUnitId !== after?.saleUnitId);
  compare("Упаковка", before?.packagingName ?? "без отдельной упаковки", after?.packagingName ?? "без отдельной упаковки", before?.packagingId !== after?.packagingId);
  compare("Базовых единиц в единице продажи", amount(before?.baseUnitsPerSaleUnit), amount(after?.baseUnitsPerSaleUnit));
  compare("Базовых единиц в упаковке", amount(before?.packagingQuantity), amount(after?.packagingQuantity));
  if (before?.packagingUnitId !== after?.packagingUnitId) changes.push("Изменилась единица измерения содержимого упаковки.");
  const vat = (terms: typeof before) => !terms || terms.includesVat === null ? "не указан" : `${terms.includesVat ? "включён" : "не включён"}, ставка ${terms.vatRate === null ? "не указана" : `${amount(terms.vatRate)}%`}`;
  compare("НДС", vat(before), vat(after));
  compare("Минимальное количество", amount(previous.minimumOrderQuantity), amount(current.minimumOrderQuantity));
  compare("Шаг заказа", amount(previous.orderIncrement), amount(current.orderIncrement));
  compare("Условие цены", sourceName(previous.source), sourceName(current.source));
  if (previous.source === current.source && previous.ruleId !== current.ruleId) changes.push("Применяется новая версия условия цены.");
  return changes;
}
