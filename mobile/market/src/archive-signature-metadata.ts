import { z } from "zod";
import { documentArchiveSignatureSchema } from "../../../packages/schemas/src/core-api";
import type { ArchiveHistoryValue } from "./archive-version-history";
const signature = documentArchiveSignatureSchema.pick({ id: true, method: true, status: true, signedAt: true });
const response = z.object({ signatures: z.array(signature) });
export type ArchiveSignatureMetadata = z.output<typeof signature>;
export type ArchiveSignatureValue = { parent: ArchiveHistoryValue["parent"]; signatures: ArchiveSignatureMetadata[] };
export function decodeArchiveSignatureMetadata(body: unknown): ArchiveSignatureMetadata[] | null {
  const parsed = response.safeParse(body); if (!parsed.success || new Set(parsed.data.signatures.map(row => row.id)).size !== parsed.data.signatures.length) return null;
  return parsed.data.signatures;
}
