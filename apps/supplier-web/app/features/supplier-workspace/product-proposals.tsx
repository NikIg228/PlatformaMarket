"use client";
import { useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { ProductCandidateHistoryResponse } from "@marketplace/schemas";
import { DmButton, DmTable, ErrorState, Section, errorMessage } from "@marketplace/ui";

export function ProductProposals({ api, onChanged }: { api: MarketplaceApiClient; onChanged: () => Promise<void> }) {
  const [history, setHistory] = useState<ProductCandidateHistoryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const load = async (more = false) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await api.listProductSubmissions(more && history?.nextCursor ? { cursor: history.nextCursor } : {});
      setHistory(previous => ({ ...result, items: more ? [...(previous?.items ?? []), ...result.items] : result.items }));
      if (!more) await onChanged();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <Section title="Заявки на новые товары" description="Одобренная заявка создаёт скрытый черновик в ваших предложениях. Заполните цену и остаток, затем опубликуйте его.">
    <DmButton disabled={busy} onClick={() => void load()}>Обновить мои заявки</DmButton>
    {error ? <ErrorState description={error} /> : null}
    {history?.items.length === 0 ? <p>Заявок пока нет.</p> : null}
    {history?.items.length ? <DmTable caption="Мои заявки на товары" columns={[{ key: "name", label: "Товар" }, { key: "status", label: "Решение" }]}>
      {history.items.map(item => <tr key={item.id}><td data-label="Товар">{item.proposedName}</td><td data-label="Решение">{item.status === "PENDING" ? "На проверке" : item.status === "APPROVED" ? "Одобрено — настройте предложение в списке ниже" : `Отклонено: ${item.rejectionReason ?? "уточните у оператора"}`}</td></tr>)}
    </DmTable> : null}
    {history?.nextCursor ? <DmButton disabled={busy} onClick={() => void load(true)}>Более ранние заявки</DmButton> : null}
  </Section>;
}
