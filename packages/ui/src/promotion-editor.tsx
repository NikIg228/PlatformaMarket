"use client";
import { DmAction } from "./controls";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OfferPromotion, PromotionTerms, WorkspaceOffer } from "@marketplace/schemas";
import { promotionTermsSchema } from "@marketplace/schemas/promotions";
import { DmSearch, DmButton, DmField, DmInput, DmDropdown as DmSelect, DmTextarea, ErrorState, LoadingState, StatusTag, errorMessage, formatMoney, formatDate } from "./index";
import { ProductThumbnail, useUnsavedChanges, productWorkflowStyles as styles } from "./product-workflow";
import { promotionLocalDate, type PromotionWorkspaceApi } from "./promotion-workspace-types";
import { promotionPreviewPrice, promotionDiscountFromPrice, promotionPriceText } from "./promotion-preview";
import local from "./promotion-wizard.module.css";
function OfferPicker({ api, label, value, name, disabled, onChange, onOffer }: { api: PromotionWorkspaceApi; label: string; value: string; name?: string; disabled: boolean; onChange: (value: string) => void; onOffer?: (offer: WorkspaceOffer | null) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WorkspaceOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const search = useCallback(async (text: string) => {
    const ticket = ++generation.current;
    setLoading(true); setError(null);
    try { const page = await api.workspaceOffers({ q: text, limit: 25 }); if (ticket === generation.current) setItems(page.items); }
    catch (cause) { if (ticket === generation.current) setError(errorMessage(cause)); }
    finally { if (ticket === generation.current) setLoading(false); }
  }, [api]);
  useEffect(() => { void search(""); return () => { generation.current++; }; }, [search]);
  return <div className={local.picker}>
    <DmSearch aria-label={`Поиск: ${label}`} placeholder={label === "Подарок" ? "Найти подарок" : "Найти товар"} value={query} disabled={disabled} pending={loading} onChange={setQuery} onSearch={value => void search(value)} />
    {error ? <ErrorState description={error} action={<DmButton type="button" onClick={() => void search(query)}>Повторить поиск товара</DmButton>} /> : null}
    {loading ? <LoadingState label="Ищем товары" /> : null}
    <DmField label={label} required><DmSelect value={value} disabled={disabled} onChange={(_, data) => { onChange(data.value); onOffer?.(items.find(item => item.id === data.value) ?? null); }}>
      <option value="">Выберите товар</option>
      {value && !items.some(item => item.id === value) ? <option value={value}>{name ?? "Выбранное предложение"}</option> : null}
      {items.map(item => <option key={item.id} value={item.id}>{item.productVariant.product.canonicalName} · {item.supplierSku ?? item.id.slice(0, 8)}</option>)}
    </DmSelect></DmField>
    {!loading && !error && !items.length ? <p className={styles.hint}>Товары не найдены. Измените запрос или добавьте предложение.</p> : items.length >= 25 ? <small className={styles.hint}>Первые 25 совпадений. Уточните название, если нужного предложения нет.</small> : null}
  </div>;
}

export function PromotionEditor({ api, selected, template, initialOfferId, onSaved, onClose }: { api: PromotionWorkspaceApi; selected?: OfferPromotion; template?: OfferPromotion; initialOfferId?: string; onSaved: () => Promise<void>; onClose: () => void }) {
  const original = selected ?? template;
  const [step, setStep] = useState(original ? 1 : 0), [dirty, setDirty] = useState(false);
  const [terms, setTerms] = useState<PromotionTerms>(() => original ? { ...original.terms, ...(template ? { startsAt: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), endsAt: new Date(Math.floor(Date.now() / 60000) * 60000 + 7 * 86400000).toISOString() } : {}) } : {
    offerId: initialOfferId ?? "", name: "", description: "", kind: "FIXED_AMOUNT", percentageBasisPoints: null, fixedAmountMinor: null, buyQuantity: null, giftOfferId: null, giftQuantity: null,
    minimumQuantity: "1", quantityLimit: "100", startsAt: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), endsAt: new Date(Math.floor(Date.now() / 60000) * 60000 + 7 * 86400000).toISOString(),
  });
  const [offer, setOffer] = useState<WorkspaceOffer | null>(null), [offerLoading, setOfferLoading] = useState(Boolean(initialOfferId));
  const [salePrice, setSalePrice] = useState(promotionPriceText(original?.unitPriceMinor));
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [savedDraft, setSavedDraft] = useState<OfferPromotion | null>(null), [offerRetry, setOfferRetry] = useState(0);
  const pending = useRef(false), form = useRef<HTMLFormElement>(null), request = useRef<{ body: string; key: string } | null>(null), submission = useRef<string | null>(null), savedRef = useRef<OfferPromotion | null>(null);
  useUnsavedChanges(dirty && !savedDraft);
  useEffect(() => {
    const id = initialOfferId ?? original?.terms.offerId;
    if (!id || !api.workspaceOffer) { setOfferLoading(false); return; }
    let active = true; setOfferLoading(true);
    void api.workspaceOffer(id).then(result => { if (active) { setOffer(result); if (original) { const currentBase = result.prices.find(price => price.status === "ACTIVE")?.amountMinor ?? original.evidence.baseAmountMinor; setSalePrice(promotionPriceText(promotionPreviewPrice(original.terms, currentBase) ?? undefined)); } if (initialOfferId) { setStep(1); setTerms(current => ({ ...current, name: current.name || `Акция: ${result.productVariant.product.canonicalName}`.slice(0,160), minimumQuantity: result.minimumOrderQuantity })); } } }).catch(cause => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setOfferLoading(false); });
    return () => { active = false; };
  }, [api, initialOfferId, original?.terms.offerId, offerRetry]);
  const currentPrice = offer?.prices.find(item => item.status === "ACTIVE");
  const baseMinor = currentPrice?.amountMinor ?? (original?.terms.offerId === terms.offerId ? original.evidence.baseAmountMinor : null), currency = currentPrice?.currency ?? original?.currency ?? "KZT";
  const previewPrice = promotionPreviewPrice(terms, baseMinor);
  const change = <K extends keyof PromotionTerms>(key: K, value: PromotionTerms[K]) => { setDirty(true); setTerms(current => ({ ...current, [key]: value })); };
  const validate = (keys?: string[]) => {
    const parsed = promotionTermsSchema.safeParse(terms);
    const issues = parsed.success ? [] : parsed.error.issues.filter(issue => !keys || keys.includes(String(issue.path[0])));
    if (issues.length) { setErrors(Object.fromEntries(issues.map(issue => [String(issue.path[0]), issue.message]))); return false; }
    setErrors({}); return true;
  };
  const next = () => {
    if (!form.current?.reportValidity()) return;
    if (step === 0 && !terms.offerId) { setError("Выберите товар акции."); return; }
    if (step === 1 && (!validate(["name", "description", "fixedAmountMinor", "percentageBasisPoints", "buyQuantity", "giftOfferId", "giftQuantity"]) || (terms.kind !== "BUY_X_GET_Y" && !previewPrice))) { setError("Проверьте условия: акционная цена должна быть положительной и ниже обычной."); return; }
    if (step === 2 && !validate()) return;
    setError(null); setStep(step + 1);
  };
  const save = async (send: boolean) => {
    if (pending.current || !validate()) return;
    pending.current = true; setBusy(true); setError(null);
    const body = JSON.stringify(terms); if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
    try {
      let result = savedRef.current;
      if (!result) {
        result = selected ? await api.reviseOfferPromotion(selected.id, { terms, expectedVersion: selected.version, idempotencyKey: request.current.key }) : await api.createOfferPromotion({ terms, sourceTemplateId: template?.id, idempotencyKey: request.current.key });
        savedRef.current = result; setSavedDraft(result); setDirty(false);
      }
      if (send) { submission.current ??= crypto.randomUUID(); await api.commandOfferPromotion(result.id, { action: "SUBMIT", expectedVersion: result.version, idempotencyKey: submission.current }); }
      await onSaved(); onClose();
    } catch (cause) { setError(`${savedRef.current ? "Черновик сохранён. " : ""}${errorMessage(cause)}`); }
    finally { pending.current = false; setBusy(false); }
  };
  const quantityField = (key: "minimumQuantity" | "quantityLimit" | "buyQuantity" | "giftQuantity", label: string) => <DmField label={label} required validationMessage={errors[key]} validationState={errors[key] ? "error" : "none"}><DmInput required disabled={busy || Boolean(savedDraft)} value={terms[key] ?? ""} inputMode="decimal" onChange={(_, data) => change(key, data.value)} /></DmField>;
  const close = () => { if (!dirty || savedDraft || window.confirm("Закрыть форму без сохранения?")) onClose(); };
  return <div className={styles.form}>
    {error ? <ErrorState description={error} action={initialOfferId && !offer ? <DmButton onClick={() => setOfferRetry(value => value + 1)}>Повторить загрузку товара</DmButton> : undefined} /> : null}
    {offerLoading ? <LoadingState label="Загружаем товар акции" /> : <div className={local.columns}>
    <form ref={form} className={`${styles.panel} ${styles.form}`} onSubmit={event => { event.preventDefault(); if (step < 3) next(); else void save(true); }}>
      {step === 0 ? <><h2>Выберите товар для акции</h2><OfferPicker api={api} label="Товар акции" value={terms.offerId} name={original?.offerName} disabled={busy || Boolean(selected)} onChange={value => change("offerId", value)} onOffer={value => { setOffer(value); setSalePrice(""); setTerms(current => ({ ...current, name: value ? `Акция: ${value.productVariant.product.canonicalName}`.slice(0,160) : "", minimumQuantity: value?.minimumOrderQuantity ?? "1", fixedAmountMinor: null, percentageBasisPoints: null })); }} /></> : step === 1 ? <>
        <h2>Условия акции</h2>
        <p className={styles.hint}>Выберите механику и укажите условия акции для выбранного товара.</p>
        <div className={styles.identity}><ProductThumbnail src={offer?.productVariant.product.media?.[0]?.sourceUrl} name={offer?.productVariant.product.canonicalName ?? original?.offerName ?? "Товар"} /><div><strong>{offer?.productVariant.product.canonicalName ?? original?.offerName}</strong><small>{offer?.packaging?.name}{offer?.supplierSku ? ` · Артикул ${offer.supplierSku}` : ""}</small></div></div>
        <div className={local.mechanics} aria-label="Механика акции">{([["FIXED_AMOUNT", "Скидка", "Специальная цена на товар"], ["BUY_X_GET_Y", "N + M в подарок", "Подарок за покупку"]] as const).map(([kind, title, description]) => <DmAction variant="choice" type="button" key={kind} disabled={busy || Boolean(savedDraft)} aria-pressed={kind === "BUY_X_GET_Y" ? terms.kind === kind : terms.kind !== "BUY_X_GET_Y"} onClick={() => { setDirty(true); setSalePrice(""); setTerms(current => ({ ...current, kind, fixedAmountMinor: null, percentageBasisPoints: null, buyQuantity: null, giftQuantity: null, giftOfferId: null })); }}><strong>{title}</strong><span>{description}</span></DmAction>)}</div>
        {terms.kind !== "BUY_X_GET_Y" ? <div className={styles.fields}><DmField label="Обычная цена, ₸"><DmInput readOnly value={baseMinor ? promotionPriceText(baseMinor) : "Нет действующей цены"} /></DmField><DmField label="Акционная цена, ₸" required validationMessage={errors.fixedAmountMinor || errors.percentageBasisPoints ? "Укажите цену ниже обычной" : undefined} validationState={errors.fixedAmountMinor || errors.percentageBasisPoints ? "error" : "none"}><DmInput required inputMode="decimal" disabled={busy || !baseMinor || Boolean(savedDraft)} value={salePrice} onChange={(_, data) => { setDirty(true); setSalePrice(data.value); setTerms(current => ({ ...current, kind: "FIXED_AMOUNT", percentageBasisPoints: null, fixedAmountMinor: promotionDiscountFromPrice(data.value, baseMinor) })); }} /></DmField></div> : <>{quantityField("buyQuantity", "Количество покупки N")}<OfferPicker api={api} label="Подарок" value={terms.giftOfferId ?? ""} name={original?.giftName ?? undefined} disabled={busy || Boolean(savedDraft)} onChange={value => change("giftOfferId", value)} />{errors.giftOfferId ? <p role="alert">{errors.giftOfferId}</p> : null}{quantityField("giftQuantity", "Количество подарка M")}</>}
        <DmField label="Название акции" required validationMessage={errors.name}><DmInput required minLength={3} maxLength={160} disabled={busy || Boolean(savedDraft)} value={terms.name} onChange={(_, data) => change("name", data.value)} /></DmField><DmField label="Описание условий" hint="Необязательно"><DmTextarea maxLength={1000} disabled={busy || Boolean(savedDraft)} value={terms.description} onChange={(_, data) => change("description", data.value)} /></DmField>
      </> : step === 2 ? <><h2>Сроки и лимит</h2><div className={styles.fields}>{(["startsAt", "endsAt"] as const).map(key => <DmField key={key} label={key === "startsAt" ? "Начало (местное время)" : "Окончание (местное время)"} required validationMessage={errors[key]} validationState={errors[key] ? "error" : "none"}><DmInput required type="datetime-local" disabled={busy || Boolean(savedDraft)} value={terms[key] ? promotionLocalDate(terms[key]) : ""} onChange={(_, data) => { const date = new Date(data.value); change(key, data.value && !Number.isNaN(date.getTime()) ? date.toISOString() : ""); }} /></DmField>)}{quantityField("minimumQuantity", "Минимальное количество покупки")}{quantityField("quantityLimit", "Общий лимит количества по акции")}</div><p className={styles.hint}>Количество указывается в единицах продажи товара. Оформленные покупки учитываются в лимите.</p></> : <><h2>Проверьте акцию</h2><dl className={styles.metadata}><dt>Название</dt><dd>{terms.name}</dd><dt>Условия</dt><dd>{terms.kind === "BUY_X_GET_Y" ? `${terms.buyQuantity} + ${terms.giftQuantity} в подарок` : formatMoney(previewPrice, currency)}</dd><dt>Период</dt><dd>{formatDate(terms.startsAt, true)} — {formatDate(terms.endsAt, true)}</dd><dt>Минимум</dt><dd>{terms.minimumQuantity}</dd><dt>Лимит</dt><dd>{terms.quantityLimit}</dd></dl><p className={styles.notice}>Акция появится после согласования площадкой и наступления даты начала. Новая версия условий требует повторного согласования.</p>{savedDraft ? <p role="status">Черновик сохранён. Повторите отправку на согласование или вернитесь к списку.</p> : null}</>}
      <div className={styles.footer}><DmButton type="button" disabled={busy} onClick={() => step > 0 && !savedDraft ? setStep(step - 1) : close()}>{step > 0 && !savedDraft ? "Назад" : "Закрыть"}</DmButton><div className={local.actions}>{step === 3 ? <DmButton disabled={busy} type="button" onClick={() => void save(false)}>Сохранить черновик</DmButton> : null}<DmButton type="submit" appearance="primary" disabled={busy || (step === 0 && !terms.offerId)}>{busy ? "Сохраняем…" : step === 3 ? "Отправить на согласование" : "Далее"}</DmButton></div></div>
    </form>
    <aside className={`${styles.panel} ${styles.summary}`} aria-label="Предпросмотр акции"><div className={local.previewTitle}><h3>Так увидит покупатель</h3><StatusTag>Предпросмотр</StatusTag></div><ProductThumbnail large src={offer?.productVariant.product.media?.[0]?.sourceUrl} name={offer?.productVariant.product.canonicalName ?? original?.offerName ?? "Товар"} /><div><h3>{offer?.productVariant.product.canonicalName ?? original?.offerName ?? "Выберите товар"}</h3>{offer?.packaging ? <p>{offer.packaging.name}</p> : null}</div>
      {terms.kind === "BUY_X_GET_Y" ? <strong>За {terms.buyQuantity || "N"} — {terms.giftQuantity || "M"} в подарок</strong> : previewPrice ? <div><s className={styles.hint}>{formatMoney(baseMinor!, currency)}</s><div className={local.price}>{formatMoney(previewPrice, currency)}</div><StatusTag tone="success">−{(Number((BigInt(baseMinor!) - BigInt(previewPrice)) * BigInt(1000) / BigInt(baseMinor!)) / 10).toLocaleString("ru")} %</StatusTag></div> : <p>Укажите акционную цену</p>}
      <p className={styles.hint}>От {terms.minimumQuantity || "—"} · лимит {terms.quantityLimit || "—"}</p><p className={styles.hint}>Цена и доступность будут проверены при сохранении.</p>
    </aside></div>}
  </div>;
}
