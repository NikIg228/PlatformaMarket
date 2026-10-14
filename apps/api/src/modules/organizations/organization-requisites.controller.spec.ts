import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { OrganizationRequisitesController } from "./organization-requisites.controller";
import type { OrganizationRequisitesService } from "./organization-requisites.service";

describe("requisites HTTP contract", () => {
  const service = { save: vi.fn(), confirm: vi.fn(), history: vi.fn(), current: vi.fn() };
  const controller = new OrganizationRequisitesController(service as unknown as OrganizationRequisitesService);
  it("rejects caller-selected ownership and bad acknowledgement at the boundary", () => {
    expect(() => controller.save({ organizationId: "foreign" }, "actor", "tenant")).toThrow();
    expect(() => controller.confirm({ expectedVersion: 1, expectedOrganizationVersion: 1, idempotencyKey: "confirmation", acknowledged: false }, "actor", "tenant")).toThrow();
    expect(service.save).not.toHaveBeenCalled(); expect(service.confirm).not.toHaveBeenCalled();
  });
  it("bounds history input and forwards only trusted context", () => {
    expect(() => controller.history({ beforeVersion: -1 }, "actor", "tenant")).toThrow();
    expect(() => controller.history({ organizationId: "foreign" }, "actor", "tenant")).toThrow();
    controller.history({ beforeVersion: "21" }, "actor", "tenant");
    expect(service.history).toHaveBeenCalledWith({ beforeVersion: 21 }, { actorId: "actor", organizationId: "tenant" });
  });
});
