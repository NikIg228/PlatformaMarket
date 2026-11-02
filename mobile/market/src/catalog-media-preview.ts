import type { CatalogSearchResponse } from "../../../packages/schemas/src/core-api";
import type { CatalogMedia, CatalogProduct, NativeCatalogMediaPort } from "./native-catalog-media";
import type { ReadScope } from "./read-controller";
export type CatalogMediaSelection = Readonly<{ page: CatalogSearchResponse; product: CatalogProduct; productId: string; media: CatalogMedia; mediaId: string; path: string; uri: string; source: Readonly<{ uri: string; cache: "reload" }>; renderIdentity: number; position: number; total: number }>;
export type CatalogMediaState = Readonly<{ phase: "idle" }> | Readonly<{ phase: "loading" | "ready" | "error"; selection: CatalogMediaSelection }>;
const empty: CatalogMediaState = Object.freeze({ phase: "idle" });
/** Explicit normalized catalog previews only. Image failures never call auth refresh/logout or change commercial data. */
export function createCatalogMediaPreview(scope: ReadScope, port: NativeCatalogMediaPort | undefined, currentPage: () => CatalogSearchResponse | undefined) {
  let active = true, serial = 0, state = empty, timer: ReturnType<typeof setTimeout> | undefined; const listeners = new Set<() => void>();
  const supported = () => active && port?.available(scope) === true;
  const owns = (product: CatalogProduct) => { try { return supported() && currentPage()?.items.includes(product) === true; } catch { return false; } };
  const eligible = (product: CatalogProduct) => { if (!owns(product)) return []; const rows: { media: CatalogMedia; uri: string }[] = []; try { for (const media of product.media) { const uri = port!.uri(scope, media); if (uri) rows.push({ media, uri }); } } catch { return []; } return owns(product) ? rows : []; };
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const publish = (next: CatalogMediaState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
  const isCurrent = (selection: CatalogMediaSelection) => { try { return supported() && currentPage() === selection.page && selection.page.items.includes(selection.product) && selection.product.id === selection.productId && selection.product.media.includes(selection.media) && selection.media.id === selection.mediaId && selection.media.securePath === selection.path && port!.uri(scope, selection.media) === selection.uri; } catch { return false; } };
  const model = {
    supported, owns, eligible, isCurrent, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    viewFor(product: CatalogProduct): CatalogMediaState { return state.phase !== "idle" && state.selection.product === product && isCurrent(state.selection) ? state : empty; },
    open(product: CatalogProduct, wanted?: CatalogMedia) {
      const page = currentPage(); if (!page || !owns(product)) return;
      const rows = eligible(product), position = wanted === undefined ? 0 : rows.findIndex(row => row.media === wanted), chosen = rows[position]; if (!chosen || currentPage() !== page || !owns(product)) return;
      const selection: CatalogMediaSelection = Object.freeze({ page, product, productId: product.id, media: chosen.media, mediaId: chosen.media.id, path: chosen.media.securePath!, uri: chosen.uri, source: Object.freeze({ uri: chosen.uri, cache: "reload" }), renderIdentity: ++serial, position: position + 1, total: rows.length });
      if (!isCurrent(selection)) return; stopTimer(); publish({ phase: "loading", selection });
      timer = setTimeout(() => { if (state.phase === "loading" && state.selection === selection && isCurrent(selection)) { timer = undefined; publish({ phase: "error", selection }); } }, 20_000);
    },
    step(direction: -1 | 1) { if (state.phase === "idle" || !isCurrent(state.selection)) return; const { selection } = state, rows = eligible(selection.product), position = rows.findIndex(row => row.media === selection.media), next = rows[position + direction]; if (next) model.open(selection.product, next.media); },
    loaded(selection: CatalogMediaSelection) { if (state.phase === "loading" && state.selection === selection && isCurrent(selection)) { stopTimer(); publish({ phase: "ready", selection }); } },
    failed(selection: CatalogMediaSelection) { if (state.phase !== "idle" && state.phase !== "error" && state.selection === selection && isCurrent(selection)) { stopTimer(); publish({ phase: "error", selection }); } },
    hide() { stopTimer(); publish(empty); },
    sync() { if (state.phase !== "idle" && !isCurrent(state.selection)) { stopTimer(); publish(empty); } },
    activate() { active = true; },
    close() { active = false; stopTimer(); state = empty; listeners.forEach(listener => listener()); listeners.clear(); },
  }; return model;
}
export type CatalogMediaPreview = ReturnType<typeof createCatalogMediaPreview>;
