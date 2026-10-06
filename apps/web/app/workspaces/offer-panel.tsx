"use client";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import { DmAction } from "@marketplace/ui/controls";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceOffer } from "@marketplace/schemas";
import { frontendFeatures } from "@marketplace/api-client";
import { OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, MenuItemLink } from "@fluentui/react-components";
import { DmButton, StatusTag, ProductThumbnail, usePermissions, useUnsavedChanges, formatStatus, formatMoney, formatDate } from "@marketplace/ui";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { MoreHorizontal24Regular } from "@fluentui/react-icons/svg/more-horizontal";
import { Tag24Regular } from "@fluentui/react-icons/svg/tag";
import { DocumentEdit24Regular } from "@fluentui/react-icons/svg/document-edit";
import { VehicleTruck24Regular } from "@fluentui/react-icons/svg/vehicle-truck";
import { OfferPanelEditor } from "./offer-panel-editor";
import { offerAttention } from "./offer-summary";
import local from "./offer-panel.module.css";

type Mode = "overview" | "price" | "delivery" | "settings";
const sourceLabel = (source: string) => ({ MANUAL: "Ручной ввод", IMPORT: "Импорт", API: "API", ERP: "ERP" }[source] ?? formatStatus(source));
export function OfferPanel({ offer, onClose, onChanged, initiallyEditing = false }: { offer: WorkspaceOffer | null; onClose: () => void; onChanged: () => Promise<void>; initiallyEditing?: boolean }) {
  const has = usePermissions();
  const [mode, setMode] = useState<Mode>(initiallyEditing ? "price" : "overview"), [dirty, setDirty] = useState(false);
  const editArea = useRef<HTMLDivElement>(null);
  const router = useRouter(), pendingNavigation = useRef<string | null>(null);
  const attention = offer ? offerAttention(offer) : null, price = offer?.prices.find(item => item.status === "ACTIVE");
  const manual = Boolean(offer && ["MANUAL", "IMPORT"].includes(offer.sourceType));
  const canEdit = has("catalog.product.view", "inventory.view", "catalog.offer.edit");
  const canPrice = canEdit && has("pricing.manage") && manual;
  useEffect(() => { setMode(initiallyEditing ? "price" : "overview"); setDirty(false); }, [offer?.id, initiallyEditing]);
  useUnsavedChanges(dirty);
  const discard = () => !dirty || window.confirm("Есть несохранённые условия. Продолжить без сохранения?");
  const close = () => { if (discard()) { setDirty(false); onClose(); } };
  const edit = (next: Mode) => {
    if (!discard()) return;
    setDirty(false); setMode(next);
    requestAnimationFrame(() => editArea.current?.focus());
  };
  const unit = offer?.saleUnit?.symbol ?? "ед.";
  return <OverlayDrawer open={Boolean(offer)} position="end" size="medium" className={local.drawer} onOpenChange={(_, data) => { if (!data.open) close(); }} surfaceMotion={{ onMotionFinish: (_, data) => { if (data.direction === "exit" && pendingNavigation.current) { const href = pendingNavigation.current; pendingNavigation.current = null; router.push(href); } } }}>
    <DrawerHeader className={local.header}><DrawerHeaderTitle action={<div className={local.headerActions}>
      {offer ? <Menu><MenuTrigger disableButtonEnhancement><DmButton appearance="subtle" aria-label="Действия с предложением" icon={<MoreHorizontal24Regular />} /></MenuTrigger><MenuPopover><MenuList>
        <MenuItemLink href={`/products/${offer.productVariant.product.id}`} target="_blank" rel="noopener noreferrer">Открыть карточку каталога ↗</MenuItemLink>
        {canEdit && manual ? <MenuItem onClick={() => edit("settings")}>Настройки предложения и публикация</MenuItem> : null}
      </MenuList></MenuPopover></Menu> : null}
      <DmButton appearance="subtle" aria-label="Закрыть предложение" icon={<Dismiss24Regular />} onClick={close} />
    </div>}>Предложение</DrawerHeaderTitle></DrawerHeader>
    <DrawerBody className={local.body} onClickCapture={event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = link?.getAttribute("href");
      if (!href?.startsWith("/") || link?.getAttribute("target") === "_blank") return;
      // Let Fluent release modal focus/aria hiding before the next route mounts.
      event.preventDefault();
      // The document capture handler in useUnsavedChanges already confirmed this link.
      pendingNavigation.current = href; setDirty(false); onClose();
    }}>{offer ? <div className={local.detail}>
      <div className={local.identity}><ProductThumbnail src={offer.productVariant.product.media?.[0]?.sourceUrl} name={offer.productVariant.product.canonicalName} /><div><h2>{offer.productVariant.product.canonicalName}</h2><p>{offer.supplierSku ? `Артикул ${offer.supplierSku}` : "Артикул не указан"} · {offer.packaging?.name ?? offer.saleUnit?.nameRu ?? "Упаковка не указана"}</p><StatusTag tone={offer.publication?.marketplaceVisible ? "success" : "neutral"}>{offer.publication?.marketplaceVisible ? "В каталоге" : formatStatus(offer.publication?.status ?? offer.status)}</StatusTag></div></div>
      {mode !== "overview" ? <div ref={editArea} tabIndex={-1} className={local.editor} onChangeCapture={() => setDirty(true)}>
        <DmButton appearance="subtle" onClick={() => edit("overview")}>← К предложению</DmButton>
        {(mode === "price" && !canPrice) || (mode === "settings" && (!canEdit || !manual)) ? <p role="status">{manual ? "Изменение цены недоступно вашей роли." : "Условия обновляются в подключённом источнике."}</p> : <OfferPanelEditor key={`${offer.id}:${mode}`} offer={offer} mode={mode} onSaved={() => setDirty(false)} onChanged={async () => { setDirty(false); await onChanged(); }} />}
      </div> : <>
        <section className={local.price} aria-label="Цена"><h3>Цена</h3><div className={local.priceRow}><div><strong>{price ? formatMoney(price.amountMinor, price.currency) : "Не задана"}{price ? <span> / {unit}</span> : null}</strong><p>{price ? price.includesVat ? "НДС включён" : "Без НДС" : "Укажите цену предложения"}</p></div>{canPrice ? <DmButton appearance="secondary" onClick={() => edit("price")}>Изменить цену</DmButton> : null}</div>
          <p className={local.freshness}>{sourceLabel(price?.source ?? offer.sourceType)} · {price?.freshnessExpiresAt ? `${Date.parse(price.freshnessExpiresAt) <= Date.now() ? "Подтверждение истекло" : "Подтверждена до"} ${formatDate(price.freshnessExpiresAt, true)}` : "Срок подтверждения не указан"}</p>
          {attention?.priceWarning ? <p className={local.warning}>{attention.priceWarning}</p> : null}
          {!manual ? <p className={local.freshness}>Цена обновляется в подключённом источнике.</p> : null}
          {offer.publication?.blockedReason ? <p className={local.warning}>{offer.publication.blockedReason}</p> : null}
        </section>
        <section aria-label="Остатки по складам"><h3>Остатки по складам</h3><div className={local.warehouses}>{offer.inventoryBalances.map(balance => <article key={balance.id}>
          <div className={local.warehouseTitle}><strong>{balance.warehouse.name}</strong><StatusTag tone={balance.freshnessStatus === "FRESH" && (!balance.freshnessExpiresAt || Date.parse(balance.freshnessExpiresAt) > Date.now()) ? "success" : "warning"}>{balance.freshnessExpiresAt && Date.parse(balance.freshnessExpiresAt) <= Date.now() ? "Нужно подтвердить" : formatStatus(balance.freshnessStatus)}</StatusTag></div>
          <dl><div><dt>На складе</dt><dd>{balance.quantityOnHand} {unit}</dd></div><div><dt>В резерве</dt><dd>{balance.quantityReserved} {unit}</dd></div><div><dt>Доступно</dt><dd><strong>{balance.quantityAvailable} {unit}</strong></dd></div></dl>
          <div className={local.stockActions}><small>Обновлено {formatDate(balance.updatedAt, true)}<span>{sourceLabel(balance.source)}{balance.freshnessExpiresAt ? ` · до ${formatDate(balance.freshnessExpiresAt, true)}` : ""}</span></small>{has("inventory.view") ? <Link {...dmLinkButtonProps()} href={`/supplier/products/inventory?offer=${offer.id}&balance=${balance.id}&warehouse=${balance.warehouseId}&edit=1`}>Обновить остатки</Link> : null}</div>
        </article>)}</div>{!offer.inventoryBalances.length ? <div className={local.empty}><p>Остатки ещё не указаны.</p>{has("inventory.view") ? <Link {...dmLinkButtonProps()} href={`/supplier/products/inventory?offer=${offer.id}&edit=1`}>Обновить остатки</Link> : null}</div> : null}</section>
        <section><h3>Условия продажи</h3><dl className={local.orderTerms}><div><dt>Единица продажи</dt><dd>{offer.packaging ? `${offer.packaging.name} (${offer.packaging.quantityInBaseUnit} ${offer.packaging.unit.symbol})` : `1 ${unit}`}</dd></div><div><dt>Минимальный заказ</dt><dd>{offer.minimumOrderQuantity} {unit}</dd></div><div><dt>Шаг заказа</dt><dd>{offer.orderIncrement} {unit}</dd></div></dl></section>
        <nav aria-label="Действия с товаром" className={local.related}>
          {has("delivery.view", "delivery.manage") ? <DmAction variant="row" type="button" onClick={() => edit("delivery")}><VehicleTruck24Regular aria-hidden /><span>Настроить доставку</span><span aria-hidden>›</span></DmAction> : null}
          {frontendFeatures.promotions && has("promotion.view", "promotion.manage") ? <Link href={`/supplier/products/promotions?mode=new&offer=${offer.id}`}><Tag24Regular aria-hidden /><span>Создать акцию</span><span aria-hidden>›</span></Link> : null}
          {has("catalog.product.view", "catalog.offer.edit") ? <Link href={`/supplier/products/corrections?mode=new&offer=${offer.id}`}><DocumentEdit24Regular aria-hidden /><span>Предложить исправление карточки</span><span aria-hidden>›</span></Link> : null}
        </nav>
      </>}
    </div> : null}</DrawerBody>
  </OverlayDrawer>;
}
