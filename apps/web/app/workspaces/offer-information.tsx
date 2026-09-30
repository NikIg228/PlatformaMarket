import type { WorkspaceOffer } from "@marketplace/schemas";
import { formatMoney, formatStatus } from "@marketplace/ui";

const formatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Almaty" });
function timestamp(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? `${formatter.format(new Date(value))} (Алматы)` : "не указано";
}
function source(value?: string) {
  return ({ MANUAL: "ручной ввод", IMPORT: "импорт", API: "API", ERP: "ERP" } as Record<string, string>)[value ?? ""] ?? value ?? "не указан";
}
function Freshness({ expiresAt }: { expiresAt: string | null | undefined }) {
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN;
  // This labels the supplied confirmation timestamp, never commercial eligibility.
  return <small>{!Number.isFinite(expiry) ? "Срок подтверждения не указан" : expiry <= Date.now()
    ? `Срок подтверждения истёк: ${timestamp(expiresAt)}` : `Подтверждение действует до: ${timestamp(expiresAt)}`}</small>;
}
export function OfferSaleUnit({ offer }: { offer: WorkspaceOffer }) {
  return <>
    <small>Единица продажи: {offer.saleUnit ? `${offer.saleUnit.nameRu} (${offer.saleUnit.symbol})` : "не указана"}</small>
    <small>{offer.packaging ? `Упаковка: ${offer.packaging.name} — ${offer.packaging.quantityInBaseUnit} базовых ед.` : `В единице продажи: ${offer.baseUnitsPerSaleUnit} базовых ед.`}</small>
    <small>Минимум: {offer.minimumOrderQuantity}; шаг: {offer.orderIncrement} ед. продажи</small>
  </>;
}
export function OfferPrice({ offer }: { offer: WorkspaceOffer }) {
  const price = offer.prices.find(item => item.status === "ACTIVE");
  if (!price) return <>Цена не задана</>;
  return <>
    {formatMoney(price.amountMinor, price.currency)} за {offer.saleUnit?.symbol ?? "единицу продажи"}
    <small>Подтверждено: {timestamp(price.lastConfirmedAt)}</small>
    <Freshness expiresAt={price.freshnessExpiresAt} />
    <small>Источник цены: {source(price.source)}</small>
  </>;
}
export function OfferStock({ offer }: { offer: WorkspaceOffer }) {
  return offer.inventoryBalances.length ? <>{offer.inventoryBalances.map(balance => <div key={balance.id}>
    <small>{balance.warehouse.name} ({offer.saleUnit?.symbol ?? "ед. продажи"}): доступно {balance.quantityAvailable}; в резерве {balance.quantityReserved}</small>
    <small>{formatStatus(balance.freshnessStatus)} · обновлено: {timestamp(balance.updatedAt)}</small>
    <Freshness expiresAt={balance.freshnessExpiresAt} />
    <small>Источник остатка: {source(balance.source)}</small>
  </div>)}</> : <>Остаток не задан</>;
}
