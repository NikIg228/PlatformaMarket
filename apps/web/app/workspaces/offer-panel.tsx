"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceOffer } from "@marketplace/schemas";
import { frontendFeatures } from "@marketplace/api-client";
import { OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, DrawerFooter } from "@fluentui/react-components";
import { DmButton, StatusTag, ProductThumbnail, usePermissions, useUnsavedChanges, formatStatus, formatMoney, formatDate, productWorkflowStyles as workflow } from "@marketplace/ui";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { Tag24Regular } from "@fluentui/react-icons/svg/tag";
import { DocumentEdit24Regular } from "@fluentui/react-icons/svg/document-edit";
import { ManualOffer } from "../../../supplier-web/app/features/supplier-workspace/manual-offer";
import { useWorkspace } from "./workspace";
import { OfferPrice, OfferStock, OfferSaleUnit } from "./offer-information";
import { offerAttention, totalAvailable } from "./offer-summary";
import styles from "./products.module.css";
import local from "./offer-panel.module.css";

export function OfferPanel({ offer, onClose, onChanged, initiallyEditing = false }: { offer: WorkspaceOffer | null; onClose: () => void; onChanged: () => Promise<void>; initiallyEditing?: boolean }) {
  const { api, organizationId } = useWorkspace(), has = usePermissions();
  const [editing, setEditing] = useState(initiallyEditing), [dirty, setDirty] = useState(false);
  const editArea = useRef<HTMLDivElement>(null);
  const router = useRouter(), pendingNavigation = useRef<string | null>(null);
  const attention = offer ? offerAttention(offer) : null, price = offer?.prices.find(item => item.status === "ACTIVE");
  const manual = Boolean(offer && ["MANUAL", "IMPORT"].includes(offer.sourceType));
  const firstBalance = offer?.inventoryBalances[0];
  const stockHref = `/supplier/products/inventory?offer=${offer?.id}&edit=1${firstBalance ? `&balance=${firstBalance.id}&warehouse=${firstBalance.warehouseId}` : ""}`;
  const canEdit = has("catalog.product.view", "inventory.view", "catalog.offer.edit");
  useEffect(() => { setEditing(initiallyEditing); setDirty(false); }, [offer?.id, initiallyEditing]);
  useUnsavedChanges(dirty);
  const close = () => { if (!dirty || window.confirm("Есть несохранённые условия. Закрыть предложение?")) { setDirty(false); onClose(); } };
  const edit = () => { setEditing(true); requestAnimationFrame(() => editArea.current?.querySelector<HTMLElement>("input,button")?.focus()); };
  return <OverlayDrawer open={Boolean(offer)} position="end" size="medium" className={styles.drawer} onOpenChange={(_, data) => { if (!data.open) close(); }} surfaceMotion={{ onMotionFinish: (_, data) => { if (data.direction === "exit" && pendingNavigation.current) { const href = pendingNavigation.current; pendingNavigation.current = null; router.push(href); } } }}>
    <DrawerHeader><DrawerHeaderTitle action={<DmButton appearance="subtle" aria-label="Закрыть предложение" icon={<Dismiss24Regular />} onClick={close} />}>{editing ? "Условия предложения" : "Товар"}</DrawerHeaderTitle></DrawerHeader>
    <DrawerBody onClickCapture={event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = link?.getAttribute("href");
      if (!href?.startsWith("/") || link?.getAttribute("target") === "_blank") return;
      // Let Fluent release modal focus/aria hiding before the next route mounts.
      event.preventDefault(); pendingNavigation.current = href; setDirty(false); onClose();
    }}>{offer ? <div className={styles.detail}>
      <div className={local.identity}><ProductThumbnail src={offer.productVariant.product.media?.[0]?.sourceUrl} name={offer.productVariant.product.canonicalName} /><div><h2>{offer.productVariant.product.canonicalName}</h2><p>{offer.supplierSku ? `Артикул ${offer.supplierSku}` : "Артикул не указан"} · {offer.packaging?.name ?? offer.saleUnit?.nameRu ?? "Упаковка не указана"}</p><StatusTag tone={offer.publication?.marketplaceVisible ? "success" : "neutral"}>{offer.publication?.marketplaceVisible ? "В каталоге" : formatStatus(offer.publication?.status ?? offer.status)}</StatusTag><Link className={local.publicLink} href={`/products/${offer.productVariant.product.id}`}>Открыть карточку каталога <span aria-hidden>↗</span></Link></div></div>
      {editing ? <div ref={editArea} onChangeCapture={() => setDirty(true)}><ManualOffer key={offer.id} hideHeading initiallyOpen stockEditable={false} api={api} supplierId={organizationId} initialOffer={offer} onChanged={async () => { setDirty(false); await onChanged(); }} /></div> : <>
        <div className={local.metrics}><div><span>Цена за {offer.saleUnit?.symbol ?? "единицу"}</span><strong>{price ? formatMoney(price.amountMinor, price.currency) : "Не задана"}</strong><small>{price ? price.includesVat ? "НДС включён" : "Без НДС" : "Укажите цену"}</small></div><div><span>Доступно</span><strong>{offer.inventoryBalances.length ? totalAvailable(offer) : "—"} <em>{offer.saleUnit?.symbol ?? ""}</em></strong><small>На всех складах</small></div></div>
        {attention?.needsAttention ? <div className={styles.attention}><div>{[attention.priceWarning, attention.stockWarning, offer.publication?.blockedReason].filter(Boolean).join(" · ")}</div>{attention.stockWarning && has("inventory.view") ? <Link href={stockHref}>Обновить остатки</Link> : canEdit && manual ? <DmButton appearance="subtle" onClick={edit}>Проверить условия</DmButton> : <p className={workflow.hint}>{manual ? "Обратитесь к сотруднику с правом изменения условий." : "Условия обновляются в подключённом источнике."}</p>}</div> : null}
        <div><h3>Условия продажи</h3><div className={local.orderTerms}><div><span>Минимальный заказ</span><strong>{offer.minimumOrderQuantity} {offer.saleUnit?.symbol}</strong></div><div><span>Шаг заказа</span><strong>{offer.orderIncrement} {offer.saleUnit?.symbol}</strong></div></div></div>
        <section><h3>Остатки по складам</h3>{offer.inventoryBalances.length ? <div className={local.warehouses}>{offer.inventoryBalances.map(balance => <article key={balance.id}><div className={local.warehouseTitle}><strong>{balance.warehouse.name}</strong><StatusTag tone={balance.freshnessStatus === "FRESH" && (!balance.freshnessExpiresAt || Date.parse(balance.freshnessExpiresAt) > Date.now()) ? "success" : "warning"}>{balance.freshnessExpiresAt && Date.parse(balance.freshnessExpiresAt) <= Date.now() ? "Нужно подтвердить" : formatStatus(balance.freshnessStatus)}</StatusTag></div><dl><div><dt>На складе</dt><dd>{balance.quantityOnHand}</dd></div><div><dt>В резерве</dt><dd>{balance.quantityReserved}</dd></div><div><dt>Доступно</dt><dd>{balance.quantityAvailable}</dd></div></dl><div className={local.links}>{has("inventory.view") ? <><Link href={`/supplier/products/inventory?offer=${offer.id}&balance=${balance.id}&warehouse=${balance.warehouseId}&edit=1`}>Обновить остатки</Link></> : null}<small>{formatDate(balance.updatedAt, true)}</small></div></article>)}</div> : <p className={workflow.hint}>Остатки ещё не указаны.</p>}</section>
        <div><h3>Связанные действия</h3><div className={local.related}>{frontendFeatures.promotions && has("promotion.view", "promotion.manage") ? <Link href={`/supplier/products/promotions?mode=new&offer=${offer.id}`} aria-label="Создать акцию"><Tag24Regular aria-hidden /><div><strong>Создать акцию</strong><small>Установить специальные условия на этот товар</small></div><span aria-hidden>→</span></Link> : null}{has("catalog.product.view", "catalog.offer.edit") ? <Link href={`/supplier/products/corrections?mode=new&offer=${offer.id}`} aria-label="Предложить исправление карточки"><DocumentEdit24Regular aria-hidden /><div><strong>Предложить исправление карточки</strong><small>Сообщить о неточности в данных</small></div><span aria-hidden>→</span></Link> : null}</div></div>
        {!offer.inventoryBalances.length && has("inventory.view") ? <Link href={stockHref}>Обновить остатки</Link> : null}
        <details className={local.disclosure}><summary>Источники и актуальность данных</summary><p>Источник предложения: {formatStatus(offer.sourceType)}</p><OfferPrice offer={offer} /><OfferStock offer={offer} /><OfferSaleUnit offer={offer} /></details>
      </>}
    </div> : null}</DrawerBody>
    {offer ? <DrawerFooter className={`${styles.drawerFooter} ${local.footer}`}>{!editing && canEdit ? <DmButton appearance="primary" onClick={edit}>Изменить условия</DmButton> : editing ? <DmButton onClick={() => { if (!dirty || window.confirm("Вернуться без сохранения условий?")) { setEditing(false); setDirty(false); } }}>К просмотру товара</DmButton> : null}</DrawerFooter> : null}
  </OverlayDrawer>;
}
