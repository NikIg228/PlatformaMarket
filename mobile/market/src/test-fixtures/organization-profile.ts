import { organizationOnboardingSchema, type OrganizationOnboarding } from "../../../../packages/schemas/src/organization-profile";
import { saveOrganizationProfileSchema } from "../../../../packages/schemas/src/organization-profile";
import { ownOrganization } from "./organization";
import { api, org, user } from "./market-session";
import type { ReadScope } from "../read-controller";
export const profileScope: ReadScope = { product: "market", environment: api, userId: user.id, organizationId: org, generation: 1 };
export const profileId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const profileCities = () => [{ id: profileId(70), nameRu: "SYNTHETIC Алматы", region: { nameRu: "SYNTHETIC регион" } }, { id: profileId(71), nameRu: "SYNTHETIC Астана", region: { nameRu: "SYNTHETIC регион 2" } }];
export const organizationProfile = (overrides: Parameters<typeof ownOrganization>[0] = {}) => ownOrganization({ organizationId: org, ...overrides });
export const profileInput = (overrides: object = {}) => saveOrganizationProfileSchema.parse({ ...organizationProfile().profile, expectedVersion: 3, idempotencyKey: profileId(150001), ...overrides });

export function organizationOnboarding(capability: "BUYER" | "SUPPLIER" = "BUYER", overrides: Partial<OrganizationOnboarding> = {}): OrganizationOnboarding {
  const supplier = capability === "SUPPLIER";
  const organization = organizationProfile({ requiredReserveContacts: supplier ? 2 : 0, complete: !supplier, ...(supplier ? { profile: { ...organizationProfile().profile!, additionalContacts: [] } } : {}) });
  const steps: OrganizationOnboarding["steps"] = [{ id: "organization", label: "SYNTHETIC source organization label", complete: organization.complete, reason: organization.complete ? null : "SYNTHETIC source profile reason", action: "profile" }];
  if (supplier) steps.push({ id: "warehouse", label: "SYNTHETIC warehouse", complete: false, reason: "SYNTHETIC source warehouse reason", action: "warehouse" }, { id: "credentials", label: "SYNTHETIC credentials", complete: false, reason: "SYNTHETIC source credential reason", action: "compliance" }, { id: "agreement", label: "SYNTHETIC agreement", complete: false, reason: "SYNTHETIC source terms reason", action: "documents" }, { id: "admission", label: "SYNTHETIC admission", complete: false, reason: "SYNTHETIC source operator reason", action: "wait" });
  return organizationOnboardingSchema.parse({ organization, capability, ready: !supplier, steps, ...overrides });
}
