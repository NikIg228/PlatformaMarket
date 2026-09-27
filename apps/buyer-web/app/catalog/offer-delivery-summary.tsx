import { deliveryLabel } from "../catalog-ranking";
import { formatCatalogMoney } from "./catalog-view-model";

export type DeliverySummary = {
  method: string; minLeadTimeHours: number | null; maxLeadTimeHours: number | null;
  priceType?: string; fixedAmountMinor?: string | null; freeFromAmountMinor?: string | null;
  currency?: string; temperatureControlled?: boolean; installationRequired?: boolean;
};
export function OfferDeliverySummary({ options, currency }: { options: DeliverySummary[]; currency: string }) {
  if (!options.length) return <small>Условия доставки уточняются у поставщика.</small>;
  return <>{options.map((option, index) => <div key={`${option.method}-${index}`}>
    <span>{deliveryLabel([option.method])}</span>
    {option.maxLeadTimeHours != null ? <small> · {option.minLeadTimeHours ?? 0}–{option.maxLeadTimeHours} ч.</small>
      : option.minLeadTimeHours != null ? <small> · от {option.minLeadTimeHours} ч.</small> : null}
    {option.priceType === "FREE" ? <small> · бесплатно</small>
      : option.priceType === "FREE_FROM_AMOUNT" && option.freeFromAmountMinor != null ? <small> · бесплатно от {formatCatalogMoney(option.freeFromAmountMinor, option.currency ?? currency)}{option.fixedAmountMinor != null ? `; иначе ${formatCatalogMoney(option.fixedAmountMinor, option.currency ?? currency)}` : ""}</small>
      : option.priceType === "FIXED" && option.fixedAmountMinor != null ? <small> · {formatCatalogMoney(option.fixedAmountMinor, option.currency ?? currency)}</small>
      : <small> · стоимость по согласованию</small>}
    {option.temperatureControlled ? <small> · температурный режим</small> : null}
    {option.installationRequired ? <small> · требуется установка</small> : null}
  </div>)}</>;
}
