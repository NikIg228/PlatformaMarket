import { expect, it, vi } from "vitest";
import { ConversationAttachmentsService } from "./conversation-attachments.service";

const actor = { actorId: "actor", organizationId: "buyer" };
const context = { contextType: "OFFER" as const, contextId: "offer" };
const id = "00000000-0000-4000-8000-000000000001";
const asset = { id, originalName: "Фото.png", detectedMime: "image/png", sizeBytes: 100, createdAt: new Date(), storageKey: "private/file" };
function fixture() {
  const db = { uploadAsset: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(asset) } };
  const uploads = { quarantine: vi.fn().mockResolvedValue(asset), decodeBase64: vi.fn().mockReturnValue(Buffer.from("png")), release: vi.fn() };
  const storage = { get: vi.fn().mockResolvedValue(Buffer.from("png")) };
  return { db, uploads, storage, service: new ConversationAttachmentsService(db as never, uploads as never, storage as never) };
}
it("quarantines and scans only supported kinds and saves the authoritative private descriptor/context", async () => {
  const { service, uploads, db } = fixture();
  expect(await service.upload({ ...context, fileName: "Фото.png", contentBase64: "cG5n" }, actor)).toMatchObject({ assetId: id, name: "Фото.png", contentType: "image/png", sizeBytes: 100 });
  expect(uploads.quarantine).toHaveBeenCalledWith(expect.objectContaining({ ...actor, purpose: "conversation", allowedKinds: ["PNG", "JPEG", "PDF"], maxBytes: 10_000_000 }));
  expect(db.uploadAsset.update).toHaveBeenCalledWith({ where: { id }, data: { metadata: { ...context, conversationPending: true } } });
});
it("does not prepare failed scans and releases an upload whose metadata cannot be saved", async () => {
  const { service, uploads, db } = fixture();
  uploads.quarantine.mockRejectedValueOnce(new Error("Scanner unavailable"));
  await expect(service.upload({ ...context, fileName: "Фото.png", contentBase64: "cG5n" }, actor)).rejects.toThrow("Scanner unavailable");
  expect(db.uploadAsset.update).not.toHaveBeenCalled();
  db.uploadAsset.update.mockRejectedValueOnce(new Error("Storage metadata failed"));
  await expect(service.upload({ ...context, fileName: "Фото.png", contentBase64: "cG5n" }, actor)).rejects.toThrow("metadata failed");
  expect(uploads.release).toHaveBeenCalledWith(id, expect.any(String));
});
it("claims only this actor's clean unexpired upload for this exact context and fails closed", async () => {
  const { service, db } = fixture();
  await service.link(db as never, [{ assetId: id }], actor, context, "conversation", "message");
  expect(db.uploadAsset.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id, uploadedById: actor.actorId, organizationId: actor.organizationId, purpose: "conversation", status: "CLEAN", deletedAt: null, metadata: { equals: { ...context, conversationPending: true } } }), data: { metadata: { ...context, conversationId: "conversation", conversationMessageId: "message" } } });
  db.uploadAsset.updateMany.mockResolvedValueOnce({ count: 0 });
  await expect(service.link(db as never, [{ assetId: id }], actor, context, "conversation", "message")).rejects.toThrow("Вложение недоступно");
});
it("checks complete attachment identity on replay and exact association on download", async () => {
  const { service, db, storage } = fixture();
  db.uploadAsset.findMany.mockResolvedValueOnce([{ id }]);
  expect(await service.sameReferences(db as never, "conversation", "message", [{ assetId: id }])).toBe(true);
  db.uploadAsset.findMany.mockResolvedValueOnce([{ id }]);
  expect(await service.sameReferences(db as never, "conversation", "message", [])).toBe(false);
  await service.download(context, "conversation", "message", id);
  expect(db.uploadAsset.findFirst).toHaveBeenCalledWith({ where: { id, purpose: "conversation", status: "CLEAN", deletedAt: null, metadata: { equals: { ...context, conversationId: "conversation", conversationMessageId: "message" } } } });
  db.uploadAsset.findFirst.mockResolvedValueOnce(null);
  await expect(service.download(context, "other", "message", id)).rejects.toThrow("Вложение не найдено");
  expect(storage.get).toHaveBeenCalledTimes(1);
});
it("cleanup cannot win a linked-file claim and retries a failed expired-file deletion", async () => {
  const { service, db, uploads } = fixture();
  db.uploadAsset.findMany.mockResolvedValue([{ id }]);
  db.uploadAsset.updateMany.mockResolvedValueOnce({ count: 0 });
  expect(await service.cleanupPending()).toEqual({ scanned: 1, deleted: 0 });
  expect(uploads.release).not.toHaveBeenCalled();
  uploads.release.mockRejectedValueOnce(new Error("storage down"));
  expect(await service.cleanupPending()).toEqual({ scanned: 1, deleted: 0 });
  expect(db.uploadAsset.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { metadata: { conversationExpired: true } } }));
  expect(await service.cleanupPending()).toEqual({ scanned: 1, deleted: 1 });
});
