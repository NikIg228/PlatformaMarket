import { accessControlModeSchema } from "@marketplace/schemas";
import type { Prisma } from "@prisma/client";

// Authentication, active membership and organization capabilities remain mandatory.
// The local launcher opts in; other environments keep role-based access by default.
export function accessControlMode() {
  return accessControlModeSchema.parse(process.env.ACCESS_CONTROL_MODE ?? "ROLE_BASED");
}

export function hasFullAccess() {
  return accessControlMode() === "FULL_ACCESS";
}

export function membershipPermission(organizationId: string, code: string): Prisma.OrganizationMembershipWhereInput {
  return hasFullAccess() ? {} : {
    roles: { some: { role: { organizationId, permissions: { some: { permission: { code } } } } } },
  };
}
