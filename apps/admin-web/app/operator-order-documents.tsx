"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { DocumentArchiveItem } from "@marketplace/schemas";
import { DmButton, DmDialog, ErrorState, LoadingState, StatusTag } from "@marketplace/ui";
import { errorMessage, formatDate, formatStatus } from "@marketplace/ui/format";
import { adminApiContext } from "./admin-auth";
import { useOperatorProjection } from "./use-operator-projection";
import styles from "./operator-orders.module.css";

export function OperatorOrderDocuments({ orderId }: { orderId: string }) {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [selected, setSelected] = useState<string>();
  const opener = useRef<HTMLElement | null>(null);
  const cursor = cursors[cursors.length - 1];
  return <div className={styles.section}>
    <DocumentPage key={cursor ?? "first"} orderId={orderId} cursor={cursor} previous={cursors.length > 1 ? () => setCursors(value => value.slice(0, -1)) : undefined} next={value => setCursors(list => [...list, value])} select={(id, trigger) => { opener.current = trigger; setSelected(id); }} />
    {selected ? <DocumentDialog key={selected} orderId={orderId} id={selected} close={() => { setSelected(undefined); if (opener.current?.isConnected) opener.current.focus(); }} /> : null}
  </div>;
}
function DocumentPage({ orderId, cursor, previous, next, select }: { orderId: string; cursor?: string; previous?: () => void; next: (cursor: string) => void; select: (id: string, trigger: HTMLElement) => void }) {
  const read = useCallback((api: MarketplaceApiClient) => api.listDocumentArchive({ supplierOrderId: orderId, cursor, limit: 25 }), [orderId, cursor]);
  const { data, loading, error, refresh } = useOperatorProjection(read, true);
  return <div className={styles.section} aria-busy={loading}>
    {loading && !data ? <LoadingState label="Загружаем документы заказа" /> : null}
    {error ? <ErrorState presentation="inline" title="Документы недоступны" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку документов</DmButton>} /> : null}
    {data?.items.length === 0 ? <p>Доступных документов на этой странице нет. Неопубликованные черновики сторон могут быть скрыты.</p> : null}
    {data?.items.filter(document => document.supplierOrder?.id === orderId).map(document => <div key={document.id} className={styles.header}><div><h4>{document.title}</h4><p>{document.documentNumber} · редакция {document.version} · {formatDate(document.documentDate)}</p><StatusTag>{formatStatus(document.status)}</StatusTag></div><DmButton onClick={event => select(document.id, event.currentTarget)}>Открыть документ {document.documentNumber} · {document.version}</DmButton></div>)}
    {data && (previous || data.nextCursor) ? <nav className={styles.actions} aria-label="Страницы документов"><DmButton disabled={!previous || loading} onClick={previous}>Предыдущие документы</DmButton><DmButton disabled={!data.nextCursor || loading} onClick={() => data.nextCursor && next(data.nextCursor)}>Следующие документы</DmButton></nav> : null}
  </div>;
}

export function DocumentDialog({ orderId, id, close }: { orderId: string; id: string; close: () => void }) {
  const [open, setOpen] = useState(true);
  const [versionId, setVersionId] = useState(id);
  const [busy, setBusy] = useState(false), [downloadError, setDownloadError] = useState("");
  const alive = useRef(true), lock = useRef(false);
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const read = useCallback(async (client: MarketplaceApiClient) => {
    const document = await client.getArchiveDocument(versionId);
    if (document.supplierOrder?.id !== orderId) throw new Error("Документ не относится к этому заказу");
    return document;
  }, [orderId, versionId]);
  const { data, loading, error, refresh } = useOperatorProjection(read, true);
  const current = data?.id === versionId ? data : null;
  const download = async () => {
    if (!current || lock.current) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lock.current = true; setBusy(true); setDownloadError("");
    try {
      const file = await api.downloadDocument(current.id);
      if (!alive.current) return;
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a"); link.href = url; link.download = file.fileName ?? current.fileName ?? "document.pdf"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { if (alive.current) setDownloadError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) { setBusy(false); requestAnimationFrame(() => { if (alive.current && trigger?.isConnected) trigger.focus(); }); } }
  };
  return <DmDialog open={open} title={current?.title ?? "Документ заказа"} onOpenChange={setOpen} onClosed={close} actions={<><DmButton disabled={!current || loading || busy} onClick={() => void download()}>Скачать оригинальный файл</DmButton><DmButton onClick={() => setOpen(false)}>Закрыть</DmButton></>}>
    <div className={styles.section}>{loading && !current ? <LoadingState label="Открываем документ" /> : null}
      {error ? <ErrorState presentation="inline" title="Документ недоступен" description={error} action={<DmButton onClick={() => void refresh()}>Повторить открытие</DmButton>} /> : null}
      {downloadError ? <ErrorState presentation="inline" title="Файл не скачан" description={downloadError} /> : null}
      {current ? <><p>{current.documentNumber} · редакция {current.version} · {formatStatus(current.status)}</p><p>Контрольная сумма: {current.checksumSha256 ?? "Не сохранена"}</p>
        <DocumentSignatures document={current} />
        <h4>История версий</h4><div className={styles.actions}>{current.versions.map(version => <DmButton key={version.id} disabled={busy || loading || version.id === versionId} onClick={() => { setVersionId(version.id); setDownloadError(""); }}>Редакция {version.version} · {formatStatus(version.status)}</DmButton>)}</div>
      </> : null}
    </div>
  </DmDialog>;
}
function DocumentSignatures({ document }: { document: DocumentArchiveItem }) {
  const signers = document.participants.filter(party => party.role === "SIGNER");
  return <><h4>Подписанты и подписи</h4><p>Требуемые подписанты: {signers.length ? signers.map(party => party.organization.displayName).join(", ") : "план сторон не задан в архиве"}.</p>
    {!document.signatures.length ? <p>Подписи отсутствуют.</p> : document.signatures.map(signature => <p key={signature.id}>{signature.signerName ?? document.participants.find(party => party.organizationId === signature.signerOrganizationId)?.organization.displayName ?? "Подписант не указан"}: {formatStatus(signature.status)} · {signature.method === "MOCK" ? "Тестовая подпись" : signature.method} · {formatDate(signature.signedAt, true)}</p>)}
    <p>Архивный статус не подтверждает проверку НУЦ и полномочий подписантов. Подписанное закрытие требует отдельной проверки.</p>
  </>;
}
