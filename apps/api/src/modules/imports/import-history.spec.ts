import { expect, it, vi } from "vitest";
import { ImportsService } from "./imports.service";
import { supplierImportHistoryQuerySchema } from "@marketplace/schemas";

function fixture(anchor: unknown) {
  const findMany = vi.fn().mockResolvedValue([]), findFirst = vi.fn().mockResolvedValue(anchor);
  const access = { assertCanManage: vi.fn() };
  const service = new ImportsService({ importBatch: { findFirst, findMany } } as never, access as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { service, findMany, findFirst, access };
}
it("paginates equal-timestamp batches deterministically inside the supplier scope", async () => {
  const date = new Date("2026-09-28T00:00:00Z");
  const { service, findMany, findFirst, access } = fixture({ id: "cursor", createdAt: date });
  const context = { actorId: "actor", organizationId: "supplier" };
  await service.batches("supplier", context, { cursor: "cursor", limit: 2 });
  expect(access.assertCanManage).toHaveBeenCalledWith("supplier", context);
  expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cursor", supplierOrganizationId: "supplier" } }));
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2, orderBy: [{ createdAt: "desc" }, { id: "desc" }], where: { supplierOrganizationId: "supplier", OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: "cursor" } }] } }));
});
it("does not paginate through a missing or foreign supplier cursor", async () => {
  const { service, findMany } = fixture(null);
  await expect(service.batches("supplier", { actorId: "actor", organizationId: "supplier" }, { cursor: "foreign" })).rejects.toThrow("cursor not found");
  expect(findMany).not.toHaveBeenCalled();
  expect(supplierImportHistoryQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
});
