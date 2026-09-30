import { describe, expect, it, vi } from "vitest";
import { FileUploadPolicyService } from "./file-upload-policy.service";
import { DOCUMENT_UPLOAD_MAX_BYTES } from "@marketplace/schemas";

function centralDirectoryEntry(name: string) {
  const fileName = Buffer.from(name);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(fileName.length, 28);
  return Buffer.concat([header, fileName]);
}

function fakeZip(entries: string[]) {
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), ...entries.map(centralDirectoryEntry)]);
}

describe("file upload magic detection", () => {
  const service = new FileUploadPolicyService({} as never, {} as never, {} as never);
  it("detects PDF, PNG, JPEG and UTF-8 CSV by bytes", () => {
    expect(service.detect(Buffer.from("%PDF-1.7\n"))).toBe("PDF");
    expect(service.detect(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe("PNG");
    expect(service.detect(Buffer.from([0xff,0xd8,0xff,0xe0]))).toBe("JPEG");
    expect(service.detect(Buffer.from("sku,name,price\nA,Материал,100"))).toBe("CSV");
  });
  it("does not treat executable or NUL payload as text", () => {
    expect(service.detect(Buffer.from([0x4d,0x5a,0,0,1,2]))).toBeNull();
  });
  it("applies the shared document limit to decoded bytes at both sides of the boundary", () => {
    for (const size of [DOCUMENT_UPLOAD_MAX_BYTES - 1, DOCUMENT_UPLOAD_MAX_BYTES]) {
      const encoded = Buffer.alloc(size, 65).toString("base64");
      expect(encoded.length).toBeGreaterThan(DOCUMENT_UPLOAD_MAX_BYTES);
      expect(service.decodeBase64(encoded, DOCUMENT_UPLOAD_MAX_BYTES)).toHaveLength(size);
    }
    expect(() => service.decodeBase64(Buffer.alloc(DOCUMENT_UPLOAD_MAX_BYTES + 1, 65).toString("base64"), DOCUMENT_UPLOAD_MAX_BYTES)).toThrow();
    expect(() => service.decodeBase64("", DOCUMENT_UPLOAD_MAX_BYTES)).toThrow();
  });
  it("rejects a PDF filename with non-PDF bytes before storage or scan", async () => {
    const storage = { put: vi.fn() }, scanner = { scan: vi.fn() };
    const policy = new FileUploadPolicyService({ securityEvent: { create: async () => ({}) } } as never, storage as never, scanner as never);
    await expect(policy.quarantine({ organizationId: crypto.randomUUID(), purpose: "document", fileName: "invoice.pdf", body: Buffer.from("not a PDF"), allowedKinds: ["PDF"], maxBytes: DOCUMENT_UPLOAD_MAX_BYTES })).rejects.toThrow();
    expect(storage.put).not.toHaveBeenCalled(); expect(scanner.scan).not.toHaveBeenCalled();
  });

  it("rejects a generic ZIP renamed to an Office document", async () => {
    const prisma = { securityEvent: { create: async () => ({}) } };
    const policy = new FileUploadPolicyService(prisma as never, {} as never, {} as never);
    await expect(policy.quarantine({ organizationId: crypto.randomUUID(), purpose: "import", fileName: "payload.xlsx", body: fakeZip(["payload.exe"]), allowedKinds: ["XLSX"], maxBytes: 1_000_000 })).rejects.toThrow("File extension, MIME signature, name, type or size is not allowed");
  });

  it("accepts only the declared OOXML package family", async () => {
    const prisma = { uploadAsset: { create: async ({ data }: any) => ({ id: "asset", ...data }), update: async ({ data }: any) => ({ id: "asset", ...data }) }, securityEvent: { create: async () => ({}) } };
    const storage = { put: async () => ({}) };
    const scanner = { scan: async () => ({ provider: "test" }) };
    const policy = new FileUploadPolicyService(prisma as never, storage as never, scanner as never);
    const workbook = fakeZip(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"]);
    await expect(policy.quarantine({ organizationId: crypto.randomUUID(), purpose: "import", fileName: "catalog.xlsx", body: workbook, allowedKinds: ["XLSX"], maxBytes: 1_000_000 })).resolves.toMatchObject({ status: "CLEAN" });
    await expect(policy.quarantine({ organizationId: crypto.randomUUID(), purpose: "import", fileName: "catalog.docx", body: workbook, allowedKinds: ["DOCX"], maxBytes: 1_000_000 })).rejects.toThrow();
  });

  it("deletes the quarantined object when scanning fails", async () => {
    const asset = { id: "asset", storageKey: "quarantine/org/import/asset.csv", status: "QUARANTINED", checksumSha256: "checksum", detectedMime: "text/csv" };
    const prisma = {
      uploadAsset: {
        create: vi.fn(async ({ data }: any) => ({ ...asset, ...data })),
        findUnique: vi.fn(async () => asset),
        update: vi.fn(async ({ data }: any) => ({ ...asset, ...data })),
      },
      securityEvent: { create: vi.fn(async () => ({})) },
    };
    const storage = { put: vi.fn(async () => ({ key: asset.storageKey })), delete: vi.fn(async () => undefined) };
    const scanner = { scan: vi.fn(async () => { throw new Error("scanner unavailable"); }) };
    const policy = new FileUploadPolicyService(prisma as never, storage as never, scanner as never);

    await expect(policy.quarantine({ organizationId: crypto.randomUUID(), purpose: "import", fileName: "catalog.csv", body: Buffer.from("sku,name\n1,Item"), allowedKinds: ["CSV"], maxBytes: 1_000_000 })).rejects.toThrow("scanner unavailable");
    expect(storage.delete).toHaveBeenCalledWith(asset.storageKey);
    expect(prisma.uploadAsset.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", deletedAt: expect.any(Date) }) }));
  });
});
