"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PrepareResupplyDocumentInput, ResupplyDocumentsResponse, ResupplyDocumentView } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmFormSections, DmTable, LoadingState, errorMessage, formatDate } from "./index";

export type ResupplyDocumentApi = {
  getResupplyDocuments(orderId: string, discrepancyId: string): Promise<ResupplyDocumentsResponse>;
  prepareResupplyDocument(orderId: string, discrepancyId: string, input: PrepareResupplyDocumentInput): Promise<ResupplyDocumentView>;
  downloadResupplyDocument(orderId: string, discrepancyId: string, documentId: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }>;
};
const labels = { TRANSFER: "Документ допоставки", SETTLEMENT: "Урегулирование недостачи" };
export function ResupplyDocumentPanel({ api, orderId, discrepancyId, revision }: { api: ResupplyDocumentApi; orderId: string; discrepancyId: string; revision: number }) {
  const [data, setData] = useState<ResupplyDocumentsResponse | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false), [reviewed, setReviewed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const pending = useRef<PrepareResupplyDocumentInput | null>(null), alive = useRef(true), sequence = useRef(0), working = useRef(false);
  const load = useCallback(async () => {
    const seq = ++sequence.current; setLoading(true);
    try { const next = await api.getResupplyDocuments(orderId, discrepancyId); if (alive.current && seq === sequence.current) { setData(next); setError(""); setReviewed(true); } }
    catch (cause) { if (alive.current && seq === sequence.current) setError(errorMessage(cause)); }
    finally { if (alive.current && seq === sequence.current) setLoading(false); }
  }, [api, orderId, discrepancyId]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; ++sequence.current; }; }, [load, revision]);
  async function prepare(kind: PrepareResupplyDocumentInput["kind"]) {
    if (!data?.resupplyVersion || working.current || conflict) return;
    working.current = true; setBusy(true); setError(""); setNotice("");
    pending.current ??= { kind, expectedOrderVersion: data.orderVersion, expectedShipmentVersion: data.shipmentVersion,
      expectedExceptionVersion: data.exceptionVersion, expectedResupplyVersion: data.resupplyVersion, idempotencyKey: crypto.randomUUID() };
    try {
      const result = await api.prepareResupplyDocument(orderId, discrepancyId, pending.current);
      pending.current = null;
      if (alive.current) { setUncertain(false); setSelected(result.documentId); setNotice("Рабочий черновик сохранён. Подписи отсутствуют."); await load(); }
    } catch (cause) {
      if (!alive.current) return;
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : null;
      const definitive = typeof status === "number" && status >= 400 && status < 500 && status !== 408;
      if (definitive) pending.current = null;
      setUncertain(!definitive); setError(errorMessage(cause));
      if (status === 409) { setConflict(true); setReviewed(false); }
    } finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function download(documentId: string) {
    if (working.current) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    working.current = true; setBusy(true); setError("");
    try {
      const file = await api.downloadResupplyDocument(orderId, discrepancyId, documentId);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(file.contentBase64), c => c.charCodeAt(0))], { type: file.mimeType }));
      const link = document.createElement("a"); link.href = url; link.download = file.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { working.current = false; if (alive.current) { setBusy(false); requestAnimationFrame(() => { if (alive.current && trigger?.isConnected) trigger.focus(); }); } }
  }
  const disabled = busy || loading || uncertain || conflict;
  return <section aria-label="Рабочие документы допоставки"><DmFormSections>
    <h3>Рабочие документы допоставки</h3>
    <DmFeedback presentation="note" tone="warning" title="Формы ещё не утверждены" description="Это рабочие черновики без подписей. Они доступны обеим сторонам, сохраняют историю и не закрывают расхождение. Подписание станет доступно после утверждения форм, полномочий и подключения НУЦ." />
    {loading && !data ? <LoadingState label="Загружаем рабочие документы" /> : null}
    {error ? <><DmFeedback presentation="inline" tone="danger" title="Документы не обновлены" description={error} />{!uncertain && !conflict ? <DmButton disabled={busy || loading} onClick={() => void load()}>Повторить загрузку документов</DmButton> : null}</> : null}
    {notice ? <DmFeedback presentation="inline" tone="success" title="Черновик сохранён" description={notice} /> : null}
    {uncertain ? <><p>Результат подготовки пока неизвестен. Повтор сохранит тот же запрос.</p><DmButton disabled={busy} onClick={() => pending.current && void prepare(pending.current.kind)}>Повторить подготовку черновика</DmButton></> : null}
    {conflict ? <><p>Партии или заявление изменились. Сверьте актуальные количества перед новой подготовкой.</p><DmButton disabled={loading} onClick={() => void load()}>Сверить данные документов</DmButton>{reviewed ? <DmButton onClick={() => { setConflict(false); setError(""); }}>Данные документов проверены</DmButton> : null}</> : null}
    {data ? <>
      {data.issues.length ? <p>{data.issues.join(" ")}</p> : null}
      {data.settlementIssues.length ? <p>{data.settlementIssues.join(" ")}</p> : null}
      {data.party === "SUPPLIER" ? <div className="mp-inline-actions"><DmButton disabled={disabled || !data.canPrepare} onClick={() => void prepare("TRANSFER")}>Подготовить черновик допоставки</DmButton><DmButton disabled={disabled || !data.canPrepareSettlement} onClick={() => void prepare("SETTLEMENT")}>Подготовить черновик урегулирования</DmButton></div> : null}
      {!data.documents.length ? <p>Рабочих документов пока нет. Их подготавливает поставщик.</p> : data.documents.map(document => <article key={document.documentId}>
        <h4>{labels[document.snapshot.kind]} · редакция {document.version}</h4>
        <p>{document.status === "STALE" ? "Исторический черновик — данные изменились" : "Рабочий черновик — не подписано"} · {formatDate(document.snapshot.preparedAt, true)}</p>
        <div className="mp-inline-actions"><DmButton aria-expanded={selected === document.documentId} onClick={() => setSelected(selected === document.documentId ? null : document.documentId)}>Показать {labels[document.snapshot.kind].toLowerCase()} · редакция {document.version}</DmButton>
        <DmButton disabled={busy} onClick={() => void download(document.documentId)}>Скачать PDF · {labels[document.snapshot.kind].toLowerCase()} · редакция {document.version}</DmButton></div>
        {selected === document.documentId ? <div>
          <p>Исходная партия: {document.snapshot.sourceShipmentNumber}. Допоставка: {document.snapshot.resupplyShipmentNumber}.</p>
          <p>{document.snapshot.sourceDocumentId ? `Исходная накладная: редакция ${document.snapshot.sourceDocumentVersion}.` : "Исходная выпущенная накладная отсутствует."}</p>
          <p>{document.snapshot.reason}</p>
          <DmTable caption="Количества рабочего документа" columns={[{ key: "name", label: "Позиция" }, { key: "original", label: "Исходно" }, { key: "received", label: "Получено исходно" }, { key: "extra", label: "Допоставка" }, { key: "extraReceived", label: "Получено по допоставке" }]}>
            {document.snapshot.lines.map(line => <tr key={line.orderItemId}><td data-label="Позиция">{line.name} · {line.uom}</td><td data-label="Исходно">{line.originalQuantity}</td><td data-label="Получено исходно">{line.originalReceivedQuantity}</td><td data-label="Допоставка">{line.resupplyQuantity}</td><td data-label="Получено по допоставке">{line.receivedQuantity}</td></tr>)}
          </DmTable><p>Подготовил(а): {document.snapshot.preparedBy.name}. Подписи отсутствуют. Сумма заказа сохраняется.</p>
        </div> : null}
      </article>)}
    </> : null}
  </DmFormSections></section>;
}
