import { personalProfileSchema, updatePersonalProfileSchema, profileEmailRequestedSchema, profileAvatarSchema, type PersonalProfile } from "../../../../packages/schemas/src/personal-profile";
import { api, org, user } from "./market-session";
import type { ReadScope } from "../read-controller";
export const personalScope: ReadScope = { product: "market", environment: api, userId: user.id, organizationId: org, generation: 1 };
export const personalId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const personalProfile = (overrides: Partial<PersonalProfile> = {}) => personalProfileSchema.parse({ id: user.id, displayName: "SYNTHETIC own profile name", email: user.email, phone: "+7 700 000 0000", avatarAssetId: null, version: 3, ...overrides });
export const personalUpdate = (overrides: object = {}) => updatePersonalProfileSchema.parse({ expectedVersion: 3, displayName: "SYNTHETIC updated own profile name", ...overrides });

export const profileEmailAccepted = (email: string, delivery: "PROVIDER" | "LOCAL_FILE" = "PROVIDER") => profileEmailRequestedSchema.parse({ ok: true, verificationRequired: true, email, delivery });

const syntheticPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f9sAAAAASUVORK5CYII=";
export function personalAvatar(contentType: "image/png" | "image/jpeg" = "image/png", serial = 0) {
  const bytes = contentType === "image/png" ? Buffer.from(syntheticPng, "base64") : Buffer.from([255,216,255,224,0,4,74,70,255,217]);
  return profileAvatarSchema.parse({ contentType, contentBase64: Buffer.concat([bytes, ...(serial ? [Buffer.from([serial & 255])] : [])]).toString("base64") });
}
export const personalProfileWithAvatar = (overrides: Parameters<typeof personalProfile>[0] = {}) => personalProfile({ avatarAssetId: personalId(170001), ...overrides });
