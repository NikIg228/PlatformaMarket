"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OfferOption, OfferOptionsResponse, SupplierWarehouseList, SaveOfferCommercialInput, OfferCommercialState } from "@marketplace/schemas";
import { DmSearch, DmButton, DmDropdown, DmField, DmInput, ErrorState, LoadingState, ProductThumbnail, StatusTag, errorMessage, formatMoney, productWorkflowStyles as s, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { offerPriceMinor, offerQuantity } from "./offer-editor-model";

export function AddOfferWizard({ api, supplierId }: { api: MarketplaceApiClient; supplierId: string }) {
  const has = usePermissions();
  const [step, setStep] = useState(0), [q, setQ] = useState("");
  const [options, setOptions] = useState<OfferOptionsResponse | null>(null), [selected, setSelected] = useState<OfferOption | null>(null);
  const [packId, setPackId] = useState(""), [warehouses, setWarehouses] = useState<SupplierWarehouseList>([]), [warehouseId, setWarehouseId] = useState("");
  const [price, setPrice] = useState(""), [stock, setStock] = useState(""), [sku, setSku] = useState("");
  const [minimum, setMinimum] = useState("1"), [increment, setIncrement] = useState("1"), [vat, setVat] = useState("included"), [vatRate, setVatRate] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [fieldError, setFieldError] = useState("");
  const [saved, setSaved] = useState<OfferCommercialState | null>(null), [published, setPublished] = useState(false);
  const [unknownCreation, setUnknownCreation] = useState(false), [unknownSave, setUnknownSave] = useState(false), [conflict, setConflict] = useState(false);
  const created = useRef<string | null>(null), pending = useRef<SaveOfferCommercialInput | null>(null), lock = useRef(false), alive = useRef(true);
  const packaging = selected?.packagings.find(item => item.id === packId);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useUnsavedChanges(!saved && Boolean(selected || price || stock || sku));
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setFieldError("");
    try { await action(); } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const search = (more = false, query = q) => run(async () => {
    const response = await api.searchOfferOptions({ q: query.trim(), ...(more && options?.nextCursor ? { cursor: options.nextCursor } : {}) });
    if (alive.current) setOptions(current => ({ ...response, items: more ? [...(current?.items ?? []), ...response.items] : response.items }));
  });
  const select = (item: OfferOption) => run(async () => {
    const rows = await api.listSupplierWarehouses(supplierId);
    if (!alive.current) return;
    setSelected(item); setPackId(item.packagings[0]?.id ?? ""); setWarehouses(rows.filter(row => row.status === "ACTIVE"));
    setWarehouseId(rows.filter(row => row.status === "ACTIVE").length === 1 ? rows.find(row => row.status === "ACTIVE")!.id : ""); setStep(1);
  });
  const invalid = (field: string, message: string): never => {
    setFieldError(field); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[name="${field}"], #${field}`)?.focus()); throw new Error(message);
  };
  const review = () => run(async () => {
    if (!selected || !packaging || !has("catalog.offer.edit", "pricing.manage", "inventory.adjust")) return;
    if (!warehouseId) invalid("warehouse", "Выберите склад.");
    let amount: number, quantity: number, min: number, inc: number;
    try { amount = offerPriceMinor(price); } catch (cause) { invalid("price", errorMessage(cause)); }
    try { quantity = offerQuantity(stock, true); } catch (cause) { invalid("stock", errorMessage(cause)); }
    try { min = offerQuantity(minimum); inc = offerQuantity(increment); } catch (cause) { invalid("minimum", errorMessage(cause)); }
    const rate = vatRate.trim() ? Number(vatRate.replace(",", ".")) : null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) invalid("vat", "Ставка НДС должна быть от 0 до 100%.");
    if (!created.current) {
      try {
        const result = await api.createSupplierOffer(supplierId, { productVariantId: selected.id, packagingId: packaging.id, saleUnitId: packaging.unitId,
          baseUnitsPerSaleUnit: Number(packaging.quantityInBaseUnit), supplierSku: sku.trim() || null, minimumOrderQuantity: min!, orderIncrement: inc!, sourceType: "MANUAL", confirmationMode: "MANUAL" });
        created.current = result.id;
      } catch (cause) {
        const status = cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0;
        if (!status || status >= 500 || status === 408) setUnknownCreation(true);
        throw cause;
      }
    }
    if (!pending.current) {
      const baseline = await api.getSupplierOfferCommercial(supplierId, created.current, warehouseId);
      pending.current = { warehouseId, expectedOfferVersion: baseline.offerVersion, expectedBalanceVersion: baseline.balance?.version ?? null,
        idempotencyKey: crypto.randomUUID(), amountMinor: String(amount!), currency: "KZT", includesVat: vat === "included", vatRate: rate, quantityOnHand: quantity! };
    }
    try {
      const state = await api.saveSupplierOfferCommercial(supplierId, created.current, pending.current);
      pending.current = null; setUnknownSave(false); setConflict(false);
      if (alive.current) { setSaved(state); setStep(3); }
    } catch (cause) {
      const status = cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0;
      if (status >= 400 && status < 500 && status !== 408) { pending.current = null; setUnknownSave(false); if (status === 409) setConflict(true); }
      else setUnknownSave(true);
      throw cause;
    }
  });
  const publish = () => run(async () => {
    if (!created.current || !saved || !has("catalog.offer.publish")) return;
    await api.setSupplierOfferPublication(supplierId, created.current, { status: "PUBLISHED", marketplaceVisible: true, expectedVersion: saved.offerVersion });
    if (alive.current) setPublished(true);
  });
  const editConditions = () => { setSaved(null); setStep(2); };
  const locked = busy || unknownSave || unknownCreation;
  return <div className={selected ? s.columns : undefined}>
    <section className={`${s.panel} ${s.form}`}>
      {error ? <ErrorState description={error} /> : null}
      {unknownCreation ? <div className={s.notice} role="alert">Ответ о создании не получен. Проверьте список товаров, прежде чем создавать предложение повторно. <a href="/supplier/products">Открыть товары</a></div> : null}
      {unknownSave ? <p className={s.hint} role="status">Ответ не получен. Повтор проверит тот же запрос — условия не будут сохранены дважды.</p> : null}
      {step === 0 ? <>
        <h2>Найдите товар в каталоге</h2>
        <DmSearch aria-label="Товар, артикул или штрихкод" placeholder="Найти товар" value={q} maxLength={160} onChange={setQ} disabled={busy} onSearch={value => void search(false, value)} />
        <p className={s.hint}>Введите название, артикул производителя или цифры под штрихкодом (GTIN).</p>
        {busy ? <LoadingState label="Ищем товары" /> : null}
        {options?.items.length === 0 ? <div className={s.empty}><h3>Товар не найден</h3><p>Попробуйте другой запрос или подайте заявку на новый товар.</p></div> : null}
        <div className={s.results}>{options?.items.map(item => <div className={s.result} key={item.id}>
          <div className={s.identity}><ProductThumbnail src={item.imageUrl} name={item.name} /><div><strong>{item.name}</strong><small>{item.sku ? `Артикул: ${item.sku}` : "Без артикула"}{item.gtin ? ` · ${item.gtin}` : ""}</small>{!item.packagings.length ? <small>Упаковка ещё не утверждена</small> : null}</div></div>
          <DmButton disabled={busy || !item.packagings.length} onClick={() => void select(item)} aria-label={`Выбрать ${item.sku ?? item.name}`}>Выбрать</DmButton>
        </div>)}</div>
        {options?.nextCursor ? <DmButton disabled={busy} onClick={() => void search(true)}>Показать ещё варианты</DmButton> : null}
        <div className={s.footer}><a href="/supplier/products/new?request=1">Не нашли товар? Подать заявку</a></div>
      </> : null}
      {step === 1 && selected ? <>
        <h2>Выберите упаковку</h2>
        <p className={s.hint}>Цена и остаток будут относиться к выбранной единице продажи.</p>
        <DmField label="Упаковка предложения"><DmDropdown value={packId} disabled={locked} onChange={(_, data) => setPackId(data.value)}>{selected.packagings.map(pack => <option key={pack.id} value={pack.id}>{pack.name} · {pack.quantityInBaseUnit} {pack.unit}</option>)}</DmDropdown></DmField>
        {packaging ? <dl className={s.metadata}><dt>Упаковка</dt><dd>{packaging.name}</dd><dt>Содержимое</dt><dd>{packaging.quantityInBaseUnit} {packaging.unit}</dd></dl> : null}
        <div className={s.footer}><DmButton disabled={locked} onClick={() => setStep(0)}>Назад</DmButton><DmButton appearance="primary" disabled={locked || !packaging} onClick={() => setStep(2)}>Условия продажи</DmButton></div>
      </> : null}
      {step === 2 ? <form className={s.form} onSubmit={event => { event.preventDefault(); void review(); }}>
        <h2>Условия продажи</h2>
        <div className={s.fields}>
          <DmField label="Цена за упаковку, ₸" validationState={fieldError === "price" ? "error" : undefined}><DmInput name="price" inputMode="decimal" value={price} disabled={locked} onChange={(_, data) => setPrice(data.value)} /></DmField>
          <DmField label="Ваш артикул"><DmInput name="sku" value={sku} maxLength={120} disabled={locked || Boolean(created.current)} onChange={(_, data) => setSku(data.value)} /></DmField>
          <DmField label="Склад" validationState={fieldError === "warehouse" ? "error" : undefined}><DmDropdown id="warehouse" value={warehouseId} disabled={locked} onChange={(_, data) => setWarehouseId(data.value)}><option value="">Выберите склад</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</DmDropdown></DmField>
          <DmField label="Количество упаковок" validationState={fieldError === "stock" ? "error" : undefined}><DmInput name="stock" inputMode="decimal" value={stock} disabled={locked} onChange={(_, data) => setStock(data.value)} /></DmField>
        </div>
        {!warehouses.length ? <p role="alert">Нет действующего склада. <a href="/supplier/settings">Добавьте склад в настройках организации</a>.</p> : null}
        <p className={s.hint}>Цена и количество указаны за упаковку: {packaging?.name}.</p>
        <section className={s.subsection}><h3>Условия заказа</h3><div className={s.fields}>
          <DmField label="Минимум, уп."><DmInput name="minimum" inputMode="decimal" value={minimum} disabled={locked || Boolean(created.current)} onChange={(_, data) => setMinimum(data.value)} /></DmField>
          <DmField label="Шаг заказа, уп."><DmInput inputMode="decimal" value={increment} disabled={locked || Boolean(created.current)} onChange={(_, data) => setIncrement(data.value)} /></DmField>
        </div></section>
        <details className={s.disclosure}><summary>Дополнительные условия</summary><div className={s.fields}>
          <DmField label="НДС в цене"><DmDropdown value={vat} disabled={locked} onChange={(_, data) => setVat(data.value)}><option value="included">Включён в цену</option><option value="excluded">Без НДС</option></DmDropdown></DmField>
          <DmField label="Ставка НДС, %"><DmInput name="vat" inputMode="decimal" value={vatRate} disabled={locked} onChange={(_, data) => setVatRate(data.value)} /></DmField>
        </div></details>
        {conflict ? <p role="alert">Условия изменились. Проверьте свои значения перед повторным сохранением.</p> : null}
        {!has("pricing.manage", "inventory.adjust") ? <p role="status">Для сохранения нужны права на изменение цены и остатка. Ввод сохранён.</p> : null}
        <div className={s.footer}><DmButton type="button" disabled={locked || Boolean(created.current)} onClick={() => setStep(1)}>Назад</DmButton><DmButton type="submit" appearance="primary" disabled={busy || unknownCreation || !has("pricing.manage", "inventory.adjust")}>{busy ? "Сохраняем…" : unknownSave ? "Повторить сохранение" : conflict ? "Подтвердить мои значения" : "Проверить предложение"}</DmButton></div>
      </form> : null}
      {step === 3 && saved ? <>
        <h2>{published ? "Предложение опубликовано" : "Проверьте перед публикацией"}</h2>
        {published ? <ActionFeedback tone="success" description="Предложение опубликовано. Цена и остаток доступны клиникам." /> : <p className={s.hint}>Условия сохранены в черновике. Проверьте их перед публикацией.</p>}
        <dl className={s.metadata}><dt>Товар</dt><dd>{selected?.name}</dd><dt>Упаковка</dt><dd>{packaging?.name}</dd><dt>Цена за упаковку</dt><dd>{saved.price ? formatMoney(saved.price.amountMinor, saved.price.currency) : "Не задана"}</dd><dt>Количество упаковок</dt><dd>{saved.balance?.quantityOnHand}</dd><dt>Склад</dt><dd>{warehouses.find(item => item.id === warehouseId)?.name}</dd><dt>Минимум / шаг</dt><dd>{minimum} / {increment}</dd></dl>
        <div className={s.footer}>{published ? <a href={`/supplier/products?offer=${created.current}`}>Открыть предложение</a> : <><DmButton disabled={busy} onClick={editConditions}>Изменить условия</DmButton><DmButton appearance="primary" disabled={busy || !has("catalog.offer.publish")} onClick={() => void publish()}>Опубликовать предложение</DmButton></>}</div>
        {!published && !has("catalog.offer.publish") ? <p role="status">Публикация недоступна вашей роли. Черновик сохранён.</p> : null}
      </> : null}
    </section>
    {selected ? <aside className={`${s.panel} ${s.summary}`} aria-label="Выбранный товар"><ProductThumbnail large src={selected.imageUrl} name={selected.name} /><div><h3>{selected.name}</h3><p>{packaging?.name}</p></div><StatusTag tone="success">Выбран из каталога</StatusTag>{!created.current ? <DmButton appearance="subtle" disabled={busy} onClick={() => setStep(0)}>Изменить товар</DmButton> : null}<p className={s.hint}>После проверки вы сможете опубликовать предложение.</p></aside> : null}
  </div>;
}
