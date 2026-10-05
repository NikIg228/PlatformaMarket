import { expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { CatalogService } from "./catalog.service";
import { offerOptionsQuerySchema } from "@marketplace/schemas";

it("searches approved master variants with bounded pagination and no supplier data", async () => {
  const row = (id: string) => ({ id, productId: "p", sku: "A", gtin: null, product: { canonicalName: "Материал" },
    packagings: [{ id: "pack", name: "Упаковка", unitId: "u", unit: { symbol: "шт" }, quantityInBaseUnit: new Prisma.Decimal("10.25") }] });
  const findMany = vi.fn().mockResolvedValue([row("a"), row("b"), row("c")]);
  const service = new CatalogService({ productVariant: { findMany } } as never, {} as never);
  const response = await service.offerOptions({ q: "Материал", limit: 2 });
  expect(response.items.map(item => item.id)).toEqual(["a", "b"]); expect(response.nextCursor).toBe("b");
  expect(response.items[0]?.packagings[0]?.quantityInBaseUnit).toBe("10.25");
  const query = findMany.mock.calls[0][0];
  expect(query.where).toMatchObject({ status: "ACTIVE", product: { status: "ACTIVE" } });
  expect(query.take).toBe(3); expect(query.select.supplierOffers).toBeUndefined();
  expect(query.select.product.select.media).toMatchObject({ where: { status: "READY" }, take: 1, select: { sourceUrl: true } });
  await service.offerOptions({ q: "", cursor: "b", limit: 2 });
  expect(findMany.mock.calls[1][0].where.id).toEqual({ gt: "b" });
});
it("rejects oversized search and unbounded page requests", () => {
  expect(offerOptionsQuerySchema.safeParse({ q: "a".repeat(161) }).success).toBe(false);
  expect(offerOptionsQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
  expect(offerOptionsQuerySchema.parse({ limit: "20" })).toMatchObject({ q: "", limit: 20 });
});
