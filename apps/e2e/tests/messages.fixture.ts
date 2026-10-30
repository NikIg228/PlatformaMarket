import type { Page } from "@playwright/test";
import type { ConversationDetail, ConversationSummary, UploadedConversationAttachment, OfferComparisonResponse } from "@marketplace/schemas";
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const productId = "a88f8867-9a19-4703-aadf-e40ca4487b9b";
export const pngFile = { name: "Упаковка.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRzQAAAAASUVORK5CYII=", "base64") };
const at = "2026-10-13T07:00:00.000Z";
export function summary(n = 10, role = "clinic"): ConversationSummary {
  return { id: id(n), contextType: "OFFER", contextId: id(100 + n), productId, title: "Предложение Filtek", counterpartyName: role === "clinic" ? `DentalPro ${n}` : `Клиника ${n}`, buyerOrganizationId: id(1), supplierOrganizationId: id(2), resolved: false, version: 1, latestSequence: 32, lastMessage: "Есть в наличии, упаковка 4 г", updatedAt: at, unread: true, supportTicketId: null,
    context: { title: "Предложение Filtek", counterpartyName: role === "clinic" ? `DentalPro ${n}` : `Клиника ${n}`, productId, productName: "Filtek Ultimate", variantLabel: "Оттенок A2", packagingLabel: "Шприц · 4 г", imageUrl: "/api/catalog/media/test-image" } };
}
export function history(row: ConversationSummary): ConversationDetail {
  return { conversation: row, hasOlder: true, messages: Array.from({ length: 30 }, (_, i) => ({ id: id(1000 + i), sequence: i + 3, authorId: id(i % 2 ? 3 : 4), authorOrganizationId: id(i % 2 ? 1 : 2), authorName: i % 2 ? "Айгуль" : "Александр", authorRole: i % 2 ? "BUYER" : "SUPPLIER", body: `Сообщение ${i + 3}. Уточните комплектацию и доступные оттенки материала.`, createdAt: at, readByCounterparty: i < 27, attachments: [] })) };
}
export async function messagesFixture(page: Page, role: "clinic" | "supplier" = "clinic", canWrite = true) {
  const rights = ["support.ticket.view", "notification.view", ...(canWrite ? ["support.ticket.create"] : [])];
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER", organizationId = id(role === "clinic" ? 1 : 2);
  const rows = Array.from({ length: 36 }, (_, i) => summary(10 + i, role));
  const state = { rows, details: new Map(rows.map(row => [row.id, history(row)])), writes: [] as { path: string; input: Record<string, unknown> }[], reads: [] as string[], unexpected: [] as string[], listCalls: 0, failList: false, failLookup: false, failUpload: false, failDownload: false, failSend: false, failEscalate: false, holdList: false, releaseList: () => {}, slowId: "", releaseDetail: () => {}, assets: new Map<string, UploadedConversationAttachment>(), startId: null as string | null };
  const replay = new Map<string, { conversationId: string }>(), contents = new Map<string, Buffer>();
  await page.addInitScript(({ capability, organizationId }) => sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "ui-fixture-not-real", accessTokenExpiresAt: Date.now() + 3_600_000 })), { capability, organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, "");
    const write = request.method() !== "GET", input = write ? request.postDataJSON() as Record<string, unknown> : {};
    if (write) state.writes.push({ path, input }); else state.reads.push(path);
    const fail = (message: string, status = 503) => route.fulfill({ status, json: { code: "UNAVAILABLE", message } });
    let body: unknown;
    if (path === "/auth/workspace-context") body = { organizationId, organizationDisplayName: role === "clinic" ? "Клиника" : "DentalPro", capabilities: [capability] };
    else if (path === "/auth/current") body = null;
    else if (request.method() === "GET" && path === "/auth/personal-current") body = null;
    else if (request.method() === "GET" && path === "/auth/workspaces") body = [{ organizationId, organizationDisplayName: role === "clinic" ? "Клиника" : "DentalPro", capabilities: [capability] }];
    else if (path === "/access-control/permissions") body = rights;
    else if (path === "/access-control/policy") body = { mode: "ROLE_BASED", permissions: rights };
    else if (path === "/catalog/cities") body = [{ id: id(5), nameRu: "Алматы", nameKk: "Алматы", isActive: true }];
    else if (path.startsWith("/notifications/")) body = { items: [], unreadCount: 0, nextCursor: null, asOf: at };
    else if (path === "/organizations/current/onboarding") body = { ready: true, capability, steps: [], organization: { organizationId, displayName: "Клиника", complete: true, profile: {} } };
    else if (path === "/organizations/current/profile") body = { organizationId, legalName: "Клиника", displayName: "Клиника", bin: "970000000001", version: 1, canEdit: true, complete: true, profile: { contactName: "Сотрудник", phone: "+77000000000", email: "fixture@example.invalid", legalAddress: { cityId: id(5), line1: "Адрес", postalCode: null }, deliveryAddress: { cityId: id(5), line1: "Адрес", postalCode: null } } };
    else if (path === "/catalog/media/test-image") return route.fulfill({ contentType: "image/png", body: pngFile.buffer });
    else if (path.endsWith("/compare")) {
      const offer = (n: number): OfferComparisonResponse["offers"][number] => ({ offerId: id(n), variantId: id(6), supplier: { organizationId: id(2), name: n === 110 ? "DentalPro" : "MedDent" }, supplierSku: "SKU-A2", price: { amountMinor: "1280000", currency: "KZT", source: "BASE", normalizedPriceMinor: "320000", baseUnits: "4", normalizedUnit: "г" }, packaging: { name: "Шприц", quantityInBaseUnit: "4", unit: "г" }, minimumOrderQuantity: "1", orderIncrement: "1", availability: [{ warehouseId: id(8), warehouse: "Склад", cityId: id(5), quantityAvailable: "24", updatedAt: null, freshnessExpiresAt: null }], delivery: [], markers: { verifiedDocuments: true, complianceRisk: null, officialDistributor: false, supplierWarranty: true, requiresConfirmation: false } });
      body = { product: { id: productId, name: "Filtek Ultimate", brand: "Solventum", manufacturer: "Solventum", baseUnit: null }, reviewSummary: { count: 0, averageRating: null }, variants: [{ id: id(6), label: "A2", sku: "A2-4", gtin: null, attributes: {} }], selectedVariantId: id(6), comparisonAttributes: [], offers: [offer(110), offer(111)] };
    } else if (path === "/conversations/context") {
      if (state.failLookup) return fail("Контекст временно недоступен");
      body = { conversationId: state.startId, context: { ...rows[0].context, counterpartyName: url.searchParams.get("contextId") === id(110) ? "DentalPro" : "MedDent" } };
    } else if (path === "/conversations/attachments" && write) {
      if (state.failUpload) return fail("Проверка файла временно недоступна");
      const assetId = id(8000 + state.writes.length), name = String(input.fileName), buffer = Buffer.from(String(input.contentBase64), "base64");
      const asset: UploadedConversationAttachment = { assetId, name, contentType: name.endsWith("pdf") ? "application/pdf" : "image/png", sizeBytes: buffer.length, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
      state.assets.set(assetId, asset); contents.set(assetId, buffer); body = asset;
    } else if (/\/conversations\/[^/]+\/messages\/[^/]+\/attachments\/[^/]+$/.test(path)) {
      if (state.failDownload) return fail("Файл временно недоступен");
      const assetId = path.split("/").at(-1)!, asset = state.assets.get(assetId)!;
      return route.fulfill({ contentType: asset.contentType, body: contents.get(assetId), headers: { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}` } });
    } else if (path === "/conversations" && !write) {
      state.listCalls++;
      if (state.holdList && url.searchParams.get("limit") !== "1") await new Promise<void>(resolve => { state.releaseList = resolve; });
      if (state.failList) return fail("Диалоги временно недоступны");
      const filter = url.searchParams.get("filter"), offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 30);
      const items = state.rows.filter(row => filter === "ORDERS" ? row.contextType === "ORDER" : filter === "UNREAD" ? row.unread : true);
      body = { items: items.slice(offset, offset + limit), hasMore: offset + limit < items.length, unreadCount: items.filter(item => item.unread).length };
    } else if (path === "/conversations" && write || path.endsWith("/messages") && write) {
      let result = replay.get(String(input.idempotencyKey));
      if (!result) {
        const conversationId = path === "/conversations" ? state.startId ?? id(10) : path.split("/")[2];
        const detail = state.details.get(conversationId)!;
        const sequence = ++detail.conversation.latestSequence;
        detail.conversation.version++; detail.conversation.resolved = false;
        detail.messages.push({ id: id(9000 + state.writes.length), sequence, authorId: id(3), authorOrganizationId: organizationId, authorName: "Айгуль", authorRole: capability, body: String(input.body), createdAt: new Date().toISOString(), readByCounterparty: false, attachments: ((input.attachments ?? []) as { assetId: string }[]).map(file => state.assets.get(file.assetId)!) });
        result = { conversationId }; replay.set(String(input.idempotencyKey), result); state.startId = conversationId;
      }
      if (state.failSend) return fail("Подтверждение не получено");
      body = result;
    } else if (path.startsWith("/conversations/")) {
      const detail = state.details.get(path.split("/")[2]);
      if (!detail) return fail("Диалог не найден", 404);
      if (path.endsWith("/read")) { detail.conversation.unread = false; body = { throughSequence: input.throughSequence }; }
      else if (path.endsWith("/resolve")) { detail.conversation.resolved = true; detail.conversation.version++; body = { conversationId: detail.conversation.id }; }
      else if (path.endsWith("/escalate")) { detail.conversation.supportTicketId = id(500); detail.conversation.supportStatus = "OPEN"; detail.conversation.resolved = false; if (state.failEscalate) return fail("Подтверждение обращения не получено"); body = { ticketId: id(500) }; }
      else {
        if (state.slowId === detail.conversation.id) await new Promise<void>(resolve => { state.releaseDetail = resolve; });
        body = url.searchParams.has("beforeSequence") ? { ...detail, hasOlder: false, messages: [{ ...detail.messages[0], id: id(999), sequence: 1, body: "Самое раннее сообщение" }] } : detail;
      }
    } else if (path.startsWith("/promotions")) body = { items: [], total: 0 };
    else { state.unexpected.push(path); return fail(`Unexpected fixture route ${path}`); }
    return route.fulfill({ json: body });
  });
  return state;
}
