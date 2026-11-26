import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { JanaPostLocalController } from "./janapost-local.controller";

describe("JanaPost local lookup", () => {
  const findFirst = vi.fn();
  const controller = new JanaPostLocalController({ supplierOrder: { findFirst } } as unknown as PrismaService);
  const lookup = (city: string) => controller.lookup("order-1", "supplier-1", { city });

  beforeEach(() => {
    vi.stubEnv("JANAPOST_LOCAL_FIXTURES", "true");
    vi.stubEnv("LIMITED_TEST_STAND", "false");
    vi.stubEnv("NODE_ENV", "test");
    findFirst.mockReset().mockResolvedValue({ id: "order-1" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["JANAPOST_LOCAL_FIXTURES", "false"],
    ["NODE_ENV", "production"],
    ["LIMITED_TEST_STAND", "true"],
  ])("blocks lookup before querying the database with %s=%s", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(lookup("almaty")).rejects.toMatchObject({ status: 404 });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("scopes the order to the supplier and denies a missing or foreign order", async () => {
    findFirst.mockResolvedValue(null);
    await expect(lookup("almaty")).rejects.toMatchObject({ status: 404 });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "order-1", supplierOrganizationId: "supplier-1" },
      select: { id: true },
    });
  });

  it("returns synthetic pickup points, an empty city and a demo tracking status", async () => {
    await expect(lookup("almaty")).resolves.toMatchObject({
      points: expect.arrayContaining([expect.objectContaining({ code: "DEMO-ALA-01" })]),
      tracking: { number: "DEMO-JP-001", status: "arrival_branch" },
    });
    await expect(lookup("shymkent")).resolves.toMatchObject({ points: [] });
    await expect(lookup("other")).rejects.toMatchObject({ status: 400 });
  });
});
