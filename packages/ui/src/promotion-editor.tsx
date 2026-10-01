"use client";
import { useRef, useState } from "react";
import type { OfferPromotion, PromotionTerms, WorkspaceOffer } from "@marketplace/schemas";
import { promotionTermsSchema } from "@marketplace/schemas/promotions";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea, ErrorState, Section, errorMessage } from "./index";
import { promotionLocalDate, type PromotionWorkspaceApi } from "./promotion-workspace-types";

function OfferPicker({ api, label, value, name, disabled, onChange }: { api: PromotionWorkspaceApi; label: string; value: string; name?: string; disabled: boolean; onChange: (value: string) => void }) {
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
    <DmButton disabled={disabled || loading} onClick={() => void search()}>{loading ? "Ищем…" : `Найти: ${label}`}</DmButton>
    {error ? <ErrorState description={error} /> : null}
    <DmField label={label} required><DmSelect value={value} disabled={disabled} onChange={(_, data) => onChange(data.value)}>
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
    offerId: "", name: "", description: "", kind: "PERCENTAGE", percentageBasisPoints: 1000, fixedAmountMinor: null,
    buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "1", quantityLimit: "100", startsAt: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), endsAt: new Date(Math.floor(Date.now() / 60000) * 60000 + 7 * 86400000).toISOString(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
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
  return <Section title={selected ? "Новая версия условий" : template ? "Черновик из шаблона" : "Новая акция"} description="После сохранения отправьте версию оператору. Изменение условий снимает прежнее согласование.">
    <form className="mp-stack" onSubmit={event => { event.preventDefault(); void save(); }}>
      {error ? <ErrorState description={error} /> : null}
      <OfferPicker api={api} label="Товар акции" value={terms.offerId} name={original?.offerName} disabled={busy || Boolean(selected)} onChange={value => change("offerId", value)} />
      {errors.offerId ? <p role="alert">{errors.offerId}</p> : null}
      {field("name", "Название акции")}
      <DmField label="Описание условий"><DmTextarea disabled={busy} value={terms.description} onChange={(_, data) => change("description", data.value)} /></DmField>
      <DmField label="Механика"><DmSelect disabled={busy} value={terms.kind} onChange={(_, data) => change("kind", data.value as PromotionTerms["kind"])}><option value="PERCENTAGE">Процентная скидка</option><option value="FIXED_AMOUNT">Фиксированная скидка</option><option value="BUY_X_GET_Y">N + M в подарок</option></DmSelect></DmField>
      {terms.kind === "PERCENTAGE" ? <DmField label="Скидка, %" validationMessage={errors.percentageBasisPoints} validationState={errors.percentageBasisPoints ? "error" : "none"}><DmInput type="number" min={0.01} max={90} step={0.01} disabled={busy} value={String((terms.percentageBasisPoints ?? 0) / 100)} onChange={(_, data) => change("percentageBasisPoints", Math.round(Number(data.value) * 100))} /></DmField> : null}
      {terms.kind === "FIXED_AMOUNT" ? field("fixedAmountMinor", "Скидка за единицу, в тиынах (100 = 1 ₸)") : null}
      {terms.kind === "BUY_X_GET_Y" ? <>{field("buyQuantity", "Количество покупки N")}<OfferPicker api={api} label="Подарок" value={terms.giftOfferId ?? ""} disabled={busy} onChange={value => change("giftOfferId", value)} />{errors.giftOfferId ? <p role="alert">{errors.giftOfferId}</p> : null}{field("giftQuantity", "Количество подарка M")}</> : null}
      {field("minimumQuantity", "Минимальное количество покупки")}{field("quantityLimit", "Общий лимит количества по акции")}
      {(["startsAt", "endsAt"] as const).map(key => <DmField key={key} label={key === "startsAt" ? "Начало (местное время)" : "Окончание (местное время)"} required validationMessage={errors[key]} validationState={errors[key] ? "error" : "none"}><DmInput type="datetime-local" disabled={busy} value={terms[key] ? promotionLocalDate(terms[key]) : ""} onChange={(_, data) => change(key, data.value ? new Date(data.value).toISOString() : "")} /></DmField>)}
      <DmButton type="submit" appearance="primary" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить черновик"}</DmButton><DmButton disabled={busy} onClick={onClose}>Отмена</DmButton>
    </form>
  </Section>;
}
