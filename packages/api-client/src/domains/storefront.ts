import type { ClientTransport } from "../transport-contract";
import type { CatalogSearchResponse, SaveSupplierStorefront, SupplierStorefront, SupplierStorefrontQuery, SupplierStorefrontSettings, UploadSupplierLogo } from "@marketplace/schemas";

const publicPath = (id: string) => `/catalog/suppliers/${encodeURIComponent(id)}`;
const settingsPath = (id: string) => `/suppliers/${encodeURIComponent(id)}/storefront`;
export function supplierStorefront(api: ClientTransport, id: string, signal?: AbortSignal) {
  return api.get<SupplierStorefront>(publicPath(id), { signal });
}
export function searchSupplierStorefront(api: ClientTransport, id: string, input: SupplierStorefrontQuery, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) query.set(key, String(value));
  return api.get<CatalogSearchResponse>(`${publicPath(id)}/search?${query}`, { signal });
}
export function supplierStorefrontSettings(api: ClientTransport, id: string) { return api.get<SupplierStorefrontSettings>(settingsPath(id)); }
export function saveSupplierStorefront(api: ClientTransport, id: string, input: SaveSupplierStorefront) { return api.post<SupplierStorefrontSettings>(settingsPath(id), input); }
export function uploadSupplierLogo(api: ClientTransport, id: string, input: UploadSupplierLogo) { return api.post<SupplierStorefrontSettings>(`${settingsPath(id)}/logo`, input); }
