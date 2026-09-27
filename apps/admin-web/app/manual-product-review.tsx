"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { ManualProductReviewQueue } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, EmptyState, ErrorState, LoadingState, Section, errorMessage } from "@marketplace/ui";
import { adminApiContext } from "./admin-auth";
import { createCatalogImportSlug } from "./catalog-workflow-view-model";

type Review = ManualProductReviewQueue["items"][number];
function Proposal({ review, options, api, reload }: { review: Review; options: ManualProductReviewQueue["options"]; api: MarketplaceApiClient; reload: () => Promise<void> }) {
  const [name, setName] = useState(review.proposedName);
  const [slug, setSlug] = useState(createCatalogImportSlug(review.proposedName, review.id));
  const [productType, setProductType] = useState("MATERIAL");
  const [industry, setIndustry] = useState(options.industries[0]?.id ?? "");
  const [category, setCategory] = useState(options.categories.find(item => item.industryId === industry)?.id ?? "");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<string | null>(null);
  const inFlight = useRef(false);
  const decide = async (approve: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      if (approve) {
        const { approveProductCandidateSchema } = await import("@marketplace/schemas");
        const parsed = approveProductCandidateSchema.safeParse({ canonicalName: name, slug, productType, industryIds: [industry], categoryIds: [category], saleUnitId: unit, packageQuantity: Number(quantity.replace(",", ".")) });
        if (!parsed.success) throw new Error("Проверьте название, адрес карточки, классификацию, единицу и количество в упаковке.");
        await api.approveProductCandidate(review.id, parsed.data);
      } else {
        if (reason.trim().length < 3) throw new Error("Укажите понятную поставщику причину отказа (не менее 3 символов).");
        await api.rejectProductCandidate(review.id, { reason: reason.trim() });
      }
      setDecided(approve ? "Товар утверждён. Поставщику создан скрытый черновик предложения." : "Заявка отклонена. Причина доступна поставщику.");
      await reload();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  if (decided) return <Section title={review.proposedName}><p role="status">{decided}</p></Section>;
  return <Section title={review.proposedName} description={`Поставщик: ${review.supplier.displayName}`}>
    <p>Артикул: {review.proposedSku ?? "не указан"} · Штрихкод: {review.proposedGtin ?? "не указан"} · Бренд: {review.proposedBrand ?? "не указан"}</p>
    <p>{review.description ?? "Дополнительные материалы не представлены."}</p>
    {error ? <ErrorState description={error} /> : null}
    <form className="mp-stack" onSubmit={event => { event.preventDefault(); void decide(true); }}>
      <DmField label="Каноническое название" required><DmInput value={name} disabled={busy} onChange={(_, data) => setName(data.value)} /></DmField>
      <DmField label="Адрес карточки (slug)" required><DmInput value={slug} disabled={busy} onChange={(_, data) => setSlug(data.value)} /></DmField>
      <DmField label="Тип товара" required><DmInput value={productType} disabled={busy} onChange={(_, data) => setProductType(data.value)} /></DmField>
      <DmField label="Индустрия" required><DmSelect value={industry} disabled={busy} onChange={(_, data) => { setIndustry(data.value); setCategory(options.categories.find(item => item.industryId === data.value)?.id ?? ""); }}>{options.industries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</DmSelect></DmField>
      <DmField label="Категория" required><DmSelect value={category} disabled={busy} onChange={(_, data) => setCategory(data.value)}>{options.categories.filter(item => item.industryId === industry).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</DmSelect></DmField>
      <DmField label="Базовая единица" required><DmSelect value={unit} disabled={busy} onChange={(_, data) => setUnit(data.value)}><option value="">Выберите единицу</option>{options.units.map(item => <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>)}</DmSelect></DmField>
      <DmField label="Базовых единиц в упаковке" required><DmInput inputMode="decimal" value={quantity} disabled={busy} onChange={(_, data) => setQuantity(data.value)} /></DmField>
      <DmButton type="submit" appearance="primary" disabled={busy}>Утвердить товар и создать черновик предложения</DmButton>
      <p>Публикация остаётся выключенной. Поставщик заполнит цену и остаток самостоятельно.</p>
      <DmField label="Причина отказа"><DmInput maxLength={500} value={reason} disabled={busy} onChange={(_, data) => setReason(data.value)} /></DmField>
      <DmButton disabled={busy} onClick={() => void decide(false)}>Отклонить заявку</DmButton>
    </form>
  </Section>;
}

export function ManualProductReview() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api", adminApiContext()), []);
  const [queue, setQueue] = useState<ManualProductReviewQueue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async (cursor?: string) => {
    setBusy(true); setError(null);
    try { const next = await api.listManualProductReviews(cursor ? { cursor } : {}); setQueue(previous => ({ ...next, items: cursor ? [...(previous?.items ?? []), ...next.items] : next.items })); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  return <Section title="Заявки поставщиков на новые товары" description="Проверьте материалы и дубли. Одобрение создаёт мастер-карточку и скрытое предложение.">
    <DmButton disabled={busy} onClick={() => void reload()}>Обновить очередь заявок</DmButton>
    {error ? <ErrorState description={error} /> : null}
    {busy ? <LoadingState label="Загружаем заявки" /> : null}
    {queue?.items.length === 0 ? <EmptyState title="Новых заявок нет" description="Ручные заявки поставщиков появятся здесь." /> : null}
    {queue?.items.map(review => <Proposal key={review.id} review={review} options={queue.options} api={api} reload={() => reload()} />)}
    {queue?.nextCursor ? <DmButton disabled={busy} onClick={() => void reload(queue.nextCursor!)}>Следующие заявки</DmButton> : null}
  </Section>;
}
