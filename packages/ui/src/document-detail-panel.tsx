"use client";
import { ActionFeedback } from "./action-feedback";
import { OverlayDrawer, DrawerBody, DrawerHeader, DrawerHeaderTitle, Spinner } from "@fluentui/react-components";
import { ArrowDownload24Regular } from "@fluentui/react-icons/svg/arrow-download";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { useEffect, useRef, useState } from "react";
import { DmAction, DmButton, DmField, DmSelect, DmTextarea } from "./controls";
import { DocumentStatus, kindLabels, statusLabels, type DocumentArchiveItemView as Item } from "./document-archive";
import { formatDocumentAmount } from "./document-upload-model";
import { usePermissions } from "./permissions";

export type DocumentRelatedPage = { items: Item[]; nextCursor: string | null };
export type DocumentDetailActions = {
  onOpenDocument: (id: string) => Promise<Item>;
  onRelatedDocuments: (orderId: string, cursor?: string) => Promise<DocumentRelatedPage>;
  onDownload: (item: Item) => Promise<void>;
  onAccountingStatus: (item: Item, status: "REVIEWED" | "RECONCILED" | "DISPUTED", reason: string) => Promise<Item>;
};
export function DocumentDetailPanel({ id, organizationId, role, timeZone, onSelect, onClose, ...actions }: DocumentDetailActions & {
  id: string; organizationId: string; role: "clinic" | "supplier"; timeZone?: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  const has = usePermissions();
  const [item, setItem] = useState<Item | null>(null);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const [related, setRelated] = useState<DocumentRelatedPage>({ items: [], nextCursor: null });
  const [relatedBusy, setRelatedBusy] = useState(false);
  const [relatedError, setRelatedError] = useState(false);
  const [relatedRetry, setRelatedRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"REVIEWED" | "RECONCILED" | "DISPUTED">("REVIEWED");
  const [mobile, setMobile] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const callbacks = useRef(actions); callbacks.current = actions;
  const generation = useRef(0);
  const moreLock = useRef(false);
  useEffect(() => { const query = matchMedia("(max-width: 1000px)"); const update = () => setMobile(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  useEffect(() => {
    const current = ++generation.current;
    setItem(null); setFailure(false); setError(""); setNotice(""); setReason(""); setBusy(false); moreLock.current = false;
    void callbacks.current.onOpenDocument(id).then(value => { if (generation.current === current) setItem(value); }).catch(() => { if (generation.current === current) setFailure(true); });
    return () => { generation.current++; };
  }, [id, organizationId, retry]);
  useEffect(() => { if (!mobile) panel.current?.focus(); }, [id, mobile]);
  const orderId = item?.supplierOrder?.id;
  useEffect(() => {
    let active = true; setRelated({ items: [], nextCursor: null }); setRelatedError(false);
    if (!orderId) { setRelatedBusy(false); return; }
    setRelatedBusy(true);
    void callbacks.current.onRelatedDocuments(orderId).then(page => { if (active) setRelated(page); }).catch(() => { if (active) setRelatedError(true); }).finally(() => { if (active) setRelatedBusy(false); });
    return () => { active = false; };
  }, [orderId, id, relatedRetry]);
  const showDate = (value: string) => new Intl.DateTimeFormat("ru-KZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(new Date(value));
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    const current = generation.current; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие. Повторите попытку."); }
    finally { if (current === generation.current) setBusy(false); }
  };
  const content = item ? <div className="dm-registry-detail-content">
    <p className="dm-registry-muted">{kindLabels[item.kind] ?? item.kind} · {showDate(item.documentDate)}</p>
    <div className="dm-document-statuses"><DocumentStatus value={item.status} />{item.accountingStatus !== "NOT_APPLICABLE" ? <DocumentStatus value={item.accountingStatus} /> : null}</div>
    <DmButton appearance="primary" icon={<ArrowDownload24Regular />} disabled={busy} onClick={() => void run(() => actions.onDownload(item))}>Скачать {item.format}</DmButton>
    {error ? <ActionFeedback tone="error" description={error} /> : null}{notice ? <ActionFeedback tone="success" description={notice} /> : null}
    <dl className="dm-registry-metadata">
      <div><dt>{role === "clinic" ? "Поставщик" : "Клиника"}</dt><dd>{item.participants.filter(p => p.organizationId !== organizationId).map(p => p.organization.displayName).join(", ") || "Не указан"}</dd></div>
      <div><dt>Сумма</dt><dd>{formatDocumentAmount(item.amountMinor, item.currency)}</dd></div>
      <div><dt>Заказ</dt><dd>{item.supplierOrder ? <a href={`/${role}/orders/${item.supplierOrder.id}`}>{item.supplierOrder.orderNumber}</a> : "Не связан"}</dd></div>
      <div><dt>Версия</dt><dd>{item.version}</dd></div>
      <div><dt>Номер документа</dt><dd>{item.documentNumber}</dd></div>
      <div><dt>Файл</dt><dd>{item.fileName ?? item.format}</dd></div>
    </dl>
    <section><h3>Связанные документы</h3>
      {item.supplierOrder ? <p className="dm-registry-muted">По заказу {item.supplierOrder.orderNumber}</p> : <p className="dm-registry-muted">Документ не связан с заказом.</p>}
      <div className="dm-registry-related">{related.items.filter(row => row.id !== id).map(row => <DmAction key={row.id} variant="row" onClick={() => onSelect(row.id)}><span><strong>{row.title}</strong><span className="dm-registry-muted">{showDate(row.documentDate)}</span></span><DocumentStatus value={row.status} /></DmAction>)}</div>
      {relatedBusy ? <Spinner size="tiny" label="Загружаем связанные документы" /> : null}
      {relatedError ? <ActionFeedback tone="error" description="Не удалось загрузить связанные документы." action={<DmButton onClick={() => setRelatedRetry(n => n + 1)}>Повторить</DmButton>} /> : !relatedBusy && orderId && !related.items.some(row => row.id !== id) ? <p className="dm-registry-muted">Других документов по заказу пока нет.</p> : null}
      {related.nextCursor ? <DmButton disabled={relatedBusy} onClick={() => {
        if (!orderId || moreLock.current) return;
        moreLock.current = true; setRelatedBusy(true); setRelatedError(false); const current = generation.current;
        void actions.onRelatedDocuments(orderId, related.nextCursor!).then(page => { if (generation.current === current) setRelated(previous => ({ items: [...previous.items, ...page.items], nextCursor: page.nextCursor })); }).catch(() => { if (generation.current === current) setRelatedError(true); }).finally(() => { if (generation.current === current) { moreLock.current = false; setRelatedBusy(false); } });
      }}>Ещё связанные документы</DmButton> : null}
    </section>
    <section><h3>Подписи</h3>{item.signatures.length ? item.signatures.map(signature => <p key={signature.id}>{signature.signerName ?? "Подписант"} · {statusLabels[signature.status] ?? signature.status}{signature.signedAt ? ` · ${showDate(signature.signedAt)}` : ""}</p>) : <p className="dm-registry-muted">Подписи не зарегистрированы.</p>}</section>
    <details><summary>История версий · {item.versions.length || 1}</summary><div className="dm-registry-related">{item.versions.length ? item.versions.map(version => <DmAction variant="row" key={version.id} disabled={version.id === id} onClick={() => onSelect(version.id)}>Версия {version.version} · {showDate(version.documentDate)} · {statusLabels[version.status] ?? version.status}</DmAction>) : <p>Текущая версия: {item.version}</p>}</div></details>
    {has("document.accounting.review") && ["PAYMENT", "CLOSING"].includes(item.category) && item.accountingStatus !== "NOT_APPLICABLE" ? <details><summary>Бухгалтерская обработка</summary><div className="dm-registry-accounting">
      <DmField label="Новый бухгалтерский статус"><DmSelect value={status} onChange={(_, data) => setStatus(data.value as typeof status)}><option value="REVIEWED">Проверен</option><option value="RECONCILED">Сверен</option><option value="DISPUTED">Есть расхождение</option></DmSelect></DmField>
      <DmField label="Основание изменения" required><DmTextarea value={reason} onChange={(_, data) => setReason(data.value)} /></DmField>
      <DmButton disabled={busy || reason.trim().length < 2} onClick={() => void run(async () => { const current = generation.current; const updated = await actions.onAccountingStatus(item, status, reason); if (current === generation.current) { setItem(updated); setReason(""); setNotice("Бухгалтерская отметка сохранена"); } })}>Сохранить отметку</DmButton>
    </div></details> : null}
  </div> : failure ? <ActionFeedback tone="error" description="Не удалось открыть документ. Проверьте доступ и повторите попытку." action={<DmButton onClick={() => setRetry(n => n + 1)}>Повторить загрузку документа</DmButton>} /> : <Spinner label="Загружаем документ" />;
  const close = <DmButton appearance="subtle" icon={<Dismiss24Regular />} aria-label="Закрыть документ" onClick={onClose} />;
  return mobile ? <OverlayDrawer className="dm-registry-overlay" open position="end" size="full" onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
    <DrawerHeader><DrawerHeaderTitle action={close}>{item?.title ?? "Документ"}</DrawerHeaderTitle></DrawerHeader><DrawerBody>{content}</DrawerBody>
  </OverlayDrawer> : <aside ref={panel} tabIndex={-1} role="region" aria-label="Карточка документа" className="dm-registry-detail" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <div className="dm-registry-detail-heading"><h2>{item?.title ?? "Документ"}</h2>{close}</div>{content}
  </aside>;
}
