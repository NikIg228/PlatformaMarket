"use client";
import { useRef, useState } from "react";
import { vatLabel, type ApplyOfferVatInput, type OfferVatInput, type OfferVatPreview } from "@marketplace/schemas";
import { DmButton, DmDialog, ErrorState, DmFeedback, formatMoney, errorMessage } from "@marketplace/ui";
import { OfferVatEditor } from "../../../supplier-web/app/features/supplier-workspace/offer-vat-editor";
import { useWorkspace } from "./workspace";
import layout from "./requisites.module.css";

export function OfferVatBulk({ offerIds, onChanged }: { offerIds: string[]; onChanged: () => Promise<void> }) {
  const { api, organizationId } = useWorkspace();
  const [open, setOpen] = useState(false), [tax, setTax] = useState<OfferVatInput | undefined>();
  const [preview, setPreview] = useState<OfferVatPreview | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [unknown, setUnknown] = useState(false);
  const pending = useRef<ApplyOfferVatInput | null>(null), lock = useRef(false), trigger = useRef<HTMLButtonElement>(null);
  const review = async () => {
    if (!tax || lock.current) return; lock.current = true; setBusy(true); setError("");
    try { setPreview(await api.previewOfferVat(organizationId, { offerIds, tax })); }
    catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setBusy(false); }
  };
  const apply = async () => {
    if (lock.current || !preview || !tax) return; lock.current = true; setBusy(true); setError("");
    try {
      pending.current ??= { offerIds, tax, previewHash: preview.previewHash, idempotencyKey: crypto.randomUUID() };
      const result = await api.applyOfferVat(organizationId, pending.current);
      pending.current = null; setUnknown(false); setOpen(false); setPreview(null);
      setNotice(`НДС обновлён: ${result.updatedOfferIds.length}. Без изменений: ${result.unchangedCount}. Цены сохранены.`);
      await onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
      const status = cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0;
      if (status >= 400 && status < 500 && status !== 408) { pending.current = null; setUnknown(false); setPreview(null); }
      else setUnknown(true);
    } finally { lock.current = false; setBusy(false); }
  };
  return <>
    <DmButton ref={trigger} disabled={!offerIds.length || offerIds.length > 500} onClick={() => { setOpen(true); setPreview(null); setError(""); setNotice(""); }}>Изменить НДС выбранных ({offerIds.length})</DmButton>
    {notice ? <DmFeedback tone="success" title="Налоговые условия сохранены" description={notice} /> : null}
    <DmDialog open={open} title="Изменение НДС выбранных товаров" onOpenChange={value => { if (!busy && !unknown) setOpen(value); }} onClosed={() => trigger.current?.focus()}
      actions={<><DmButton disabled={busy || unknown} onClick={() => { if (preview) setPreview(null); else setOpen(false); }}>{preview ? "Изменить условия" : "Отмена"}</DmButton>
        <DmButton appearance="primary" disabled={busy || !tax} onClick={() => void (preview ? apply() : review())}>{busy ? "Проверяем…" : preview ? unknown ? "Повторить подтверждение" : "Подтвердить изменение НДС" : "Проверить изменения"}</DmButton></>}>
      <div className={layout.stack}>
        <p>Выбрано предложений: {offerIds.length}. Суммы цен и сроки их актуальности сохраняются.</p>
        {error ? <ErrorState description={error} /> : null}
        {preview ? <><p>Будет изменено: {preview.changedCount}. Без изменений: {preview.unchangedCount}.</p><p>Новый режим: {vatLabel(preview.selection)}.</p>
          <ul>{preview.items.map(item => <li key={item.offerId}>{item.name} · {formatMoney(item.amountMinor)} · {vatLabel(item.previous)} → {vatLabel(preview.selection)}</li>)}</ul></>
          : <OfferVatEditor api={api} supplierId={organizationId} onChange={setTax} disabled={busy} />}
        {unknown ? <p role="status">Ответ не получен. Повтор проверит тот же запрос без повторного изменения.</p> : null}
      </div>
    </DmDialog>
  </>;
}
