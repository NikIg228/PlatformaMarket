"use client";
import { useEffect, useState } from "react";
import type { WorkspaceOffer } from "@marketplace/schemas";
import { OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, DrawerFooter } from "@fluentui/react-components";
import { DmButton, StatusTag, usePermissions, formatStatus } from "@marketplace/ui";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { ManualOffer } from "../../../supplier-web/app/features/supplier-workspace/manual-offer";
import { useWorkspace } from "./workspace";
import { OfferPrice, OfferSaleUnit, OfferStock } from "./offer-information";
import { offerAttention } from "./offer-summary";
import styles from "./products.module.css";

export function OfferPanel({ offer, onClose, onChanged }: { offer: WorkspaceOffer | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const { api, organizationId } = useWorkspace();
  const has = usePermissions();
  const [editing, setEditing] = useState(false);
  const attention = offer ? offerAttention(offer) : null;
  useEffect(() => setEditing(false), [offer?.id]);
  return <OverlayDrawer open={Boolean(offer)} position="end" size="medium" className={styles.drawer} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
    <DrawerHeader><DrawerHeaderTitle action={<DmButton appearance="subtle" aria-label="Закрыть предложение" icon={<Dismiss24Regular />} onClick={onClose} />}>Предложение</DrawerHeaderTitle></DrawerHeader>
    <DrawerBody>{offer ? <div className={styles.detail}>
      <div><h2>{offer.productVariant.product.canonicalName}</h2><p>{offer.supplierSku ?? "Без артикула"}</p><StatusTag tone={offer.publication?.marketplaceVisible ? "success" : "neutral"}>{offer.publication?.marketplaceVisible ? "В каталоге" : formatStatus(offer.publication?.status ?? offer.status)}</StatusTag></div>
      {editing ? <ManualOffer key={offer.id} initiallyOpen api={api} supplierId={organizationId} initialOffer={offer} onChanged={onChanged} /> : <>
        {attention?.priceWarning || attention?.stockWarning ? <div className={styles.attention}>{[attention.priceWarning, attention.stockWarning].filter(Boolean).join(" · ")}</div> : null}
        <section><h3>Цена</h3><OfferPrice offer={offer} /></section>
        <section><h3>Остатки по складам</h3><OfferStock offer={offer} /></section>
        <section><h3>Упаковка и заказ</h3><OfferSaleUnit offer={offer} /></section>
        <section><h3>Публикация</h3><p>{offer.publication?.marketplaceVisible ? "В каталоге" : formatStatus(offer.publication?.status ?? offer.status)}</p>{offer.publication?.blockedReason ? <p>{offer.publication.blockedReason}</p> : null}</section>
      </>}
    </div> : null}</DrawerBody>
    {!editing && offer ? <DrawerFooter className={styles.drawerFooter}>{has("catalog.product.view", "inventory.view") ? <DmButton appearance="primary" onClick={() => setEditing(true)}>Изменить предложение</DmButton> : null}<DmButton onClick={onClose}>Закрыть</DmButton></DrawerFooter> : null}
  </OverlayDrawer>;
}
