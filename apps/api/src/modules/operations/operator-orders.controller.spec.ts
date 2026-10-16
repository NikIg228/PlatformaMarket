import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OperatorOrdersController } from "./operator-orders.controller";
describe("operator order HTTP boundary", () => {
  it("rejects malformed filters and forged context before dispatch", () => {
    const service = { list: vi.fn(), detail: vi.fn() }, controller = new OperatorOrdersController(service as never);
    for (const query of [{ actorId: "foreign" }, { status: ["PAID", "DRAFT"] }, { limit: "101" }, { dateFrom: "2026-10-17", dateTo: "2026-10-16" }]) expect(() => controller.list(query, "actor", "platform")).toThrow(BadRequestException);
    expect(() => controller.detail("id", { organizationId: "other" }, "actor", "platform")).toThrow(BadRequestException);
    expect(service.list).not.toHaveBeenCalled(); expect(service.detail).not.toHaveBeenCalled();
    controller.list({ offset: "25" }, "actor", "platform");
    expect(service.list).toHaveBeenCalledWith({ offset: 25, limit: 25 }, { actorId: "actor", organizationId: "platform" });
  });
});
