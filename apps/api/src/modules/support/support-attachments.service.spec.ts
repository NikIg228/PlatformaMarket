import { describe, expect, it, vi } from "vitest";
import { SupportAttachmentsService } from "./support-attachments.service";

const context = { actorId: "actor", organizationId: "org" };
const assetId = "60000000-0000-4000-8000-000000000001";
const asset = { id: assetId, originalName: "Документ.pdf", detectedMime: "application/pdf", sizeBytes: 12,
  createdAt: new Date(), storageKey: "quarantine/org/support/private", status: "CLEAN" };
function fixture(operator = false) {
  const descriptor = { assetId, name: asset.originalName, contentType: asset.detectedMime, sizeBytes: asset.sizeBytes };
  const db = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue(operator ? {} : null) },
    supportTicket: { findFirst: vi.fn().mockResolvedValue({ id: "ticket" }) },
    supportMessage: { findFirst: vi.fn().mockResolvedValue({ attachments: [descriptor] }) },
    uploadAsset: { update: vi.fn().mockResolvedValue(asset), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(asset), findFirst: vi.fn().mockResolvedValue(asset), findMany: vi.fn().mockResolvedValue([{ id: assetId }]) },
  };
  const uploads = { decodeBase64: vi.fn().mockReturnValue(Buffer.from("%PDF-1.7")), quarantine: vi.fn().mockResolvedValue(asset), release: vi.fn() };
  const storage = { get: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.7")) };
  return { db, uploads, storage, descriptor, service: new SupportAttachmentsService(db as never, uploads as never, storage as never) };
}
describe("private support attachments", () => {
  it("uses the existing scanner/policy and returns only safe metadata", async () => {
    const { service, uploads, db, descriptor } = fixture();
    const result = await service.upload({ fileName: "Документ.pdf", contentBase64: "JVBERg==" }, context);
    expect(result).toMatchObject(descriptor); expect(result).not.toHaveProperty("storageKey");
    expect(uploads.quarantine).toHaveBeenCalledWith(expect.objectContaining({ ...context, purpose: "support", allowedKinds: ["PNG", "JPEG", "PDF", "DOCX", "XLSX"], maxBytes: 10_000_000 }));
    expect(db.uploadAsset.update).toHaveBeenCalledWith({ where: { id: assetId }, data: { metadata: { supportPending: true } } });
  });
  it("does not prepare files if scan fails and cleans up an upload if metadata cannot be saved", async () => {
    const { service, uploads, db } = fixture();
    uploads.quarantine.mockRejectedValueOnce(new Error("Scanner unavailable"));
    await expect(service.upload({ fileName: "a.pdf", contentBase64: "JVBERg==" }, context)).rejects.toThrow("Scanner unavailable");
    expect(db.uploadAsset.update).not.toHaveBeenCalled();
    db.uploadAsset.update.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(service.upload({ fileName: "a.pdf", contentBase64: "JVBERg==" }, context)).rejects.toThrow("Database unavailable");
    expect(uploads.release).toHaveBeenCalledWith(assetId, "Support upload could not be prepared");
  });
  it("claims only this actor's clean, unexpired, unlinked support assets; ignores supplied filename", async () => {
    const { service, db, descriptor } = fixture();
    expect(await service.link(db as never, [{ assetId }], context, "ticket", "message")).toEqual([descriptor]);
    expect(db.uploadAsset.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: assetId, uploadedById: context.actorId,
      organizationId: context.organizationId, purpose: "support", status: "CLEAN", deletedAt: null, createdAt: { gt: expect.any(Date) }, metadata: { equals: { supportPending: true } } }),
    data: { metadata: { supportTicketId: "ticket", supportMessageId: "message" } } });
    db.uploadAsset.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.link(db as never, [{ assetId }], context, "ticket", "message")).rejects.toThrow("Вложение недоступно");
  });
  it("checks message tenant and internal visibility before reading the stored object", async () => {
    const { service, db, storage } = fixture();
    await service.download("ticket", "message", assetId, context);
    expect(db.supportTicket.findFirst).toHaveBeenCalledWith({ where: { id: "ticket", organizationId: "org" }, select: { id: true } });
    expect(db.supportMessage.findFirst).toHaveBeenCalledWith({ where: { id: "message", ticketId: "ticket", isInternal: false } });
    expect(db.uploadAsset.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ status: "CLEAN", purpose: "support", deletedAt: null, metadata: { equals: { supportTicketId: "ticket", supportMessageId: "message" } } }) });
    storage.get.mockClear(); db.supportMessage.findFirst.mockResolvedValueOnce(null);
    await expect(service.download("ticket", "message", assetId, context)).rejects.toThrow("Вложение не найдено");
    expect(storage.get).not.toHaveBeenCalled();
  });
  it("lets operators read attached files including private notes but never unlinked/rejected assets", async () => {
    const { service, db, storage } = fixture(true);
    await service.download("ticket", "message", assetId, context);
    expect(db.supportTicket.findFirst.mock.calls[0][0].where).toEqual({ id: "ticket" });
    expect(db.supportMessage.findFirst.mock.calls[0][0].where).toMatchObject({ isInternal: undefined });
    storage.get.mockClear(); db.uploadAsset.findFirst.mockResolvedValueOnce(null);
    await expect(service.download("ticket", "message", assetId, context)).rejects.toThrow();
    expect(storage.get).not.toHaveBeenCalled();
    db.supportMessage.findFirst.mockResolvedValueOnce({ attachments: [] });
    await expect(service.download("ticket", "message", assetId, context)).rejects.toThrow();
    expect(storage.get).not.toHaveBeenCalled();
  });
  it("does not delete an upload claimed by a competing message; retries failed expiry deletion", async () => {
    const { service, db, uploads } = fixture();
    db.uploadAsset.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await service.cleanupPending()).toEqual({ scanned: 1, deleted: 0 });
    expect(uploads.release).not.toHaveBeenCalled();
    uploads.release.mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await service.cleanupPending()).toEqual({ scanned: 1, deleted: 0 });
    expect(db.uploadAsset.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { metadata: { supportExpired: true } } }));
    expect(await service.cleanupPending()).toEqual({ scanned: 1, deleted: 1 });
  });
});
