import { BadRequestException } from "@nestjs/common";

/** Reject the encoded/decoded size before Buffer allocates the uploaded file. */
export function decodeBoundedBase64(value: string, maxBytes: number): Buffer {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid upload byte limit");
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const decodedBytes = value.length / 4 * 3 - padding;
  if (value.length > Math.ceil(maxBytes / 3) * 4 || decodedBytes > maxBytes) {
    throw new BadRequestException("File exceeds the allowed byte limit");
  }
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new BadRequestException("Invalid base64 file content");
  }
  return Buffer.from(value, "base64");
}
