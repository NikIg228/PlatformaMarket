import { catalogMediaSchema, type CatalogSearchResponse } from "../../../packages/schemas/src/core-api";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type CatalogProduct = CatalogSearchResponse["items"][number];
export type CatalogMedia = CatalogProduct["media"][number];
export type NativeCatalogMediaPort = Readonly<{ available(scope: ReadScope): boolean; uri(scope: ReadScope, media: CatalogMedia): string | undefined }>;
export type NativeCatalogMediaClient = { nativeCatalogMedia?: NativeCatalogMediaPort };
export class NativeCatalogMediaError extends Error { constructor() { super("Catalog media context is unavailable"); this.name = "NativeCatalogMediaError"; } }
/** Resolve only the producer's signed normalized-media path on the owned API. No importer URL, storage key, signing or session bearer. */
export function bindNativeCatalogMedia(scope: ReadScope, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeCatalogMediaError());
  const port: NativeCatalogMediaPort = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    uri(candidate, media) {
      lifetime.assert(candidate);
      try {
        const checked = catalogMediaSchema.pick({ id: true, securePath: true, normalizedStorageKey: true }).strip().safeParse(media); lifetime.assert(candidate);
        if (!checked.success || !checked.data.normalizedStorageKey || !checked.data.securePath) return undefined;
        const { id, securePath } = checked.data, prefix = `/catalog/media/${id}?`;
        if (!securePath.startsWith(prefix) || /[\\\r\n#]/.test(securePath)) return undefined;
        const query = new URLSearchParams(securePath.slice(prefix.length)), ticket = query.get("ticket");
        if (query.size !== 1 || query.getAll("ticket").length !== 1 || !ticket || !/^[1-9]\d{0,15}\.[A-Za-z0-9_-]{43}$/.test(ticket) || !Number.isSafeInteger(Number(ticket.split(".")[0]))) return undefined;
        const uri = `${lifetime.owner.environment}/catalog/media/${encodeURIComponent(id)}?${new URLSearchParams({ ticket })}`; lifetime.assert(candidate); return uri;
      } catch { lifetime.assert(candidate); return undefined; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); } });
}
