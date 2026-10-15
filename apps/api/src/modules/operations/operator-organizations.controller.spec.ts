import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OperatorOrganizationsController } from "./operator-organizations.controller";

describe("operator organizations HTTP boundary", () => {
  it("rejects unknown, duplicate and out-of-range query before service", () => {
    const service = { list: vi.fn(), detail: vi.fn() };
    const controller = new OperatorOrganizationsController(service as never);
    for (const query of [{ limit: "101" }, { status: ["ACTIVE", "ARCHIVED"] }, { organizationId: "other" }]) {
      expect(() => controller.list(query, "actor", "platform")).toThrow(BadRequestException);
    }
    expect(() => controller.detail("id", { tenant: "other" }, "actor", "platform")).toThrow(BadRequestException);
    expect(service.list).not.toHaveBeenCalled(); expect(service.detail).not.toHaveBeenCalled();
  });
  it("passes only parsed query and trusted request context", () => {
    const service = { list: vi.fn(), detail: vi.fn() };
    const controller = new OperatorOrganizationsController(service as never);
    controller.list({ offset: "25" }, "actor", "platform");
    expect(service.list).toHaveBeenCalledWith({ offset: 25, limit: 25 }, { actorId: "actor", organizationId: "platform" });
    controller.detail("id", {}, "actor", "platform");
    expect(service.detail).toHaveBeenCalledWith("id", { actorId: "actor", organizationId: "platform" });
  });
});
