import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CdekSandboxController } from "./cdek-sandbox.controller";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { CdekSandboxAdapter } from "./cdek-sandbox.adapter";

function fixture(allowed = true) {
  const findFirst = vi.fn().mockResolvedValue(allowed ? { id: "order" } : null);
  const quote = vi.fn().mockResolvedValue({ payable: false }), cities = vi.fn().mockResolvedValue([]);
  const controller = new CdekSandboxController({ supplierOrder: { findFirst } } as unknown as PrismaService, { quote, cities, enabled: () => true } as unknown as CdekSandboxAdapter);
  return { controller, findFirst, quote, cities };
}
describe("CDEK order access", () => {
  it("binds database read to buyer/supplier organization", async () => {
    const f = fixture(); await f.controller.status("order", "org");
    expect(f.findFirst).toHaveBeenCalledWith({ where: { id: "order", OR: [{ buyerOrganizationId: "org" }, { supplierOrganizationId: "org" }] }, select: { id: true } });
  });
  it("denies foreign order before any provider request", async () => {
    const f = fixture(false); await expect(f.controller.quote("order", "foreign", {})).rejects.toThrow("Order not found"); expect(f.quote).not.toHaveBeenCalled();
    await expect(f.controller.cities("order", "foreign", { city: "Алматы" })).rejects.toThrow(); expect(f.cities).not.toHaveBeenCalled();
  });
  it("rejects missing organization without an unscoped read", async () => {
    const f = fixture(); await expect(f.controller.status("order", "")).rejects.toThrow(); expect(f.findFirst).not.toHaveBeenCalled();
  });
  it("rejects invalid parcels and unknown properties", async () => {
    const f = fixture(); await expect(f.controller.quote("order", "org", { fromCityCode: 1, toCityCode: 2, packages: [], baseUrl: "https://other.example" })).rejects.toThrow(); expect(f.quote).not.toHaveBeenCalled();
  });
});
