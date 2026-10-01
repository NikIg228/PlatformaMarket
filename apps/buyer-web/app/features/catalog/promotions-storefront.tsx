"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketplaceApiClient, frontendFeatures } from "@marketplace/api-client";
import type { PromotionListQuery, PublicPromotionPage } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, EmptyState, ErrorState, LoadingState, Section, errorMessage, formatDate, formatMoney } from "@marketplace/ui";
import { fetchLiveCatalog } from "../../catalog/live-search";
import type { SearchResult } from "../../catalog-search-types";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";

export function PromotionsStorefront({ featured = false, productId }: { featured?: boolean; productId?: string }) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api", {}), []);
  const [page, setPage] = useState<PublicPromotionPage | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<Partial<PromotionListQuery>>({ limit: featured ? 4 : 12, offset: 0, featured: featured || undefined });
  const [draft, setDraft] = useState(""), [ready, setReady] = useState(featured || Boolean(productId)), [retry, setRetry] = useState(0);
  const [facets, setFacets] = useState<Pick<NonNullable<SearchResult["filterOptions"]>, "categories" | "suppliers"> | null>(null);
  useEffect(() => {
    if (featured || productId) return;
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const kind = params.get("kind");
      setQuery({ limit: 12, offset: Math.max(0, Math.min(10000, Number(params.get("offset")) || 0)), q: params.get("q") || undefined,
        categoryId: params.get("categoryId") || undefined, supplierOrganizationId: params.get("supplierOrganizationId") || undefined,
        kind: kind === "PERCENTAGE" || kind === "FIXED_AMOUNT" || kind === "BUY_X_GET_Y" ? kind : undefined, sort: params.get("sort") === "NEWEST" ? "NEWEST" : "ENDING" });
      setDraft(params.get("q") ?? ""); setReady(true);
    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [featured, productId]);
  useEffect(() => {
    if (!frontendFeatures.promotions || !ready) return;
    let active = true; setLoading(true); setError(null);
    api.listPublicPromotions({ ...query, ...(productId ? { productId } : {}) }).then(result => { if (active) setPage(result); }).catch(cause => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, query, ready, retry, productId]);
  useEffect(() => {
    if (featured || productId || !frontendFeatures.promotions) return;
    const controller = new AbortController();
    fetchLiveCatalog<SearchResult>(new URLSearchParams({ limit: "1", offset: "0", includeFilterOptions: "true" }), controller.signal).then(result => setFacets(result.filterOptions ?? null)).catch(() => { /* The promotions list remains independently usable; retry is explicit below. */ });
    return () => controller.abort();
  }, [featured, productId, retry]);
  const update = useCallback((value: Partial<PromotionListQuery>) => {
    const next = { ...query, offset: 0, ...value };
    setQuery(next);
    const params = new URLSearchParams(Object.entries(next).filter(([key, value]) => value !== undefined && value !== "" && key !== "limit").map(([key, value]) => [key, String(value)]));
    window.history.pushState(window.history.state, "", `${window.location.pathname}?${params}`);
  }, [query]);
  if (!frontendFeatures.promotions) return null;
  return <Section title={productId ? "Акции на этот товар" : "Акции поставщиков"} description="Условия действуют в указанный срок и в пределах доступного количества. При оформлении проверим цену и наличие подарка.">
    <div className="mp-stack">
      {!featured && !productId ? <form className="mp-stack" onSubmit={event => { event.preventDefault(); update({ q: draft }); }}>
        <DmField label="Поиск акций"><DmInput value={draft} onChange={(_, data) => setDraft(data.value)} /></DmField>
        <DmButton type="submit">Найти</DmButton>
        <DmField label="Механика"><DmSelect value={query.kind ?? ""} onChange={(_, data) => update({ kind: data.value as PromotionListQuery["kind"] || undefined })}><option value="">Все механики</option><option value="PERCENTAGE">Процентная скидка</option><option value="FIXED_AMOUNT">Фиксированная скидка</option><option value="BUY_X_GET_Y">Подарок N + M</option></DmSelect></DmField>
        {facets ? <>{([ ["categoryId", "Категория", facets.categories], ["supplierOrganizationId", "Поставщик", facets.suppliers] ] as const).map(([key, label, items]) => <DmField key={key} label={label}><DmSelect value={query[key] ?? ""} onChange={(_, data) => update({ [key]: data.value || undefined })}><option value="">Все</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</DmSelect></DmField>)}</> : <DmButton onClick={() => setRetry(value => value + 1)}>Загрузить категории и поставщиков</DmButton>}
        <DmField label="Сортировка"><DmSelect value={query.sort ?? "ENDING"} onChange={(_, data) => update({ sort: data.value as PromotionListQuery["sort"] })}><option value="ENDING">Скоро заканчиваются</option><option value="NEWEST">Сначала новые</option></DmSelect></DmField>
      </form> : null}
      {loading ? <LoadingState label="Загружаем акции" /> : error ? <ErrorState description={error} action={<DmButton onClick={() => setRetry(value => value + 1)}>Повторить загрузку</DmButton>} /> : page?.items.length ? page.items.map(item => <article key={item.id}>
        <h3><Link href={`/products/${item.productId}`}>{item.terms.name}</Link></h3>
        <p>{item.offerName} · {item.supplierName}</p><p>{item.terms.description}</p>
        {item.terms.kind === "BUY_X_GET_Y" ? <p>За {item.terms.buyQuantity} — подарок {item.giftName} × {item.terms.giftQuantity}. Цена покупки: {formatMoney(item.unitPriceMinor, item.currency)}.</p> : <p>Обычная цена: <s>{formatMoney(item.baseAmountMinor, item.currency)}</s> · Цена по акции: <strong>{formatMoney(item.unitPriceMinor, item.currency)}</strong></p>}
        <p>От {item.terms.minimumQuantity} · до {formatDate(item.terms.endsAt)}. С другими скидками не суммируется.</p>
        <Link href={`/products/${item.productId}`}>Выбрать предложение</Link>
      </article>) : <EmptyState title="Действующих акций нет" description="Измените фильтры или вернитесь позже." />}
      {featured ? <Link href="/promotions">Все акции</Link> : !productId ? <div><DmButton disabled={loading || !query.offset} onClick={() => update({ offset: Math.max(0, (query.offset ?? 0) - 12) })}>Назад</DmButton> <DmButton disabled={loading || !page || (query.offset ?? 0) + page.items.length >= page.total} onClick={() => update({ offset: (query.offset ?? 0) + 12 })}>Далее</DmButton></div> : null}
    </div>
  </Section>;
}
export default function PromotionsPage() {
  return <><MarketplaceHeader showCity={false} /><main className="mp-stack"><Link href="/">← Каталог</Link>{frontendFeatures.promotions ? <PromotionsStorefront /> : <p>Акции недоступны в текущем профиле.</p>}</main></>;
}
