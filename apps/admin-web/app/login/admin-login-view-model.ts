// Existing GET /organizations is operator-protected. Match the active tenant,
// not merely the presence of some operator organization in the returned list.
export function hasOperatorOrganizationAccess(payload: unknown, activeOrganizationId: string) {
  if (!Array.isArray(payload)) return false;
  return payload.some(item => item && typeof item === "object" &&
    item.id === activeOrganizationId && Array.isArray(item.capabilities) &&
    item.capabilities.some((entry: unknown) => entry && typeof entry === "object" &&
      "capability" in entry && entry.capability === "MARKETPLACE_OPERATOR"));
}
