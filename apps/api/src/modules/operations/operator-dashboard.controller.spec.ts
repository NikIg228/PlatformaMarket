import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_PERMISSIONS } from "../access-control/require-permissions.decorator";
import { OperatorDashboardController } from "./operator-dashboard.controller";

describe("operator dashboard endpoint", () => {
  it.each(["dashboard", "capabilities"] as const)("%s uses trusted request context and declares the existing read permission", async method => {
    const dashboard = vi.fn().mockResolvedValue({});
    const controller = new OperatorDashboardController({ [method]: dashboard } as never);
    await controller[method]({}, "actor", "operator");
    expect(dashboard).toHaveBeenCalledWith({ actorId: "actor", organizationId: "operator" });
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, OperatorDashboardController.prototype[method])).toEqual(["organization.view"]);
  });
  it("rejects an unsupported filter or supplied identity before the service", () => {
    const dashboard = vi.fn();
    const controller = new OperatorDashboardController({ dashboard, capabilities: dashboard } as never);
    for (const query of [{ organizationId: "foreign" }, { offset: "100" }, { status: "ACTIVE" }]) {
      expect(() => controller.dashboard(query, "actor", "operator")).toThrow(BadRequestException);
      expect(() => controller.capabilities(query, "actor", "operator")).toThrow(BadRequestException);
    }
    expect(dashboard).not.toHaveBeenCalled();
  });
});
