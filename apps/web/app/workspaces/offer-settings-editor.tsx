"use client";
import { useEffect, useRef, useState } from "react";
import type { OfferOption, WorkspaceOffer } from "@marketplace/schemas";
import { DmButton, DmDropdown, DmField, ErrorState, errorMessage, formatStatus, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { offerAttention } from "./offer-summary";
import { EditorActions, useEditorGuard, type OfferEditorProps } from "./offer-editor-shared";
import styles from "./offer-editors.module.css";
export function OfferSettingsEditor(props: OfferEditorProps & { mode: "packaging" | "publication" }) {
  const { api, organizationId } = useWorkspace(), has = usePermissions();
  const [current, setCurrent] = useState<WorkspaceOffer>(props.offer), [packs, setPacks] = useState<OfferOption["packagings"]>([]), [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [mustRefresh, setMustRefresh] = useState(false);
  const flight = useRef(false), packaging = props.mode === "packaging";
  const allowed = has(packaging ? "catalog.offer.edit" : "catalog.offer.publish") && ["MANUAL", "IMPORT"].includes(current.sourceType);
  useEditorGuard(props, Boolean(selected), busy);
  useEffect(() => { let alive = true; setLoading(true); setLoaded(false); setError("");
    void (async () => { const latest = await api.workspaceOffer(props.offer.id); const options = packaging && !latest.packaging ? await api.searchOfferOptions({ variantId: latest.productVariantId }) : null;
      if (alive) { setCurrent(latest); setPacks(options?.items.find(item => item.id === latest.productVariantId)?.packagings ?? []); setMustRefresh(false); setLoaded(true); }
    })().catch(cause => { if (alive) setError(errorMessage(cause)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, props.offer.id, packaging, attempt]);
  const save = async () => {
    if (flight.current || !allowed || !loaded || mustRefresh || !current.version) return;
    flight.current = true; setBusy(true); setError("");
    try {
      if (packaging) { if (!packs.some(item => item.id === selected) || current.packaging) return; await api.assignSupplierOfferPackaging(organizationId, current.id, { packagingId: selected, version: current.version }); }
      else await api.setSupplierOfferPublication(organizationId, current.id, { status: "PUBLISHED", marketplaceVisible: true, expectedVersion: current.version });
      setSelected(""); await props.onSaved(packaging ? "Упаковка назначена. Проверьте цену за единицу продажи." : "Предложение опубликовано.");
    } catch (cause) { setError(`${errorMessage(cause)} Загрузите актуальное предложение и проверьте результат перед повторным действием.`); setMustRefresh(true); }
    finally { flight.current = false; setBusy(false); }
  };
  const attention = offerAttention(current), pack = packs.find(item => item.id === selected);
  const ready = Boolean(current.packaging && current.prices.some(item => item.status === "ACTIVE") && !attention.priceWarning && !attention.stockWarning);
  return <div className={styles.form}>
    {loading ? <p role="status">Загружаем условия предложения…</p> : null}{error ? <ErrorState description={error} /> : null}
    {error || mustRefresh ? <DmButton disabled={loading || busy} onClick={() => setAttempt(value => value + 1)}>Обновить условия предложения</DmButton> : null}
    {!loading && loaded ? <>{packaging ? <>
      <dl className={styles.readOnly}><div><dt>Артикул поставщика</dt><dd>{current.supplierSku ?? "Не указан"}</dd></div><div><dt>Единица продажи</dt><dd>{current.saleUnit?.nameRu ?? "Не указана"}</dd></div><div><dt>Минимальный заказ</dt><dd>{current.minimumOrderQuantity} {current.saleUnit?.symbol}</dd></div><div><dt>Шаг заказа</dt><dd>{current.orderIncrement} {current.saleUnit?.symbol}</dd></div></dl>
      {current.packaging ? <div className={styles.summary}><strong>{current.packaging.name}</strong><p>{current.packaging.quantityInBaseUnit} {current.packaging.unit.symbol}</p><p>Упаковка уже назначена. Для изменения обратитесь к оператору каталога.</p></div> : packs.length ? <>
        <DmField label="Упаковка предложения"><DmDropdown value={selected} disabled={busy || !allowed || mustRefresh} onChange={(_, data) => setSelected(data.value)}><option value="">Выберите упаковку</option>{packs.map(item => <option key={item.id} value={item.id}>{item.name} · {item.quantityInBaseUnit} {item.unit}</option>)}</DmDropdown></DmField>
        {pack ? <p>{pack.name}: {pack.quantityInBaseUnit} базовых единиц. Назначение не пересчитывает цену автоматически — проверьте её перед публикацией.</p> : null}
      </> : <p role="status">Для этого варианта нет утверждённой упаковки. Обратитесь к оператору каталога. Цену можно изменить отдельно.</p>}
    </> : <><div className={styles.summary}><span>Статус предложения</span><strong>{current.publication?.marketplaceVisible ? "В каталоге" : formatStatus(current.publication?.status ?? current.status)}</strong></div>
      {current.publication?.marketplaceVisible ? <p>Предложение уже опубликовано и видно в каталоге.</p> : <><ul className={styles.checks}><li>{current.packaging ? `Упаковка: ${current.packaging.name}` : "Назначьте утверждённую упаковку."}</li><li>{attention.priceWarning ?? (current.prices.some(item => item.status === "ACTIVE") ? "Цена указана и актуальна." : "Укажите цену.")}</li><li>{attention.stockWarning ?? "Остатки актуальны."}</li></ul><p>При публикации также проверяются договор с площадкой и обязательные сведения о товаре. Предложение станет доступно клиникам.</p></>}
      {current.publication?.blockedReason ? <p role="status">{current.publication.blockedReason}</p> : null}
    </>}{!allowed ? <p role="status">{packaging ? "Назначение упаковки недоступно" : "Публикация недоступна"} вашей роли или источнику предложения.</p> : null}</> : null}
    <EditorActions host={props.footer}><DmButton disabled={busy} onClick={props.onCancel}>Отмена</DmButton>{packaging ? !current.packaging && packs.length > 0 ? <DmButton appearance="primary" disabled={busy || loading || !loaded || !allowed || !selected || mustRefresh || !current.version} onClick={() => void save()}>Назначить упаковку</DmButton> : null : !current.publication?.marketplaceVisible ? <DmButton appearance="primary" disabled={busy || loading || !loaded || !allowed || !ready || mustRefresh || !current.version} onClick={() => void save()}>Опубликовать предложение</DmButton> : null}</EditorActions>
  </div>;
}
