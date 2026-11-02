import { profileAvatarSchema, AVATAR_MAX_BYTES, type ProfileAvatar } from "../../../packages/schemas/src/personal-profile";
export type OwnProfileAvatar = Readonly<ProfileAvatar>;
export class ProfileAvatarError extends Error { constructor(readonly code: "contract" | "size") { super("Profile photo response is unavailable"); this.name = "ProfileAvatarError"; } }
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Producer's existing 2MiB PNG/JPEG contract. A signature check is not a full native-decoder or CLEAN attestation. */
export function decodeProfileAvatar(raw: unknown): OwnProfileAvatar {
  try {
  const checked = profileAvatarSchema.safeParse(raw); if (!checked.success) throw new ProfileAvatarError("contract");
  const value = checked.data, data = value.contentBase64, maxEncoded = Math.ceil(AVATAR_MAX_BYTES / 3) * 4;
  if (data.length > maxEncoded) throw new ProfileAvatarError("size");
  if (data.length < 4 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new ProfileAvatarError("contract");
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0, size = data.length / 4 * 3 - padding;
  if (size < 1 || size > AVATAR_MAX_BYTES) throw new ProfileAvatarError("size");
  if (padding === 2 && (alphabet.indexOf(data.at(-3)!) & 15) !== 0 || padding === 1 && (alphabet.indexOf(data.at(-2)!) & 3) !== 0) throw new ProfileAvatarError("contract");
  const head: number[] = [];
  for (let offset = 0; offset < Math.min(data.length, 12); offset += 4) {
    const a = alphabet.indexOf(data[offset]!), b = alphabet.indexOf(data[offset + 1]!), c = alphabet.indexOf(data[offset + 2]!), d = alphabet.indexOf(data[offset + 3]!);
    head.push((a << 2 | b >>> 4) & 255);
    if (data[offset + 2] !== "=") head.push((b << 4 | c >>> 2) & 255);
    if (data[offset + 3] !== "=") head.push((c << 6 | d) & 255);
  }
  const valid = value.contentType === "image/png" ? [137,80,78,71,13,10,26,10].every((byte, index) => head[index] === byte) : head[0] === 255 && head[1] === 216 && head[2] === 255;
  if (!valid) throw new ProfileAvatarError("contract");
  return Object.freeze(value);
  } catch (error) { if (error instanceof ProfileAvatarError) throw error; throw new ProfileAvatarError("contract"); }
}
