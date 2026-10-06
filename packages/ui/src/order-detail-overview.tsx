"use client";
import type { ReactNode } from "react";
import type { OrderWorkflowResponse } from "@marketplace/schemas";
import { DmButton, formatDate, formatMoney } from "./index";
import { orderItemCount, orderOverview, type OrderDetailTab } from "./order-presentation";

export function OrderDetailOverview({ data, supplier, onTab, confirmation, conversation }: {
  data: OrderWorkflowResponse; supplier: boolean; onTab: (tab: OrderDetailTab) => void; confirmation?: ReactNode; conversation?: ReactNode;
}) {
  const view = orderOverview(data, supplier);
  return <section className={`dm-order-overview${view.terminal ? " dm-order-overview-terminal" : ""}`} aria-label="Текущее состояние заказа">
    <div className="dm-order-overview-main" data-attention={Boolean(view.action) || data.status === "AWAITING_CONFIRMATION" && supplier}><div><span className="dm-order-eyebrow">Текущий этап</span><h2>{view.title}</h2><p>{view.description}</p></div>
      <div className="dm-order-actions">{confirmation}{view.action ? <DmButton appearance="primary" onClick={() => { if (data.status === "PARTIALLY_CONFIRMED") document.getElementById(`order-items-${data.order.id}`)?.focus(); else onTab(view.tab); }}>{view.action}</DmButton> : null}{conversation}</div>
    </div>
    {!view.terminal ? <ol className="dm-order-stages" aria-label="Этапы заказа">{view.steps.map((step, index) => <li key={step.label} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}><span aria-hidden="true">{step.state === "done" ? "✓" : index + 1}</span>{step.label}</li>)}</ol> : null}
    {view.openReturn ? <div className="dm-order-return-note">Есть незавершённый возврат <DmButton appearance="subtle" onClick={() => onTab("returns")}>Открыть возврат</DmButton></div> : null}
  </section>;
}

export function OrderDetailItems({ data, action }: { data: OrderWorkflowResponse; action?: ReactNode }) {
  return <section id={`order-items-${data.order.id}`} tabIndex={-1} className="dm-order-card" aria-label="Состав заказа"><div className="dm-order-card-heading"><h2>Состав заказа</h2><span>{orderItemCount(data.order.items.length)}</span></div>
    <div className="dm-order-items">{data.order.items.map(item => <article key={item.id} className="dm-order-item">
      <div><h3>{item.offer?.productVariant.product.canonicalName ?? "Товар"}</h3>{item.giftForItemId ? <span className="dm-order-eyebrow">Подарок</span> : null}<p>Заказано: {item.quantity} · Подтверждено: {item.acceptedQuantity ?? "—"}</p>{item.decisionReason ? <p>{item.decisionReason}</p> : null}</div>
      <strong>{formatMoney(item.totalPriceMinor, item.currency)}</strong>
    </article>)}</div><div className="dm-order-total"><span>Сумма заказа</span><strong>{formatMoney(data.order.subtotalAmountMinor, data.order.currency)}</strong></div>{action}
  </section>;
}

export function OrderDetailDocuments({ data, download }: { data: OrderWorkflowResponse; download: (id: string) => Promise<void> }) {
  const documents = [
    ...(data.invoiceDocumentId ? [{ id: data.invoiceDocumentId, title: "Счёт на оплату", detail: "PDF" }] : []),
    ...data.claims.map((claim, index) => ({ id: claim.documentId, title: `Квитанция о переводе ${index + 1}`, detail: formatDate(claim.paidAt, true) })),
  ];
  return <section className="dm-order-card"><h2>Документы по оплате</h2>{documents.length ? documents.map(doc => <div className="dm-order-document" key={doc.id}><div><strong>{doc.title}</strong><p>{doc.detail}</p></div><DmButton onClick={() => void download(doc.id)}>Скачать</DmButton></div>) : <p>Счёт и квитанции появятся здесь после загрузки.</p>}<p className="dm-order-muted">Документы по возвратам доступны во вкладке «Возвраты».</p></section>;
}
