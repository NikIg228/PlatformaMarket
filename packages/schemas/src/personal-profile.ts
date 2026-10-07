import { z } from "zod";
import { organizationContactSchema } from "./organization-profile.js";

export const personalProfileSchema = z.object({
  id: z.uuid(), displayName: z.string(), email: z.email(), phone: z.string().nullable(),
  avatarAssetId: z.uuid().nullable(), version: z.number().int().positive(),
}).strict();
const version = z.number().int().positive();
export const updatePersonalProfileSchema = z.object({
  expectedVersion: version,
  displayName: z.string().trim().min(2).max(160).optional(),
  phone: organizationContactSchema.shape.phone.optional(),
}).strict().refine(value => value.displayName !== undefined || value.phone !== undefined, "Укажите изменённое поле");
export const requestProfileEmailSchema = z.object({ expectedVersion: version, email: z.email().max(254).toLowerCase() }).strict();
export const profileEmailRequestedSchema = z.object({ ok: z.literal(true), verificationRequired: z.literal(true), email: z.email(), delivery: z.enum(["LOCAL_FILE", "PROVIDER"]) }).strict();
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_JSON_BYTES = Math.ceil(AVATAR_MAX_BYTES / 3) * 4 + 4096;
export const profileAvatarSchema = z.object({ contentType: z.enum(["image/png", "image/jpeg"]), contentBase64: z.string() }).strict();
export const uploadProfileAvatarSchema = z.object({
  expectedVersion: version, fileName: z.string().min(1).max(240), contentBase64: z.string().min(4).max(Math.ceil(AVATAR_MAX_BYTES / 3) * 4),
}).strict();
export type PersonalProfile = z.infer<typeof personalProfileSchema>;
export type UpdatePersonalProfile = z.infer<typeof updatePersonalProfileSchema>;
export type RequestProfileEmail = z.infer<typeof requestProfileEmailSchema>;
export type UploadProfileAvatar = z.infer<typeof uploadProfileAvatarSchema>;
export type ProfileEmailRequested = z.infer<typeof profileEmailRequestedSchema>;
export type ProfileAvatar = z.infer<typeof profileAvatarSchema>;
