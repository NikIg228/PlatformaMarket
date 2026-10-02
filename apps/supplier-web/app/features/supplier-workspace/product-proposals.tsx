"use client";
import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { ProductCandidateHistoryResponse } from "@marketplace/schemas";
import { DmButton, DmTable, ErrorState, Section, errorMessage, formatDate } from "@marketplace/ui";

export function ProductProposals({ api, onChanged, onRetry, hideHeading = false }: { api: MarketplaceApiClient; onChanged: () => Promise<void>; onRetry?: (item: ProductCandidateHistoryResponse["items"][number]) => void; hideHeading?: boolean }) {
  const [history, setHistory] = useState<ProductCandidateHistoryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const load = async (more = false) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    const request = ++sequence.current;
    try {
      const result = await api.listProductSubmissions(more && history?.nextCursor ? { cursor: history.nextCursor } : {});
      if (request !== sequence.current) return;
      setHistory(previous => ({ ...result, items: more ? [...(previous?.items ?? []), ...result.items] : result.items }));
      if (!more) await onChanged();
    } catch (cause) { if (request === sequence.current) setError(errorMessage(cause)); }
    finally { if (request === sequence.current) { inFlight.current = false; setBusy(false); } }
  };
  useEffect(() => { void load(); return () => { sequence.current++; inFlight.current = false; }; }, [api]);
  return <Section title={hideHeading ? undefined : "Заявки на новые товары"} description={hideHeading ? undefined : "Одобренная заявка создаёт скрытый черновик в ваших предложениях. Заполните цену и остаток, затем опубликуйте его."}>
    <DmButton disabled={busy} onClick={() => void load()}>Обновить мои заявки</DmButton>
    {busy ? <p role="status">Загружаем заявки…</p> : null}
    {error ? <ErrorState description={error} /> : null}
    {history?.items.length === 0 ? <p>Заявок пока нет.</p> : null}
    {history?.items.length ? <DmTable caption="Мои заявки на товары" columns={[{ key: "name", label: "Товар" }, { key: "status", label: "Решение" }]}>
      {history.items.map(item => <tr key={item.id}><td data-label="Товар"><details><summary>{item.proposedName}</summary><p>Отправлена: {formatDate(item.createdAt, true)}</p><p>Артикул: {item.proposedSku ?? "не указан"} · Бренд: {item.proposedBrand ?? "не указан"} · GTIN: {item.proposedGtin ?? "не указан"}</p>{item.decidedAt ? <p>Решение: {formatDate(item.decidedAt, true)}</p> : null}</details></td><td data-label="Решение">{item.status === "PENDING" ? "На проверке" : item.status === "APPROVED" ? "Одобрено — настройте предложение в разделе товаров" : `Отклонено: ${item.rejectionReason ?? "уточните у оператора"}`}{item.status === "REJECTED" && onRetry ? <DmButton onClick={() => onRetry(item)}>Исправить и подать заново</DmButton> : null}</td></tr>)}
    </DmTable> : null}
    {history?.nextCursor ? <DmButton disabled={busy} onClick={() => void load(true)}>Более ранние заявки</DmButton> : null}
  </Section>;
}
