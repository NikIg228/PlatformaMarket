"use client";
import type { OrderWorkflowResponse } from "@marketplace/schemas";
import { orderItemPromotion } from "@marketplace/schemas/promotion-snapshot";
import { Section, formatMoney } from "./index";

export function OrderPromotionSummary({ data }: { data: OrderWorkflowResponse }) {
  const promoted = data.order.items.flatMap(item => { const promotion = orderItemPromotion(item.offerSnapshot); return promotion ? [{ item, promotion }] : []; });
  if (!promoted.length) return null;
  return <Section title="Условия акций в заказе"><p>Это согласованные условия заказа. Завершение акции не отменяет цену или подарок. Для повторной закупки действуют текущие условия.</p>
    {promoted.map(({ item, promotion }) => <article key={item.id}><h3>{promotion.name} · версия {promotion.revision}</h3>
      <p>Обычная цена: {formatMoney(promotion.baseUnitPriceMinor, item.currency)} · цена заказа: {formatMoney(promotion.unitPriceMinor, item.currency)}</p>
      {promotion.gift ? <p>Обещанный подарок: {promotion.gift.name} × {promotion.gift.quantity}. Получение учитывается отдельной позицией; разделение отгрузок подарок не отменяет.</p> : null}
    </article>)}
  </Section>;
}
