"use client";
import { useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { ProductCandidateSummary } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmTextarea, ErrorState, WorkflowSteps, errorMessage, usePermissions, useUnsavedChanges, productWorkflowStyles as s } from "@marketplace/ui";

export function ProductProposalForm({ api, initial, onDone, onCancel }: { api: MarketplaceApiClient; initial?: ProductCandidateSummary; onDone?: () => void; onCancel?: () => void }) {
  const has = usePermissions();
  const [name, setName] = useState(initial?.proposedName ?? ""), [sku, setSku] = useState(initial?.proposedSku ?? ""), [brand, setBrand] = useState(initial?.proposedBrand ?? ""), [gtin, setGtin] = useState(initial?.proposedGtin ?? "");
  const [description, setDescription] = useState(initial?.description ?? ""), [review, setReview] = useState(false), [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false); const lock = useRef(false);
  useUnsavedChanges(!sent && Boolean(name || sku || description || brand || gtin));
  const validate = () => {
    if (name.trim().length < 3 || !description.trim()) throw new Error("Укажите название и сведения о товаре.");
    if (gtin && !/^\d{8,14}$/.test(gtin)) throw new Error("Штрихкод должен содержать от 8 до 14 цифр.");
  };
  const submit = async () => {
    if (lock.current || !has("catalog.offer.edit")) return;
    lock.current = true; setBusy(true); setError("");
    try {
      validate();
      const result = await api.submitProductCandidate({ proposedName: name.trim(), proposedSku: sku.trim() || null, proposedBrand: brand.trim() || null, proposedGtin: gtin || null, rawSubmission: { description: description.trim() } });
      setSent(result.candidate.id); onDone?.();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className={`${s.panel} ${s.form}`}>
    <WorkflowSteps steps={["Сведения о товаре", "Проверка", "Отправлено"]} current={sent ? 2 : review ? 1 : 0} label="Этапы заявки" />
    <h2>{sent ? "Заявка отправлена" : initial ? "Исправьте сведения о товаре" : "Новый товар для каталога"}</h2>
    {initial?.rejectionReason && !sent ? <p className={s.notice}>Причина отказа: {initial.rejectionReason}</p> : null}
    {error ? <ErrorState description={error} /> : null}
    {sent ? <><p className={s.notice} role="status">Заявка отправлена на модерацию. После одобрения вы сможете заполнить цену и остаток.</p><a href={`/supplier/products/proposals?request=${sent}`}>Следить за рассмотрением</a></> : review ? <>
      <dl className={s.metadata}><dt>Название</dt><dd>{name}</dd><dt>Артикул</dt><dd>{sku || "Не указан"}</dd><dt>Бренд</dt><dd>{brand || "Не указан"}</dd><dt>Штрихкод</dt><dd>{gtin || "Не указан"}</dd><dt>Сведения</dt><dd>{description}</dd></dl>
      <p className={s.hint}>Новая карточка появится в каталоге после проверки сведений.</p>
      <div className={s.footer}><DmButton disabled={busy} onClick={() => setReview(false)}>Назад</DmButton><DmButton appearance="primary" disabled={busy || !has("catalog.offer.edit")} onClick={() => void submit()}>{busy ? "Отправляем…" : "Отправить заявку"}</DmButton></div>
    </> : <form className={s.form} onSubmit={event => { event.preventDefault(); try { validate(); setError(""); setReview(true); } catch (cause) { setError(errorMessage(cause)); } }}>
      <div className={s.fields}>
        <DmField className={s.full} label="Название нового товара" required><DmInput value={name} maxLength={160} onChange={(_, data) => setName(data.value)} /></DmField>
        <DmField label="Артикул нового товара"><DmInput value={sku} maxLength={120} onChange={(_, data) => setSku(data.value)} /></DmField>
        <DmField label="Бренд"><DmInput value={brand} maxLength={160} onChange={(_, data) => setBrand(data.value)} /></DmField>
        <DmField label="Штрихкод нового товара"><DmInput inputMode="numeric" value={gtin} maxLength={14} onChange={(_, data) => setGtin(data.value)} /></DmField>
        <DmField className={s.full} label="Описание, упаковка и ссылка на материалы" required><DmTextarea rows={4} value={description} maxLength={2000} onChange={(_, data) => setDescription(data.value)} /></DmField>
      </div>
      <div className={s.footer}>{onCancel ? <DmButton type="button" onClick={onCancel}>Отмена</DmButton> : <a href="/supplier/products/new">Найти товар в каталоге</a>}<DmButton type="submit" appearance="primary">Проверить заявку</DmButton></div>
    </form>}
  </section>;
}
