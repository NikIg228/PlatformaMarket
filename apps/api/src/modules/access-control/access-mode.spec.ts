import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessControlService } from "./access-control.service";
import { PlatformAuthorityPolicy } from "./platform-authority.policy";
import { RoleManagementService } from "./role-management.service";
import { accessControlMode, membershipPermission } from "./access-mode";

afterEach(() => vi.unstubAllEnvs());
describe("temporary full access", () => {
  it("defaults to role-based access and preserves a switch back", () => {
    vi.stubEnv("ACCESS_CONTROL_MODE", undefined);
    expect(accessControlMode()).toBe("ROLE_BASED");
    expect(membershipPermission("org", "order.create")).toHaveProperty("roles");
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    expect(membershipPermission("org", "order.create")).toEqual({});
    vi.stubEnv("ACCESS_CONTROL_MODE", "invalid");
    expect(() => accessControlMode()).toThrow();
  });
  it("grants registered permissions without assigned roles but still scopes active membership", async () => {
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    const findFirst = vi.fn(async () => ({ id: "member" }));
    const findUnique = vi.fn(async () => ({ status: "ACTIVE", roles: [] }));
    const service = new AccessControlService({ organizationMembership: { findFirst, findUnique }, permission: { findMany: async () => [{ code: "order.create" }, { code: "support.ticket.view" }] } } as never);
    await expect(service.policyFor("user", "org")).resolves.toEqual({ mode: "FULL_ACCESS", permissions: ["order.create", "support.ticket.view"] });
    await expect(service.hasAll("user", "org", ["order.create"])).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({ where: { userId: "user", organizationId: "org", status: "ACTIVE", user: { status: "ACTIVE" }, organization: { status: "ACTIVE" }, AND: [{}] }, select: { id: true } });
  });
  it("denies missing or inactive membership even in full access", async () => {
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    const findMany = vi.fn();
    const service = new AccessControlService({ organizationMembership: { findFirst: async () => null, findUnique: async () => ({ status: "BLOCKED", roles: [] }) }, permission: { findMany } } as never);
    await expect(service.hasAll("user", "other-org", ["order.create"])).resolves.toBe(false);
    await expect(service.permissionsFor("user", "org")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
  it("retains operator and foreign-role boundaries while removing role permission restrictions", async () => {
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    const policy = new PlatformAuthorityPolicy({ organizationMembership: { findFirst: async () => ({ organization: { capabilities: [{ capability: "SUPPLIER" }] }, roles: [] }) }, role: { findMany: async () => [] } } as never);
    await expect(policy.assertCanAssignRoles({ actorId: "user", organizationId: "org" }, [], "organization.members.manage")).resolves.toBeUndefined();
    await expect(policy.assertAiToolPermissions({ actorId: "user", organizationId: "org" }, "SUPPLIER", ["order.create"])).resolves.toBeUndefined();
    await expect(policy.assertPlatformOperator({ actorId: "user", organizationId: "org" })).rejects.toThrow("operator authority");
    await expect(policy.assertCanAssignRoles({ actorId: "user", organizationId: "org" }, ["foreign-role"])).rejects.toThrow("owned by the active organization");
  });
  it("freezes role mutations without deleting saved assignments", async () => {
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    const service = new RoleManagementService({} as never, {} as never);
    await expect(service.createRole("org", "actor", { code: "test", name: "Test", permissionCodes: ["order.create"] })).rejects.toThrow("Роли временно отключены");
    await expect(service.assignRole("org", "member", "role", "actor")).rejects.toThrow("Роли временно отключены");
    await expect(service.removeRole("org", "member", "role", "actor")).rejects.toThrow("Роли временно отключены");
  });
});
