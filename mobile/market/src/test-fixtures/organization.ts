import { organizationProfileResponseSchema, type OrganizationProfileResponse } from "../../../../packages/schemas/src/organization-profile";
export function ownOrganization(overrides: Partial<OrganizationProfileResponse> = {}) {
  return organizationProfileResponseSchema.parse({ organizationId: "00000000-0000-4000-8000-000000000004", displayName: "SYNTHETIC own organization", legalName: "SYNTHETIC legal organization", bin: "SYNTHETIC private BIN", version: 3, canEdit: true, complete: true, requiredReserveContacts: 0,
    profile: { contactName: "SYNTHETIC private contact", phone: "+7 (000) 000-00-00", email: "synthetic-private@example.invalid", additionalContacts: [], legalAddress: { cityId: "00000000-0000-4000-8000-000000000070", line1: "SYNTHETIC private legal address", postalCode: null }, deliveryAddress: { cityId: "00000000-0000-4000-8000-000000000070", line1: "SYNTHETIC private delivery address", postalCode: null } }, ...overrides });
}
