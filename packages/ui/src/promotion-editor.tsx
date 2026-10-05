"use client";
import { useRef, useState } from "react";
import type { OfferPromotion, PromotionTerms, WorkspaceOffer } from "@marketplace/schemas";
import { promotionTermsSchema } from "@marketplace/schemas/promotions";
import { DmButton, DmField, DmInput, DmDropdown as DmSelect, DmTextarea, ErrorState, Section, errorMessage, formatMoney, formatDate } from "./index";
import { promotionLocalDate, type PromotionWorkspaceApi } from "./promotion-workspace-types";
import { promotionPreviewPrice, promotionDiscountFromPrice, promotionPriceText } from "./promotion-preview";
import styles from "./promotion-editor.module.css";

function OfferPicker({ api, label, value, name, disabled, onChange, onOffer }: { api: PromotionWorkspaceApi; label: string; value: string; name?: string; disabled: boolean; onChange: (value: string) => void; onOffer?: (offer: WorkspaceOffer | null) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WorkspaceOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const search = async () => {
    setLoading(true); setError(null);
    try { setItems((await api.workspaceOffers({ q: query, limit: 25 })).items); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  };
  return <div className="mp-stack">
    <DmField label={`Поиск: ${label}`}><DmInput value={query} disabled={disabled || loading} onChange={(_, data) => setQuery(data.value)} /></DmField>
    <DmButton type="button" disabled={disabled || loading} onClick={() => void search()}>{loading ? "Ищем…" : `Найти: ${label}`}</DmButton>
    {error ? <ErrorState description={error} /> : null}
    <DmField label={label} required><DmSelect value={value} disabled={disabled} onChange={(_, data) => { onChange(data.value); onOffer?.(items.find(item => item.id === data.value) ?? null); }}>
      <option value="">Выберите предложение из результатов поиска</option>
      {value && !items.some(item => item.id === value) ? <option value={value}>{name ?? "Выбранное предложение"}</option> : null}
      {items.map(item => <option key={item.id} value={item.id}>{item.productVariant.product.canonicalName} · {item.supplierSku ?? item.id.slice(0, 8)}</option>)}
    </DmSelect></DmField>
    <small>Первые 25 совпадений. Уточните название, если нужного предложения нет.</small>
  </div>;
}

export function PromotionEditor({ api, selected, template, onSaved, onClose }: { api: PromotionWorkspaceApi; selected?: OfferPromotion; template?: OfferPromotion; onSaved: () => Promise<void>; onClose: () => void }) {
  const original = selected ?? template;
  const [terms, setTerms] = useState<PromotionTerms>(() => original ? { ...original.terms, ...(template ? { startsAt: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), endsAt: new Date(Math.floor(Date.now() / 60000) * 60000 + 7 * 86400000).toISOString() } : {}) } : {
    offerId: "", name: "", description: "", kind: "FIXED_AMOUNT", percentageBasisPoints: null, fixedAmountMinor: null,
    buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "1", quantityLimit: "100", startsAt: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), endsAt: new Date(Math.floor(Date.now() / 60000) * 60000 + 7 * 86400000).toISOString(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [offer, setOffer] = useState<WorkspaceOffer | null>(null);
  const [salePrice, setSalePrice] = useState(promotionPriceText(original?.unitPriceMinor));
  const currentPrice = offer?.prices.find(item => item.status === "ACTIVE");
  const baseMinor = currentPrice?.amountMinor ?? (original?.terms.offerId === terms.offerId ? original.evidence.baseAmountMinor : null);
  const currency = currentPrice?.currency ?? original?.currency ?? "KZT";
  const previewPrice = promotionPreviewPrice(terms, baseMinor);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef<{ body: string; key: string } | null>(null);
  const change = <K extends keyof PromotionTerms>(key: K, value: PromotionTerms[K]) => setTerms(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (pending.current) return;
    const parsed = promotionTermsSchema.safeParse(terms);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    pending.current = true; setBusy(true); setErrors({}); setError(null);
    const body = JSON.stringify(parsed.data);
    if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
    try {
      if (selected) await api.reviseOfferPromotion(selected.id, { terms: parsed.data, expectedVersion: selected.version, idempotencyKey: request.current.key });
      else await api.createOfferPromotion({ terms: parsed.data, sourceTemplateId: template?.id, idempotencyKey: request.current.key });
      await onSaved(); onClose();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  };
  const field = (key: "name" | "minimumQuantity" | "quantityLimit" | "buyQuantity" | "giftQuantity" | "fixedAmountMinor", label: string) => <DmField label={label} required validationMessage={errors[key]} validationState={errors[key] ? "error" : "none"}><DmInput disabled={busy} value={terms[key] ?? ""} inputMode={key === "name" ? "text" : "decimal"} onChange={(_, data) => change(key, data.value)} /></DmField>;
  return <Section className={styles.section} title={selected ? "Новая версия условий" : template ? "Черновик из шаблона" : "Новая акция"} description="После сохранения отправьте версию оператору. Изменение условий снимает прежнее согласование.">
    <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className={styles.fields}>
      {error ? <ErrorState description={error} /> : null}
      <OfferPicker api={api} label="Товар акции" value={terms.offerId} name={original?.offerName} disabled={busy || Boolean(selected)} onChange={value => change("offerId", value)} onOffer={value => { setOffer(value); setSalePrice(""); setTerms(current => ({ ...current, fixedAmountMinor: null, percentageBasisPoints: null })); }} />
      {errors.offerId ? <p role="alert">{errors.offerId}</p> : null}
      {field("name", "Название акции")}
      <DmField label="Описание условий"><DmTextarea disabled={busy} value={terms.description} onChange={(_, data) => change("description", data.value)} /></DmField>
      <DmField label="Механика"><DmSelect disabled={busy} value={terms.kind === "BUY_X_GET_Y" ? "BUY_X_GET_Y" : "DISCOUNT"} onChange={(_, data) => { setSalePrice(""); setTerms(current => ({ ...current, kind: data.value === "BUY_X_GET_Y" ? "BUY_X_GET_Y" : "FIXED_AMOUNT", fixedAmountMinor: null, percentageBasisPoints: null })); }}><option value="DISCOUNT">Скидка</option><option value="BUY_X_GET_Y">N + M в подарок</option></DmSelect></DmField>
      {terms.kind !== "BUY_X_GET_Y" ? <DmField label="Акционная цена, ₸" required validationMessage={errors.fixedAmountMinor || errors.percentageBasisPoints ? "Укажите положительную цену ниже обычной." : undefined} validationState={errors.fixedAmountMinor || errors.percentageBasisPoints ? "error" : "none"} hint={baseMinor ? `Обычная цена: ${formatMoney(baseMinor, currency)}` : "Сначала выберите предложение с действующей ценой."}><DmInput inputMode="decimal" disabled={busy || !baseMinor} value={salePrice} onChange={(_, data) => { setSalePrice(data.value); setTerms(current => ({ ...current, kind: "FIXED_AMOUNT", percentageBasisPoints: null, fixedAmountMinor: promotionDiscountFromPrice(data.value, baseMinor) })); }} /></DmField> : null}
      {terms.kind === "BUY_X_GET_Y" ? <>{field("buyQuantity", "Количество покупки N")}<OfferPicker api={api} label="Подарок" value={terms.giftOfferId ?? ""} disabled={busy} onChange={value => change("giftOfferId", value)} />{errors.giftOfferId ? <p role="alert">{errors.giftOfferId}</p> : null}{field("giftQuantity", "Количество подарка M")}</> : null}
      {field("minimumQuantity", "Минимальное количество покупки")}{field("quantityLimit", "Общий лимит количества по акции")}
      {(["startsAt", "endsAt"] as const).map(key => <DmField key={key} label={key === "startsAt" ? "Начало (местное время)" : "Окончание (местное время)"} required validationMessage={errors[key]} validationState={errors[key] ? "error" : "none"}><DmInput type="datetime-local" disabled={busy} value={terms[key] ? promotionLocalDate(terms[key]) : ""} onChange={(_, data) => change(key, data.value ? new Date(data.value).toISOString() : "")} /></DmField>)}
      <div className={styles.actions}><DmButton type="submit" appearance="primary" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить черновик"}</DmButton><DmButton type="button" disabled={busy} onClick={onClose}>Отмена</DmButton></div>
      </div>
      <aside className={styles.preview} aria-label="Предпросмотр акции"><h3>Предпросмотр</h3><p>{terms.name || "Название акции"}</p><p>{offer?.productVariant.product.canonicalName ?? original?.offerName ?? "Выберите товар"}</p>
        {terms.kind === "BUY_X_GET_Y" ? <strong>За {terms.buyQuantity || "N"} — {terms.giftQuantity || "M"} в подарок</strong> : previewPrice ? <><p><s>{formatMoney(baseMinor!, currency)}</s></p><strong>{formatMoney(previewPrice, currency)}</strong></> : <p>Выберите предложение и укажите размер скидки.</p>}
        <p>От {terms.minimumQuantity || "—"} ед. · лимит {terms.quantityLimit || "—"} ед.</p>
        {terms.startsAt && terms.endsAt ? <p>{formatDate(terms.startsAt)} — {formatDate(terms.endsAt)}</p> : null}
        <p>После сохранения отправьте акцию на согласование. Цена и условия будут проверены повторно.</p>
      </aside>
    </form>
  </Section>;
}
