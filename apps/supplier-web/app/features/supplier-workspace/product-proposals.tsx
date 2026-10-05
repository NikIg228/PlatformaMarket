"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { ProductCandidateHistoryResponse, ProductCandidateSummary } from "@marketplace/schemas";
import { DmButton, DmDropdown, DmInput, ErrorState, LoadingState, ProductThumbnail, StatusTag, errorMessage, formatDate, productWorkflowStyles as s } from "@marketplace/ui";
import { Add20Regular } from "@fluentui/react-icons/svg/add";
import { Search20Regular } from "@fluentui/react-icons/svg/search";
import { Checkmark20Regular } from "@fluentui/react-icons/svg/checkmark";
import styles from "./product-proposals.module.css";
const labels = { PENDING: "На проверке", APPROVED: "Одобрена", REJECTED: "Отклонена" } as const;
export function ProductProposals({ api, onRetry, hideHeading = false, initialSelected }: { api: MarketplaceApiClient; onChanged: () => Promise<void>; onRetry?: (item: ProductCandidateSummary) => void; hideHeading?: boolean; initialSelected?: string }) {
  const [page, setPage] = useState<ProductCandidateHistoryResponse | null>(null), [selectedId, setSelectedId] = useState(initialSelected ?? "");
  const [draft, setDraft] = useState(""), [q, setQ] = useState(""), [status, setStatus] = useState<"" | ProductCandidateSummary["status"]>("");
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async (cursor?: string) => {
    const current = ++generation.current; setBusy(true); setError("");
    try {
      const result = await api.listProductSubmissions({ q, status: status || undefined, cursor });
      if (current !== generation.current) return;
      setPage(previous => ({ ...result, items: cursor ? [...(previous?.items ?? []), ...result.items] : result.items }));
    } catch (cause) { if (current === generation.current) setError(errorMessage(cause)); }
    finally { if (current === generation.current) setBusy(false); }
  }, [api, q, status]);
  useEffect(() => { setPage(null); void load(); return () => { generation.current++; }; }, [load]);
  const selected = page?.items.find(item => item.id === selectedId);
  return <div className={styles.workspace}>
    {!hideHeading ? <h2>Заявки на новые товары</h2> : null}
    <div className={styles.toolbarGrid}>
      <div className={styles.filters}><form className={s.search} onSubmit={event => { event.preventDefault(); setSelectedId(""); setQ(draft.trim()); }}><DmInput aria-label="Найти заявку" placeholder="Найти заявку" value={draft} contentBefore={<Search20Regular />} onChange={(_, data) => setDraft(data.value)} /><DmButton type="submit" icon={<Search20Regular />} aria-label="Найти заявку" /></form>
        <DmDropdown aria-label="Статус заявки" value={status} onChange={(_, data) => { setSelectedId(""); setStatus(data.value as typeof status); }}><option value="">Все статусы</option>{Object.entries(labels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</DmDropdown>
      </div>
      <div className={styles.primary}><DmButton as="a" href="/supplier/products/new?request=1" appearance="primary" icon={<Add20Regular />}>Новая заявка</DmButton></div>
    </div>
    {error ? <ErrorState description={error} action={<DmButton onClick={() => void load()}>Повторить загрузку заявок</DmButton>} /> : null}
    {busy && !page ? <LoadingState label="Загружаем заявки" /> : null}
    {page?.items.length === 0 ? <section className={`${s.panel} ${s.empty}`}><h2>{q || status ? "Заявки не найдены" : "Заявок пока нет"}</h2><p>{q || status ? "Измените поиск или статус." : "Здесь будут заявки на товары, которых пока нет в каталоге."}</p>{!q && !status ? <a href="/supplier/products/new?request=1">Подать первую заявку</a> : null}</section> : page ? <div className={styles.columns} data-selected={Boolean(selected)}>
      <section className={styles.list} aria-label="Список заявок"><table className={s.table}><thead><tr><th>Товар</th><th>Отправлена</th><th>Статус</th></tr></thead><tbody>{page.items.map(item => <tr key={item.id} data-selected={item.id === selectedId}>
        <td data-label="Товар"><button className={styles.select} onClick={() => setSelectedId(item.id)} aria-pressed={item.id === selectedId}><ProductThumbnail name={item.proposedName} /><span>{item.proposedName}<small>{item.proposedSku ?? "Без артикула"}</small></span></button></td>
        <td data-label="Отправлена"><span>{formatDate(item.createdAt)}</span></td><td data-label="Статус"><StatusTag tone={item.status === "REJECTED" ? "danger" : item.status === "APPROVED" ? "success" : "warning"}>{labels[item.status]}</StatusTag></td>
      </tr>)}</tbody></table>{page.nextCursor ? <div className={styles.more}><DmButton disabled={busy} onClick={() => void load(page.nextCursor!)}>Более ранние заявки</DmButton></div> : null}</section>
      <aside className={`${s.panel} ${styles.details}`} aria-label="Подробности заявки">
        {selected ? <><DmButton className={styles.mobileBack} appearance="subtle" onClick={() => setSelectedId("")}>К списку заявок</DmButton><div className={s.identity}><ProductThumbnail name={selected.proposedName} /><div><h2>{selected.proposedName}</h2><small>Заявка №{selected.id.slice(0, 8)}</small></div></div>
          <section className={s.subsection}><h3>Статус заявки</h3><ol className={styles.timeline}>
            <li data-done="true"><span className={styles.dot}><Checkmark20Regular /></span><div><strong>Отправлена</strong><small>{formatDate(selected.createdAt, true)}</small></div></li>
            <li data-done={selected.status !== "PENDING"} aria-current={selected.status === "PENDING" ? "step" : undefined}><span className={styles.dot}>{selected.status !== "PENDING" ? <Checkmark20Regular /> : null}</span><div><strong>На проверке</strong></div></li>
            <li aria-current={selected.status !== "PENDING" ? "step" : undefined}><span className={styles.dot} /><div><strong>{selected.status === "PENDING" ? "Решение" : labels[selected.status]}</strong>{selected.decidedAt ? <small>{formatDate(selected.decidedAt, true)}</small> : null}</div></li>
          </ol></section>
          {selected.status === "PENDING" ? <p className={s.notice}>Проверяем сведения о товаре. Дополнительных действий пока не требуется.</p> : selected.status === "REJECTED" ? <div className={styles.rejection}><strong>Причина отказа</strong><p>{selected.rejectionReason ?? "Причина не указана. Обратитесь в поддержку."}</p></div> : <p className={s.notice}>Карточка одобрена. Проверьте цену и остаток перед публикацией предложения.</p>}
          <section className={s.subsection}><h3>Сведения о товаре</h3><dl className={s.metadata}><dt>Бренд</dt><dd>{selected.proposedBrand ?? "Не указан"}</dd><dt>Артикул</dt><dd>{selected.proposedSku ?? "Не указан"}</dd><dt>Штрихкод</dt><dd>{selected.proposedGtin ?? "Не указан"}</dd></dl>{selected.description ? <p className={styles.description}>{selected.description}</p> : null}</section>
          {selected.status === "REJECTED" && onRetry ? <DmButton appearance="primary" onClick={() => onRetry(selected)}>Исправить и подать заново</DmButton> : null}
          {selected.status === "APPROVED" ? selected.offerId ? <DmButton as="a" appearance="primary" href={`/supplier/products?offer=${selected.offerId}&edit=1`}>Заполнить цену и остаток</DmButton> : <a href="/supplier/products">Найти предложение в товарах</a> : null}
        </> : <div className={s.empty}><h2>Выберите заявку</h2><p>Здесь появятся сведения о товаре и ход рассмотрения.</p></div>}
      </aside>
    </div> : null}
  </div>;
}
