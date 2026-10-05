import { expect, it, vi } from "vitest";
import { importPriceMinor, supplierImportPreviewInputSchema, supplierColumnMappingSchema } from "@marketplace/schemas";
import { ImportsService } from "./imports.service";
const input = { fileName: "price.csv", fileType: "CSV" as const, contentBase64: "YWJjZA==" };
function fixture() {
  const access = { assertCanManage: vi.fn(), requireProfile: vi.fn() };
  const uploads = { decodeBase64: vi.fn().mockReturnValue(Buffer.from("data")), quarantine: vi.fn().mockResolvedValue({ id: "asset" }), release: vi.fn() };
  const parser = { parseWithDiagnostics: vi.fn().mockResolvedValue({ rows: [{ Код: "A", Цена: "1234,56" }], rowNumbers: [7] }) };
  return { access, uploads, parser, service: new ImportsService({} as never, access as never, parser as never, {} as never, uploads as never, {} as never, {} as never) };
}
it("authorizes before upload, checks the original file policy and returns rows without creating batches", async () => {
  const { service, uploads } = fixture();
  expect(await service.previewFile("supplier", input, { actorId: "u", organizationId: "supplier" })).toEqual({ headers: ["Код", "Цена"], rows: [{ rowNumber: 7, rawData: { Код: "A", Цена: "1234,56" } }] });
  expect(uploads.quarantine).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "supplier", allowedKinds: ["CSV"] }));
  expect(uploads.release).toHaveBeenCalledWith("asset", "Import preview complete");
});
it("denies another tenant before touching a file and releases quarantined data on parser failures", async () => {
  const { access, service, uploads, parser } = fixture();
  access.assertCanManage.mockRejectedValueOnce(new Error("Denied"));
  await expect(service.previewFile("foreign", input, { actorId: "u", organizationId: "own" })).rejects.toThrow("Denied");
  expect(uploads.quarantine).not.toHaveBeenCalled();
  parser.parseWithDiagnostics.mockRejectedValueOnce(new Error("Invalid file"));
  await expect(service.previewFile("own", input, { actorId: "u", organizationId: "own" })).rejects.toThrow("Invalid file");
  expect(uploads.release).toHaveBeenCalledOnce();
});
it("preserves exact money and the legacy minor-unit default", () => {
  expect(importPriceMinor("1234,56", "MAJOR")).toBe("123456");
  expect(importPriceMinor("0.01", "MAJOR")).toBe("1");
  expect(importPriceMinor("9007199254740993.12", "MAJOR")).toBe("900719925474099312");
  expect(importPriceMinor("123456")).toBe("123456");
  for (const value of ["-1", "NaN", "0", "1.234", "1e3"]) expect(importPriceMinor(value, "MAJOR")).toBeNull();
  expect(supplierColumnMappingSchema.parse({ externalId: "Код", name: "Название" }).priceUnit).toBeUndefined();
  expect(supplierImportPreviewInputSchema.safeParse({ ...input, fileType: "PDF" }).success).toBe(false);
});
