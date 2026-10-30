"use client";
import { DmInput } from "@marketplace/ui/controls";
import type { OrganizationContact } from "@marketplace/schemas";
import { useRef, useState } from "react";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { ActionFeedback, DmButton, StatusTag, actionFailure } from "@marketplace/ui";
import { useVerifiedSession, sessionApiContext } from "../../workspace-session";
import { formatCatalogMoney } from "../../catalog/catalog-view-model";
import { OfferDeliverySummary, type DeliverySummary } from "../../catalog/offer-delivery-summary";
import { deliveryLabel } from "../../catalog-ranking";
import styles from "./supplier-offers.module.css";
import { saleTotal } from "../product-detail/model";
import { Add24Regular } from "@fluentui/react-icons/svg/add";
import { Subtract24Regular } from "@fluentui/react-icons/svg/subtract";
import { SupplierQuestion } from "./supplier-question";
import { SupplierIdentity } from "./supplier-identity";
import { quantityRules, initialQuantity, validQuantity, clampQuantityInput, MAX_SUPPLIER_QUANTITY } from "./supplier-quantity";

export type SupplierOffer = {
  id: string; supplier: { id?: string; organizationId?: string; name: string; logoUrl?: string | null; publicContact?: OrganizationContact | null }; priceMinor: string | null;
  normalizedPriceMinor?: string | null; currency: string;
  packaging?: { name: string; quantityInBaseUnit?: string; unit?: string | null };
  available: boolean; deliveryMethods?: string[]; delivery?: DeliverySummary[];
  verifiedDocuments?: boolean; officialDistributor?: boolean;
  minimumOrderQuantity?: string; orderIncrement?: string;
};

export function SupplierOffers({ offers, loginHref, compact = false, productName, comparison = false, imageUrl }: {
  offers: SupplierOffer[]; loginHref: string; compact?: boolean; productName?: string; comparison?: boolean; imageUrl?: string;
}) {
  const { session, ready } = useVerifiedSession();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  const [question, setQuestion] = useState<SupplierOffer | null>(null);
  const questionTrigger = useRef<HTMLElement | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "warning"; title: string; description: string } | null>(null);
  const add = async (offer: SupplierOffer) => {
    const raw = quantities[offer.id] ?? initialQuantity(offer);
    const quantity = Number(raw);
    if (lock.current || !ready || !offer.available || offer.priceMinor == null || !validQuantity(raw, offer)) return;
    if (!session?.organizationId) { window.location.assign(loginHref); return; }
    if (!navigator.onLine) { setFeedback({ tone: "warning", title: "Нет подключения к сети", description: "Не удалось проверить актуальные цены и наличие." }); return; }
    lock.current = true;
    setBusy(offer.id);
    setFeedback(null);
    let writing = false;
    try {
      const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", sessionApiContext);
      const carts = await api.listCarts(session.organizationId);
      let cart = carts.find(item => item.status === "ACTIVE" && item.currency === offer.currency);
      if (!cart) { writing = true; cart = await api.createCart(session.organizationId, { currency: offer.currency }); writing = false; }
      writing = true;
      await api.addCartItem(cart.id, { offerId: offer.id, quantity });
      setFeedback({ tone: "success", title: "Добавлено в корзину", description: `${productName ?? offer.supplier.name} · ${quantity} ед. продажи${offer.packaging?.name ? ` (${offer.packaging.name})` : ""}.` });
    } catch (cause) {
      const failure = actionFailure(cause, { write: writing, title: "Не удалось добавить товар" });
      setFeedback({ ...failure, ...(failure.title === "Результат пока неизвестен" ? { description: "Проверьте корзину перед повторным добавлением." } : {}) });
    }
    finally { lock.current = false; setBusy(null); }
  };
  return <div className={`${styles.list} ${compact ? styles.compact : ""} ${comparison ? styles.comparison : ""}`}>
    <SupplierQuestion key={session?.organizationId ?? "guest"} offer={question} productName={productName} imageUrl={imageUrl} onClose={() => setQuestion(null)} onClosed={() => questionTrigger.current?.focus({ preventScroll: true })} />
    {!comparison || offers.length ? <p className={styles.hint}>Цена указана за единицу продажи. Окончательные условия доставки и оплаты — при оформлении заказа.</p> : null}
    {comparison && offers.length ? <div className={styles.columnHeadings} aria-hidden="true"><span>Поставщик</span><span>Наличие и доставка</span><span>Цена за единицу</span><span>Количество и покупка</span></div> : null}
    {feedback ? <ActionFeedback {...feedback} action={feedback.tone === "success" || feedback.title === "Результат пока неизвестен" ? <a href={workspacePath("BUYER", "/cart")}>Перейти в корзину</a> : undefined} /> : null}
    {!offers.length ? comparison ? null : <p>Предложения пока отсутствуют.</p> : offers.map(offer => {
      const { min, step } = quantityRules(offer);
      const quantity = quantities[offer.id] ?? initialQuantity(offer);
      const valid = validQuantity(quantity, offer);
      const changeQuantity = (direction: number) => setQuantities(current => ({ ...current, [offer.id]: String(Number((Math.max(Number(initialQuantity(offer)), (Number(quantity) || Number(initialQuantity(offer))) + direction * step)).toFixed(6))) }));
      const total = valid && offer.priceMinor != null ? saleTotal(offer.priceMinor, quantity) : null;
      return <article className={styles.row} key={offer.id} aria-label={`Предложение: ${offer.supplier.name}`}>
        <div className={styles.supplier}>
          <SupplierIdentity supplier={offer.supplier} />
          {offer.supplier.publicContact ? <div className={styles.contact} aria-label="Официальный контакт поставщика">
            <span>{offer.supplier.publicContact.contactName}</span>
            <a href={`tel:${offer.supplier.publicContact.phone.replace(/[^+\d]/g, "")}`}>{offer.supplier.publicContact.phone}</a>
            <a href={`mailto:${offer.supplier.publicContact.email}`}>{offer.supplier.publicContact.email}</a>
          </div> : null}
          {!comparison ? <StatusTag tone={offer.available ? "success" : "warning"}>{offer.available ? "В наличии" : "Под заказ"}</StatusTag> : null}
          {offer.verifiedDocuments ? <small>Документы проверены</small> : null}
          {offer.officialDistributor ? <small>Официальный дистрибьютор</small> : null}
        </div>
        <div className={styles.conditions}>
          {comparison ? <StatusTag tone={offer.available ? "success" : "warning"}>{offer.available ? "В наличии" : "Нет актуального наличия"}</StatusTag> : <><small className={styles.label}>Фасовка</small>
          <span>{offer.packaging?.name || "Уточняется"}{offer.packaging?.quantityInBaseUnit && offer.packaging.unit ? ` · ${offer.packaging.quantityInBaseUnit} ${offer.packaging.unit}` : ""}</span></>}
          {min !== 1 || step !== 1 ? <small>Минимум {min} · кратность {step}</small> : null}
          {!comparison ? <small className={styles.label}>Доставка</small> : null}
          {offer.delivery ? <OfferDeliverySummary options={offer.delivery} currency={offer.currency} /> : <span>{deliveryLabel(offer.deliveryMethods ?? [])}</span>}
        </div>
        <div className={styles.price}>
          <strong>{formatCatalogMoney(offer.priceMinor, offer.currency)}</strong>
          <small>за единицу продажи</small>
          {offer.normalizedPriceMinor && offer.packaging?.unit && !(offer.packaging.quantityInBaseUnit === "1" && offer.normalizedPriceMinor === offer.priceMinor) ? <small>{formatCatalogMoney(offer.normalizedPriceMinor, offer.currency)} / {offer.packaging.unit}</small> : null}
        </div>
        <div className={styles.action}>
          {session?.organizationId && !comparison ? <DmButton onClick={event => { questionTrigger.current = event.currentTarget; setQuestion(offer); }}>Задать вопрос поставщику</DmButton> : null}
          <div className={styles.quantityRow}>
          {comparison ? <DmButton icon={<Subtract24Regular />} aria-label={`Уменьшить количество у ${offer.supplier.name}`} disabled={busy !== null || !offer.available || !valid || Number(quantity) <= Number(initialQuantity(offer))} onClick={() => changeQuantity(-1)} /> : null}
          <label>{comparison ? null : "Количество"}<DmInput quantity={comparison} className={comparison ? undefined : styles.quantity} type="number" min={min} step={step} max={MAX_SUPPLIER_QUANTITY} value={quantity} disabled={busy !== null || !offer.available}
            aria-label={`Количество у ${offer.supplier.name}`} aria-invalid={!valid}
            onChange={e => {
              const value = clampQuantityInput(e.target.value);
              e.target.value = value;
              setQuantities(current => ({ ...current, [offer.id]: value }));
            }} /></label>
          {comparison ? <DmButton icon={<Add24Regular />} aria-label={`Увеличить количество у ${offer.supplier.name}`} disabled={busy !== null || !offer.available || !valid || Number(quantity) + step > MAX_SUPPLIER_QUANTITY} onClick={() => changeQuantity(1)} /> : null}
          </div>
          {!valid ? <small className={styles.quantityNote} role="alert">от 1 до 100 штук</small> : null}
          {comparison && total ? <small className={styles.quantityNote}>Предварительно: {formatCatalogMoney(total, offer.currency)}. Скидки — в корзине.</small> : null}
          <DmButton className={comparison ? styles.buy : undefined} appearance="primary" disabled={!ready || busy !== null || !valid || !offer.available || offer.priceMinor == null} onClick={() => void add(offer)}>
            {!ready ? "Проверяем вход…" : busy === offer.id ? "Добавляем…" : !offer.available ? comparison ? "Недоступно" : "Под заказ" : offer.priceMinor == null ? "Нет цены" : session ? "В корзину" : "Войти и купить"}
          </DmButton>
          {session?.organizationId && comparison ? <DmButton appearance="subtle" className={styles.question} onClick={event => { questionTrigger.current = event.currentTarget; setQuestion(offer); }}>Задать вопрос</DmButton> : null}
        </div>
      </article>;
    })}
  </div>;
}
