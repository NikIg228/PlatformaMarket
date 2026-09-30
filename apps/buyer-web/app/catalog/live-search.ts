import { resilientGet } from "../resilient-get";

export async function fetchLiveCatalog<T extends { items: unknown[]; total: number }>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  // Geography must be explicit. The retired header's persisted city is not a current filter.
  const response = await resilientGet(`/catalog-search?${params}`, { cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Каталог временно недоступен. Запрос и фильтры сохранены — повторите загрузку.");
  const result = await response.json() as T;
  if (!Array.isArray(result?.items) || typeof result.total !== "number") throw new Error("Не удалось получить актуальный каталог. Повторите загрузку.");
  return result;
}

type CatalogPage = { items: { id: string }[]; total: number; nextOffset?: number };

export function appendCatalogPage<T extends CatalogPage>(previous: CatalogPage | null, next: T): T & { nextOffset: number } {
  const items = new Map([...(previous?.items ?? []), ...next.items].map(item => [item.id, item]));
  return {
    ...next,
    items: Array.from(items.values()),
    // Offset counts API rows, not the number of unique cards displayed.
    nextOffset: next.items.length
      ? (previous?.nextOffset ?? previous?.items.length ?? 0) + next.items.length
      : next.total,
  };
}

/** Restore the previously loaded window using bounded API pages, never a snapshot. */
export async function loadCatalogWindow<T extends CatalogPage>(load: (offset: number, limit: number) => Promise<T>, count: number): Promise<T & { nextOffset: number }> {
  let result = appendCatalogPage(null, await load(0, Math.min(24, count)));
  while (result.nextOffset < Math.min(count, result.total)) {
    const next = await load(result.nextOffset, Math.min(24, count - result.nextOffset));
    result = appendCatalogPage<T>(result, next);
  }
  return result;
}
