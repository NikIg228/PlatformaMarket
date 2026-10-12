const key = "marketplace:catalog-position";
type Position = { url: string; productId: string; top: number; scroll: number };
export function rememberCatalogPosition(url: string, productId: string, card: HTMLElement) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ url, productId, top: card.getBoundingClientRect().top, scroll: window.scrollY } satisfies Position));
  } catch { /* Browsing remains available when storage is disabled. */ }
}
export function restoreCatalogPosition(url: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw) as Position;
    if (saved.url !== url || !Number.isFinite(saved.top) || !Number.isFinite(saved.scroll) || typeof saved.productId !== "string") return;
    const card = Array.from(document.querySelectorAll<HTMLElement>("[data-catalog-product]")).find(node => node.dataset.catalogProduct === saved.productId);
    window.scrollTo({ top: card ? window.scrollY + card.getBoundingClientRect().top - saved.top : saved.scroll, behavior: "instant" });
    sessionStorage.removeItem(key);
  } catch { /* A missing or outdated position must not block fresh catalog data. */ }
}
