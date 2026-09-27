"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OfferOption, OfferOptionsResponse, SupplierWarehouseList } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, ErrorState, Section, errorMessage } from "@marketplace/ui";
import { offerPriceMinor, offerPriceText, offerQuantity } from "./offer-editor-model";
import type { Offer } from "./types";

export function ManualOffer({ api, supplierId, onChanged, initialOffer }: {
  api: MarketplaceApiClient; supplierId: string; onChanged: () => Promise<void>; initialOffer?: Offer;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<OfferOptionsResponse | null>(null);
  const [searched, setSearched] = useState("");
  const [selected, setSelected] = useState<OfferOption | null>(null);
  const [packId, setPackId] = useState("");
  const [warehouses, setWarehouses] = useState<SupplierWarehouseList>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [includesVat, setIncludesVat] = useState(true);
  const [vatRate, setVatRate] = useState("");
  const [stock, setStock] = useState("0");
  const [minimum, setMinimum] = useState("1");
  const [increment, setIncrement] = useState("1");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [packAssigned, setPackAssigned] = useState(false);
  const [proposal, setProposal] = useState(false);
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [gtin, setGtin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!initialOffer) return;
    if (!["MANUAL", "IMPORT"].includes(initialOffer.sourceType)) {
      setOpen(true); setError("Предложение управляется интеграцией. Изменяйте источник и коммерческие данные в настройках подключения.");
      return;
    }
    let cancelled = false;
    setOpen(true); setBusy(true); inFlight.current = true;
    void Promise.all([api.searchOfferOptions({ variantId: initialOffer.productVariantId }), api.listSupplierWarehouses(supplierId)])
      .then(([options, available]) => {
        if (cancelled) return;
        const option = options.items.find(item => item.id === initialOffer.productVariantId);
        if (!option) throw new Error("Вариант снят с публикации. Обратитесь к оператору каталога.");
        const activePrice = initialOffer.prices.find(item => item.status === "ACTIVE");
        const balance = initialOffer.inventoryBalances[0];
        setSelected(option); setCreatedId(initialOffer.id); setSku(initialOffer.supplierSku ?? "");
        setPackId(initialOffer.packaging?.id ?? option.packagings[0]?.id ?? "");
        setWarehouses(available.filter(warehouse => warehouse.status === "ACTIVE")); setWarehouseId(balance?.warehouseId ?? "");
        setStock(balance?.quantityOnHand ?? "0"); setPrice(activePrice ? offerPriceText(activePrice.amountMinor) : "");
        setIncludesVat(activePrice?.includesVat ?? true);
        setVatRate(activePrice?.vatRate ?? "");
        setMinimum(initialOffer.minimumOrderQuantity ?? "1"); setIncrement(initialOffer.orderIncrement ?? "1");
      }).catch(cause => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) { setBusy(false); inFlight.current = false; } });
    return () => { cancelled = true; };
  }, [api, supplierId, initialOffer]);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (cause) { setError(errorMessage(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const search = (more = false) => run(async () => {
    const nextQuery = more ? searched : query.trim();
    const response = await api.searchOfferOptions({ q: nextQuery, limit: 20, ...(more && result?.nextCursor ? { cursor: result.nextCursor } : {}) });
    setResult(current => ({ ...response, items: more ? [...(current?.items ?? []), ...response.items] : response.items }));
    setSearched(nextQuery);
  });
  const select = (option: OfferOption) => run(async () => {
    const available = await api.listSupplierWarehouses(supplierId);
    setWarehouses(available.filter(warehouse => warehouse.status === "ACTIVE"));
    setSelected(option); setPackId(option.packagings[0]?.id ?? ""); setWarehouseId("");
  });
  const save = () => run(async () => {
    if (initialOffer && !["MANUAL", "IMPORT"].includes(initialOffer.sourceType)) throw new Error("Ручная форма не меняет данные подключённого источника.");
    const packaging = selected?.packagings.find(pack => pack.id === packId);
    if (!selected || !packaging || !warehouseId) throw new Error("Выберите товар, упаковку и действующий склад.");
    const amountMinor = offerPriceMinor(price);
    const rate = vatRate.trim() ? Number(vatRate.replace(",", ".")) : null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) throw new Error("Ставка НДС должна быть от 0 до 100%.");
    const quantity = offerQuantity(stock, true);
    const minimumOrderQuantity = offerQuantity(minimum);
    const orderIncrement = offerQuantity(increment);
    let id = createdId;
    if (id && initialOffer && !initialOffer.packaging?.id && !packAssigned) {
      if (!initialOffer.version) throw new Error("Обновите список предложений перед назначением упаковки.");
      await api.assignSupplierOfferPackaging(supplierId, id, { packagingId: packaging.id, version: initialOffer.version });
      setPackAssigned(true);
    }
    if (!id) {
      const offer = await api.createSupplierOffer(supplierId, {
        productVariantId: selected.id, packagingId: packaging.id, saleUnitId: packaging.unitId,
        baseUnitsPerSaleUnit: Number(packaging.quantityInBaseUnit), supplierSku: sku.trim() || null,
        minimumOrderQuantity, orderIncrement, sourceType: "MANUAL", confirmationMode: "MANUAL",
      });
      id = offer.id; setCreatedId(id);
    }
    // Keep the created id on any subsequent failure: retry completes this draft,
    // never creates a second offer. Publication is a separate explicit action.
    await api.setSupplierOfferPrice(supplierId, id, { amountMinor, currency: "KZT", includesVat, vatRate: rate, source: "MANUAL" });
    await api.setSupplierInventory(supplierId, {
      warehouseId, productVariantId: selected.id, offerId: id, quantityOnHand: quantity,
      quantityReserved: 0, safetyStock: 0, source: "MANUAL",
      initialForOffer: true,
    });
    setSaved(true); setNotice("Условия сохранены. Предложение ещё не опубликовано.");
    await onChanged();
  });
  const publish = () => run(async () => {
    if (!createdId || !saved) return;
    await api.setSupplierOfferPublication(supplierId, createdId, { status: "PUBLISHED", marketplaceVisible: true });
    setNotice("Предложение опубликовано. Оно доступно клиникам при актуальной цене и остатке.");
    await onChanged();
  });
  const submit = () => run(async () => {
    if (query.trim().length < 3 || !description.trim()) throw new Error("Укажите название товара и сведения для модератора.");
    if (gtin && !/^\d{8,14}$/.test(gtin)) throw new Error("Штрихкод должен содержать от 8 до 14 цифр.");
    const response = await api.submitProductCandidate({ proposedName: query.trim(), proposedSku: sku.trim() || null,
      proposedBrand: brand.trim() || null, proposedGtin: gtin || null, rawSubmission: { description: description.trim() } });
    setNotice(`Заявка ${response.candidate.id.slice(0, 8)} отправлена на модерацию. Публикация возможна после создания мастер-карточки.${response.duplicateSuggestions.length ? " Найдены похожие товары: " + response.duplicateSuggestions.map(item => item.canonicalName).join(", ") : ""}`);
    setProposal(false);
  });
  return <Section title="Добавить товар" description="Выберите существующую мастер-карточку или отправьте заявку на новый товар.">
    {!open ? <DmButton appearance="primary" onClick={() => setOpen(true)}>Добавить предложение вручную</DmButton> : <div className="mp-stack">
      {error ? <ErrorState description={error} /> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!selected ? <>
        <form onSubmit={event => { event.preventDefault(); void search(); }}>
          <DmField label="Товар, артикул или штрихкод"><DmInput value={query} maxLength={160} disabled={busy} onChange={(_, data) => setQuery(data.value)} /></DmField>
          <DmButton type="submit" disabled={busy}>{busy ? "Загружаем…" : "Найти в мастер-каталоге"}</DmButton>
        </form>
        {result?.items.length === 0 ? <p>Товар не найден. Измените запрос или отправьте заявку модератору.</p> : null}
        {result?.items.map(option => <div key={option.id}>
          <strong>{option.name}</strong><p>Артикул: {option.sku ?? "не указан"} · Штрихкод: {option.gtin ?? "не указан"}</p>
          <DmButton disabled={busy || !option.packagings.length} onClick={() => void select(option)}>Выбрать {option.sku ?? option.name}</DmButton>
          {!option.packagings.length ? <p>У варианта пока нет утверждённой упаковки. Обратитесь к оператору каталога.</p> : null}
        </div>)}
        {result?.nextCursor ? <DmButton disabled={busy} onClick={() => void search(true)}>Показать ещё варианты</DmButton> : null}
        <DmButton disabled={busy} onClick={() => setProposal(!proposal)}>Нет нужного товара — заявка модератору</DmButton>
        {proposal ? <form onSubmit={event => { event.preventDefault(); void submit(); }} className="mp-stack">
          <p>Название берётся из поля поиска. Модератор проверит дубли и характеристики.</p>
          <DmField label="Бренд"><DmInput value={brand} maxLength={160} disabled={busy} onChange={(_, data) => setBrand(data.value)} /></DmField>
          <DmField label="Штрихкод нового товара"><DmInput value={gtin} maxLength={14} disabled={busy} onChange={(_, data) => setGtin(data.value)} /></DmField>
          <DmField label="Описание, упаковка и ссылка на материалы"><DmInput value={description} maxLength={2000} disabled={busy} onChange={(_, data) => setDescription(data.value)} /></DmField>
          <DmButton type="submit" disabled={busy}>Отправить заявку</DmButton>
        </form> : null}
      </> : <form onSubmit={event => { event.preventDefault(); void save(); }} className="mp-stack">
        <h3>{selected.name}</h3>
        {!createdId ? <DmButton disabled={busy} onClick={() => setSelected(null)}>Выбрать другой товар</DmButton> : <p>Черновик создан. При ошибке можно повторить сохранение оставшихся условий.</p>}
        <DmField label="Упаковка предложения"><DmSelect value={packId} disabled={busy || saved || packAssigned || Boolean(createdId && (!initialOffer || initialOffer.packaging?.id))} onChange={(_, data) => setPackId(data.value)}>
          {selected.packagings.map(pack => <option key={pack.id} value={pack.id}>{pack.name} · {pack.quantityInBaseUnit} базовых единиц · {pack.unit}</option>)}
        </DmSelect></DmField>
        <DmField label="Артикул поставщика"><DmInput value={sku} maxLength={120} disabled={busy || Boolean(createdId)} onChange={(_, data) => setSku(data.value)} /></DmField>
        <DmField label="Минимальная партия, упаковок"><DmInput value={minimum} disabled={busy || Boolean(createdId)} onChange={(_, data) => setMinimum(data.value)} /></DmField>
        <DmField label="Шаг заказа, упаковок"><DmInput value={increment} disabled={busy || Boolean(createdId)} onChange={(_, data) => setIncrement(data.value)} /></DmField>
        <DmField label="Цена за упаковку, ₸"><DmInput inputMode="decimal" value={price} disabled={busy || saved} onChange={(_, data) => setPrice(data.value)} /></DmField>
        <DmField label="НДС в цене"><DmSelect value={includesVat ? "included" : "excluded"} disabled={busy || saved} onChange={(_, data) => setIncludesVat(data.value === "included")}><option value="included">Включён в цену</option><option value="excluded">Без НДС</option></DmSelect></DmField>
        <DmField label="Ставка НДС, % (если применима)"><DmInput inputMode="decimal" value={vatRate} disabled={busy || saved} onChange={(_, data) => setVatRate(data.value)} /></DmField>
        <DmField label="Склад"><DmSelect value={warehouseId} disabled={busy || saved} onChange={(_, data) => setWarehouseId(data.value)}>
          <option value="">Выберите склад</option>{warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </DmSelect></DmField>
        {!warehouses.length ? <p role="alert">Нет действующего склада. Добавьте склад в настройках организации.</p> : null}
        <DmField label="Остаток, базовых единиц"><DmInput inputMode="decimal" value={stock} disabled={busy || saved} onChange={(_, data) => setStock(data.value)} /></DmField>
        <DmButton type="submit" appearance="primary" disabled={busy || saved}>{busy ? "Сохраняем…" : "Сохранить условия"}</DmButton>
        {saved ? <DmButton disabled={busy} onClick={() => void publish()}>Опубликовать предложение</DmButton> : null}
        <p>Публикация проверяет допуск поставщика, договор, карточку, цену и остаток. При отказе черновик сохраняется.</p>
      </form>}
    </div>}
  </Section>;
}
