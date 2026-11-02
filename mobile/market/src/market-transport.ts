import { DOCUMENT_UPLOAD_MAX_BYTES } from "../../../packages/schemas/src/document-upload-limits";
import { documentArchiveItemSchema } from "../../../packages/schemas/src/core-api";
import { parseArchiveInput } from "./document-archive-fixture-read";
import type { MobileReadClient } from "./read-controller";

export type AttachmentBinaryExpectation = Readonly<{ contentType: "image/png" | "image/jpeg"; sizeBytes: number }>;
type AttachmentBinaryReader = Pick<ReadableStreamDefaultReader<Uint8Array>, "read" | "cancel" | "releaseLock">;
export type FetchTransport = (url: string, init: RequestInit) => Promise<Pick<Response, "status" | "ok" | "text"> & { headers?: Pick<Headers, "get">; body?: { getReader(): AttachmentBinaryReader } | null }>;
export class AttachmentBinaryError extends Error { constructor(readonly code: "contract" | "size") { super("Attachment image response is unavailable"); this.name = "AttachmentBinaryError"; } }
export type MarketRequestMethod = "GET" | "POST" | "PATCH" | "DELETE";
export class MarketHttpError extends Error {
  constructor(readonly status: number, readonly payload: unknown) { super(`API request failed (${status})`); }
}
function interruptedRequest() {
  const error = new Error("API request interrupted"); error.name = "AbortError"; return error;
}
/** Observe native cancellation even if a fetch/body implementation does not settle on abort. */
function untilAbort<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true; signal.removeEventListener("abort", onAbort); complete();
    };
    const onAbort = () => finish(() => reject(interruptedRequest()));
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      Promise.resolve(work()).then(value => {
        if (signal.aborted) onAbort(); else finish(() => resolve(value));
      }, error => { if (signal.aborted) onAbort(); else finish(() => reject(error)); });
    } catch (error) { if (signal.aborted) onAbort(); else finish(() => reject(error)); }
  });
}
export function normalizeApiUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid API address");
  return url.href.replace(/\/+$/, "");
}
export function createMarketTransport(address: string, fetcher: FetchTransport) {
  const apiUrl = normalizeApiUrl(address);
  const active = new Set<AbortController>();
  return {
    apiUrl,
    cancelAll() { active.forEach(controller => controller.abort()); active.clear(); },
    /** Source support/conversation downloads only; stream is bounded by the already-read descriptor. */
    async attachmentBinary(path: string, expected: AttachmentBinaryExpectation, options: { token: string; signal?: AbortSignal }): Promise<Uint8Array> {
      const route = /^\/(?:support\/tickets|conversations)\/([^/]+)\/messages\/([^/]+)\/attachments\/([^/]+)$/.exec(path);
      if (!route || !route.slice(1).every(id => documentArchiveItemSchema.shape.id.safeParse(id).success)) throw new AttachmentBinaryError("contract");
      if (!Number.isSafeInteger(expected.sizeBytes) || expected.sizeBytes < 1 || expected.sizeBytes > DOCUMENT_UPLOAD_MAX_BYTES || !["image/png", "image/jpeg"].includes(expected.contentType) || !options.token) throw new AttachmentBinaryError("contract");
      const controller = new AbortController(), abort = () => controller.abort(); active.add(controller);
      if (options.signal?.aborted) controller.abort(); else options.signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 20_000); let reader: AttachmentBinaryReader | undefined, complete = false;
      try {
        const response = await untilAbort(controller.signal, () => fetcher(`${apiUrl}${path}`, { method: "GET", headers: { Accept: expected.contentType, authorization: `Bearer ${options.token}`, "Cache-Control": "no-store, no-cache", Pragma: "no-cache" }, credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal }));
        if (!response.ok) { let payload: unknown = null; const value = await untilAbort(controller.signal, () => response.text()); try { payload = JSON.parse(value); } catch { /* Non-JSON error does not become success. */ } throw new MarketHttpError(response.status, payload); }
        if (response.status !== 200 || !response.headers || !response.body) throw new AttachmentBinaryError("contract");
        const mime = response.headers.get("content-type"), disposition = response.headers.get("content-disposition"), cache = response.headers.get("cache-control")?.toLowerCase().split(",").map(value => value.trim()), length = response.headers.get("content-length");
        if (mime?.toLowerCase() !== expected.contentType || response.headers.get("x-content-type-options")?.toLowerCase() !== "nosniff" || !cache?.includes("private") || !cache.includes("no-store") || !disposition?.startsWith("attachment;") || length !== null && length !== String(expected.sizeBytes)) throw new AttachmentBinaryError("contract");
        reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        while (true) {
          const part = await untilAbort(controller.signal, () => reader!.read()); if (part.done) break;
          if (!(part.value instanceof Uint8Array)) throw new AttachmentBinaryError("contract");
          if (!part.value.byteLength) continue;
          size += part.value.byteLength; if (size > expected.sizeBytes) throw new AttachmentBinaryError("size");
          chunks.push(part.value.slice());
        }
        if (size !== expected.sizeBytes) throw new AttachmentBinaryError("size");
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const png = [137,80,78,71,13,10,26,10], correctSignature = expected.contentType === "image/png" ? png.every((value,index) => bytes[index] === value) : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!correctSignature) throw new AttachmentBinaryError("contract"); complete = true; return bytes;
      } finally {
        clearTimeout(timeout); options.signal?.removeEventListener("abort", abort); active.delete(controller);
        if (reader) { if (!complete) { try { void reader.cancel().catch(() => undefined); } catch { /* Scope close still releases local ownership. */ } } try { reader.releaseLock(); } catch { /* A pending cancelled read may still own the reader. */ } }
        if (!complete) controller.abort();
      }
    },
    async request(path: string, options: { method?: MarketRequestMethod; body?: unknown; token?: string; organizationId?: string; cookies?: boolean; csrf?: string } = {}): Promise<unknown> {
      if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n#]/.test(path)) throw new Error("Invalid API path");
      const url = new URL(`${apiUrl}${path}`);
      if (!url.href.startsWith(`${apiUrl}/`)) throw new Error("Invalid API path");
      const method = options.method ?? "GET";
      if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) throw new Error("Invalid API method");
      const controller = new AbortController(); active.add(controller);
      // Same bounded transport timeout as the existing ApiClient; not a business deadline.
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const headers: Record<string, string> = { Accept: "application/json", "Cache-Control": "no-store, no-cache", Pragma: "no-cache" };
        if (options.body !== undefined) headers["content-type"] = "application/json";
        if (options.token) {
          headers.authorization = `Bearer ${options.token}`;
          // Server validates this selector against the Bearer claims and membership.
          if (options.organizationId) headers["x-organization-id"] = options.organizationId;
        } else if (options.organizationId) throw new Error("Missing authenticated organization context");
        if (options.csrf) headers["x-csrf-token"] = options.csrf;
        const init: RequestInit = { method, headers,
          credentials: options.cookies ? "include" : "omit", redirect: "error", cache: "no-store", signal: controller.signal,
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) };
        const response = await untilAbort(controller.signal, () => fetcher(url.href, init));
        const text = await untilAbort(controller.signal, () => response.text());
        if (controller.signal.aborted) throw interruptedRequest();
        let payload: unknown = null;
        if (text) { try { payload = JSON.parse(text); } catch { payload = null; } }
        const ok = response.ok, status = response.status;
        if (controller.signal.aborted) throw interruptedRequest();
        if (!ok) throw new MarketHttpError(status, payload);
        return payload;
      } finally { clearTimeout(timeout); active.delete(controller); }
    },
  };
}
export type MarketTransport = ReturnType<typeof createMarketTransport>;
function query(path: string, input: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  return params.size ? `${path}?${params}` : path;
}
/** Existing ApiClient read routes, with no browser barrel, development identity or writes. */
export function bindMarketReads(read: (path: string) => Promise<unknown>, organizationId: string): MobileReadClient {
  const assertOrganization = (id: string) => { if (id !== organizationId) throw new Error("Read context changed"); };
  return {
    archiveMetadataOnly: true,
    archiveChildMetadata: true,
    archiveBaseMetadata: true,
    documentArchiveFixture(scope, input) {
      assertOrganization(scope.organizationId); const parsed = parseArchiveInput(input);
      if (!parsed) throw new Error("Invalid archive query");
      return read(query("/documents/archive", parsed));
    },
    documentArchiveSummaryFixture(scope) { assertOrganization(scope.organizationId); return read("/documents/archive/summary"); },
    archiveDocumentFixture(scope, id) {
      assertOrganization(scope.organizationId);
      if (!documentArchiveItemSchema.shape.id.safeParse(id).success) throw new Error("Invalid archive document");
      return read(`/documents/archive/${encodeURIComponent(id)}`);
    },
    publicCitiesFixture(scope) { assertOrganization(scope.organizationId); return read("/catalog/cities"); },
    searchCatalog(input) { assertOrganization(input.buyerOrganizationId); return read(query("/marketplace/search", input)); },
    compareOffers(input) { assertOrganization(input.buyerOrganizationId); const { productId, ...rest } = input; return read(query(`/marketplace/products/${encodeURIComponent(productId)}/compare`, rest)); },
    workspaceOrders(role, input) { if (role !== "buyer") throw new Error("Unsupported workspace"); return read(query("/workspaces/buyer/orders", input)); },
    getOrderWorkflow(id) { return read(`/supplier-orders/${encodeURIComponent(id)}/workflow`); },
    workspaceCarts(input) { return read(query("/workspaces/buyer/carts", input)); },
    workspaceCart(id) { return read(`/workspaces/buyer/carts/${encodeURIComponent(id)}`); },
    getCheckout(id) { return read(`/checkouts/${encodeURIComponent(id)}`); },
    getOrganizationProfile() { return read("/organizations/current/profile"); },
    supportTickets(status, offset = 0, options = {}) { return read(query("/support/tickets", { offset, ...(status === undefined ? {} : { status }), ...options })); },
    supportTicket(id, beforeMessageId) { return read(query(`/support/tickets/${encodeURIComponent(id)}`, { beforeMessageId })); },
  };
}
