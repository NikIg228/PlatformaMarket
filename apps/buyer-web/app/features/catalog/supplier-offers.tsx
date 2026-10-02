"use client";
import { useRef, useState } from "react";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { DmButton, StatusTag, errorMessage } from "@marketplace/ui";
import { useVerifiedSession, sessionApiContext } from "../../workspace-session";
import { formatCatalogMoney } from "../../catalog/catalog-view-model";
import { OfferDeliverySummary, type DeliverySummary } from "../../catalog/offer-delivery-summary";
import { deliveryLabel } from "../../catalog-ranking";
import styles from "./supplier-offers.module.css";

export type SupplierOffer = {
  id: string; supplier: { name: string }; priceMinor: string | null;
  normalizedPriceMinor?: string | null; currency: string;
  packaging?: { name: string; quantityInBaseUnit?: string; unit?: string | null };
  available: boolean; deliveryMethods?: string[]; delivery?: DeliverySummary[];
  verifiedDocuments?: boolean; officialDistributor?: boolean;
  minimumOrderQuantity?: string; orderIncrement?: string;
};

function quantityRules(offer: SupplierOffer) {
  return { min: Number(offer.minimumOrderQuantity ?? 1), step: Number(offer.orderIncrement ?? 1) };
}
function initialQuantity(offer: SupplierOffer) {
  const { min, step } = quantityRules(offer);
  return String(Number((Math.ceil(min / step - 1e-9) * step).toFixed(6)));
}
function validQuantity(value: string, offer: SupplierOffer) {
  const n = Number(value);
  const { min, step } = quantityRules(offer);
  return value.trim() !== "" && Number.isFinite(n) && n > 0 && n >= min && n <= 1_000_000 && step > 0
    && Math.abs(n / step - Math.round(n / step)) < 1e-7;
}

export function SupplierOffers({ offers, loginHref, compact = false }: {
  offers: SupplierOffer[]; loginHref: string; compact?: boolean;
}) {
  const { session, ready } = useVerifiedSession();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const add = async (offer: SupplierOffer) => {
    const raw = quantities[offer.id] ?? initialQuantity(offer);
    const quantity = Number(raw);
    if (lock.current || !ready || !offer.available || offer.priceMinor == null || !validQuantity(raw, offer)) return;
    if (!session?.organizationId) { window.location.assign(loginHref); return; }
    lock.current = true;
    setBusy(offer.id);
    setFeedback(null);
    try {
      const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", sessionApiContext);
      const carts = await api.listCarts(session.organizationId);
      const cart = carts.find(item => item.status === "ACTIVE" && item.currency === offer.currency)
        ?? await api.createCart(session.organizationId, { currency: offer.currency });
      await api.addCartItem(cart.id, { offerId: offer.id, quantity });
      setFeedback({ error: false, message: `${offer.supplier.name}: добавлено в корзину — ${quantity} ед. продажи.` });
    } catch (cause) { setFeedback({ error: true, message: errorMessage(cause) }); }
    finally { lock.current = false; setBusy(null); }
  };
  return <div className={`${styles.list} ${compact ? styles.compact : ""}`}>
    <p className={styles.hint}>Цена указана за единицу продажи. Окончательные условия доставки и оплаты — при оформлении заказа.</p>
    {feedback ? <div className={feedback.error ? styles.error : styles.success} role={feedback.error ? "alert" : "status"}>
      {feedback.message}{!feedback.error ? <a href={workspacePath("BUYER")}>Перейти в корзину</a> : null}
    </div> : null}
    {!offers.length ? <p>Предложения пока отсутствуют.</p> : offers.map(offer => {
      const { min, step } = quantityRules(offer);
      const quantity = quantities[offer.id] ?? initialQuantity(offer);
      const valid = validQuantity(quantity, offer);
      return <article className={styles.row} key={offer.id} aria-label={`Предложение: ${offer.supplier.name}`}>
        <div className={styles.supplier}>
          <strong>{offer.supplier.name}</strong>
          <StatusTag tone={offer.available ? "success" : "warning"}>{offer.available ? "В наличии" : "Под заказ"}</StatusTag>
          {offer.verifiedDocuments ? <small>Документы проверены</small> : null}
          {offer.officialDistributor ? <small>Официальный дистрибьютор</small> : null}
        </div>
        <div className={styles.conditions}>
          <small className={styles.label}>Фасовка</small>
          <span>{offer.packaging?.name || "Уточняется"}{offer.packaging?.quantityInBaseUnit && offer.packaging.unit ? ` · ${offer.packaging.quantityInBaseUnit} ${offer.packaging.unit}` : ""}</span>
          {min !== 1 || step !== 1 ? <small>Минимум {min} · кратность {step}</small> : null}
          <small className={styles.label}>Доставка</small>
          {offer.delivery ? <OfferDeliverySummary options={offer.delivery} currency={offer.currency} /> : <span>{deliveryLabel(offer.deliveryMethods ?? [])}</span>}
        </div>
        <div className={styles.price}>
          <strong>{formatCatalogMoney(offer.priceMinor, offer.currency)}</strong>
          <small>за единицу продажи</small>
          {offer.normalizedPriceMinor && offer.packaging?.unit && !(offer.packaging.quantityInBaseUnit === "1" && offer.normalizedPriceMinor === offer.priceMinor) ? <small>{formatCatalogMoney(offer.normalizedPriceMinor, offer.currency)} / {offer.packaging.unit}</small> : null}
        </div>
        <div className={styles.action}>
          {session?.organizationId ? <DmButton as="a" href={`/clinic/messages?contextType=OFFER&contextId=${offer.id}`}>Задать вопрос поставщику</DmButton> : null}
          <label>Количество<input type="number" min={min} step={step} max="1000000" value={quantity} disabled={busy !== null || !offer.available}
            aria-label={`Количество у ${offer.supplier.name}`} aria-invalid={!valid}
            onChange={e => setQuantities(current => ({ ...current, [offer.id]: e.target.value }))} /></label>
          {!valid ? <small role="alert">От {min}, кратно {step}, не более 1 000 000</small> : null}
          <DmButton appearance="primary" disabled={!ready || busy !== null || !valid || !offer.available || offer.priceMinor == null} onClick={() => void add(offer)}>
            {!ready ? "Проверяем вход…" : busy === offer.id ? "Добавляем…" : !offer.available ? "Под заказ" : offer.priceMinor == null ? "Нет цены" : session ? "В корзину" : "Войти и купить"}
          </DmButton>
        </div>
      </article>;
    })}
  </div>;
}
