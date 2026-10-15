import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { operatorOrganizationDetailSchema, operatorOrganizationsSchema } from "@marketplace/schemas";
import { OperatorOrganizationsService } from "./operator-organizations.service";

const context = { actorId: "operator", organizationId: "platform" };
const id = "11111111-1111-4111-8111-111111111111";
const row = { id, legalName: "Clinic", displayName: "Clinic", bin: "123456789012", status: "ARCHIVED", version: 3,
  createdAt: new Date("2026-10-14T00:00:00Z"), capabilities: [{ capability: "IMPORTER" }], commerceDataset: "private" };
function fixture() {
  const tx = { organization: { count: vi.fn().mockResolvedValue(151), findMany: vi.fn().mockResolvedValue([row]), findUnique: vi.fn().mockResolvedValue(row) },
    organizationProfile: { findUnique: vi.fn().mockResolvedValue(null) }, city: { findMany: vi.fn().mockResolvedValue([{ id, nameRu: "Алматы" }, { id: "22222222-2222-4222-8222-222222222222", nameRu: "Астана" }]) } };
  const prisma = { $transaction: vi.fn(async (run: (db: typeof tx) => unknown) => run(tx)) };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) };
  const access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { tx, prisma, authority, access, service: new OperatorOrganizationsService(prisma as never, authority as never, access as never) };
}

describe("operator organization projection", () => {
  it("reads stable pages and full filtered totals from one snapshot, excluding internal fields", async () => {
    const { service, tx, prisma, access } = fixture();
    const result = operatorOrganizationsSchema.parse(await service.list({ q: "clinic", status: "ARCHIVED", capability: "IMPORTER", offset: 100, limit: 25 }, context));
    expect(result).toMatchObject({ total: 151, offset: 100, limit: 25, items: [{ id, capabilities: ["IMPORTER"] }] });
    expect(JSON.stringify(result)).not.toMatch(/commerceDataset|version|private/);
    const where = tx.organization.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "ARCHIVED", capabilities: { some: { capability: "IMPORTER" } }, OR: [{ legalName: { contains: "clinic", mode: "insensitive" } }, { displayName: { contains: "clinic", mode: "insensitive" } }, { bin: { contains: "clinic" } }] });
    expect(tx.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 100, take: 25, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
    expect(access.hasAll.mock.invocationCallOrder[0]).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
  });
  it("keeps non-supplier capabilities exact and exposes a read-only safe detail", async () => {
    const { service } = fixture();
    const detail = operatorOrganizationDetailSchema.parse(await service.detail(id, context));
    expect(detail).toMatchObject({ capabilities: ["IMPORTER"], version: 3, canEdit: false, profile: null });
    expect(JSON.stringify(detail)).not.toMatch(/BUYER|commerceDataset/);
  });
  it("returns 404 without querying an absent organization's profile", async () => {
    const { service, tx } = fixture();
    tx.organization.findUnique.mockResolvedValue(null as never);
    await expect(service.detail(id, context)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.organizationProfile.findUnique).not.toHaveBeenCalled();
  });
  it("reads validated profile fields and both city names without leaking raw address data", async () => {
    const { service, tx } = fixture();
    tx.organizationProfile.findUnique.mockResolvedValue({ contactName: "Official contact", phone: "+77010000000", email: "official@example.invalid", additionalContacts: [],
      legalAddress: { organizationId: id, cityId: id, line1: "Legal street 1", postalCode: null, latitude: "private" },
      deliveryAddress: { organizationId: id, cityId: "22222222-2222-4222-8222-222222222222", line1: "Delivery street 2", postalCode: "123456" } } as never);
    const result = operatorOrganizationDetailSchema.parse(await service.detail(id, context));
    expect(result.profileCities).toEqual({ legal: "Алматы", delivery: "Астана" });
    expect(result.profile?.contactName).toBe("Official contact");
    expect(JSON.stringify(result)).not.toMatch(/latitude|private/);
  });
  it("denies both reads before any global data query for missing authority or permission", async () => {
    for (const denial of ["authority", "permission"]) {
      const { service, authority, access, prisma } = fixture();
      if (denial === "authority") authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
      else access.hasAll.mockResolvedValue(false);
      await expect(service.list({ offset: 0, limit: 25 }, context)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.detail(id, context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });
  it("does not disguise database failures as an empty registry", async () => {
    const { service, tx } = fixture();
    tx.organization.count.mockRejectedValue(new Error("database unavailable"));
    await expect(service.list({ offset: 0, limit: 25 }, context)).rejects.toThrow("database unavailable");
    expect(tx.organization.findMany).not.toHaveBeenCalled();
  });
});
