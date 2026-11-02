import { z } from "zod";
import { organizationOnboardingSchema, organizationProfileResponseSchema, saveOrganizationProfileSchema, type OrganizationOnboarding, type OrganizationProfileResponse, type SaveOrganizationProfileInput } from "../../../packages/schemas/src/organization-profile";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import { decodePublicCitiesFixture, citySnapshot, type PublicCity } from "./public-cities-fixture-read";
import type { ReadScope } from "./read-controller";
export type ProfileSave = Readonly<SaveOrganizationProfileInput>;
export type NativeOrganizationProfilePort = Readonly<{
  available(scope: ReadScope): boolean;
  canIssueKey(scope: ReadScope): boolean;
  nextKey(scope: ReadScope): string;
  read(scope: ReadScope): Promise<OrganizationProfileResponse>;
  onboarding?(scope: ReadScope): Promise<OrganizationOnboarding>;
  cities(scope: ReadScope): Promise<readonly PublicCity[]>;
  save(scope: ReadScope, input: ProfileSave): Promise<OrganizationProfileResponse>;
}>;
export type NativeOrganizationProfileClient = { nativeOrganizationProfile?: NativeOrganizationProfilePort };
export class NativeOrganizationProfileError extends Error { constructor(readonly code: "scope" | "input" | "contract" | "key") { super("Organization profile request is unavailable"); this.name = "NativeOrganizationProfileError"; } }
function freezeFields<T extends SaveOrganizationProfileInput | NonNullable<OrganizationProfileResponse["profile"]>>(fields: T): T {
  Object.freeze(fields.legalAddress); Object.freeze(fields.deliveryAddress);
  fields.additionalContacts?.forEach(Object.freeze); if (fields.additionalContacts) Object.freeze(fields.additionalContacts);
  return Object.freeze(fields);
}
/** Check the public owner before traversing private contacts/addresses. */
export function decodeOwnOrganizationProfile(raw: unknown, organizationId: string, assertLive: () => void = () => {}): OrganizationProfileResponse {
  try {
    const identity = organizationProfileResponseSchema.pick({ organizationId: true }).strip().parse(raw);
    if (identity.organizationId !== organizationId) throw Error("owner");
    assertLive();
    const value = organizationProfileResponseSchema.parse(raw);
    if (value.organizationId !== organizationId) throw Error("owner");
    if (value.profile) freezeFields(value.profile);
    return Object.freeze(value);
  } catch (error) { if (error instanceof NativeOrganizationProfileError && error.code === "scope") throw error; throw new NativeOrganizationProfileError("contract"); }
}
/** Source current-company readiness. Never call the separate operator-by-ID endpoint. */
export function decodeOwnOrganizationOnboarding(raw: unknown, organizationId: string, assertLive: () => void = () => {}): OrganizationOnboarding {
  try {
    const root = z.object({ organization: organizationProfileResponseSchema.pick({ organizationId: true }).strip() }).strip().parse(raw);
    if (root.organization.organizationId !== organizationId) throw Error("owner");
    assertLive();
    const value = organizationOnboardingSchema.parse(raw); assertLive();
    const actions = value.capability === "BUYER" ? { organization: "profile" } : { organization: "profile", warehouse: "warehouse", credentials: "compliance", agreement: "documents", admission: "wait" };
    if (value.organization.organizationId !== organizationId || value.steps.length !== Object.keys(actions).length || new Set(value.steps.map(step => step.id)).size !== value.steps.length || value.steps.some(step => !(step.id in actions) || actions[step.id as keyof typeof actions] !== step.action) || value.steps.find(step => step.id === "organization")?.complete !== value.organization.complete || value.ready !== value.steps.every(step => step.complete)) throw Error("steps");
    const organization = decodeOwnOrganizationProfile(value.organization, organizationId, assertLive);
    value.steps.forEach(Object.freeze); Object.freeze(value.steps); assertLive();
    return Object.freeze({ ...value, organization });
  } catch (error) { if (error instanceof NativeOrganizationProfileError && error.code === "scope") throw error; throw new NativeOrganizationProfileError("contract"); }
}
/** Fixed own-organization RPC. Presence is a transport capability, never an edit grant. */
export function bindNativeOrganizationProfile(scope: ReadScope, read: (path: string) => Promise<unknown>, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeOrganizationProfileError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), issued = new Set<string>(), attempts = new Map<string, Readonly<{ bytes: string; body: ProfileSave }>>();
  const get = async (candidate: ReadScope, path: string) => { lifetime.assert(candidate); try { const raw = await read(path); lifetime.assert(candidate); return raw; } catch (error) { lifetime.assert(candidate); throw error; } };
  const port: NativeOrganizationProfilePort = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueKey: keys.canIssue,
    nextKey(candidate) { lifetime.assert(candidate); const key = keys.next(candidate); lifetime.assert(candidate); issued.add(key); return key; },
    async read(candidate) { const raw = await get(candidate, "/organizations/current/profile"), value = decodeOwnOrganizationProfile(raw, lifetime.owner.organizationId, () => lifetime.assert(candidate)); lifetime.assert(candidate); return value; },
    async onboarding(candidate) { const raw = await get(candidate, "/organizations/current/onboarding"), value = decodeOwnOrganizationOnboarding(raw, lifetime.owner.organizationId, () => lifetime.assert(candidate)); lifetime.assert(candidate); return value; },
    async cities(candidate) { const raw = await get(candidate, "/catalog/cities"), parsed = decodePublicCitiesFixture(raw); if (!parsed) throw new NativeOrganizationProfileError("contract"); const value = Object.freeze(parsed.map(citySnapshot)); lifetime.assert(candidate); return value; },
    async save(candidate, input) {
      lifetime.assert(candidate); let body: ProfileSave;
      try { body = freezeFields(saveOrganizationProfileSchema.parse(input)); if (JSON.stringify(body) !== JSON.stringify(input)) throw Error("canonical"); } catch { throw new NativeOrganizationProfileError("input"); }
      lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeOrganizationProfileError("key");
      const bytes = JSON.stringify(body), previous = attempts.get(body.idempotencyKey); if (previous && previous.bytes !== bytes) throw new NativeOrganizationProfileError("input");
      const attempt = previous ?? Object.freeze({ bytes, body }); if (!previous) attempts.set(body.idempotencyKey, attempt);
      try { const raw = await postOnce("/organizations/current/profile", attempt.body); lifetime.assert(candidate); const value = decodeOwnOrganizationProfile(raw, lifetime.owner.organizationId, () => lifetime.assert(candidate)); lifetime.assert(candidate); if (value.version < attempt.body.expectedVersion) throw new NativeOrganizationProfileError("contract"); return value; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); issued.clear(); attempts.clear(); } });
}
