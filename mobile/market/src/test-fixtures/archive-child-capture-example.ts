import { archiveChildCaptureKinds, createArchiveChildCaptureKernel, selectArchiveChildCapture, type ArchiveChildCaptureKind } from "./archive-child-capture-kernel";
import { archiveScope, archiveDocument } from "./document-archive";
import { sourceDocument, baseDocument } from "./archive-links";
import { versionDocument } from "./archive-version-history";

type CaptureRecord = { method: "GET"; path: string; httpStatus: number; body: unknown };
export type ArchiveChildCaptureExample = { formatVersion: 1; kind: ArchiveChildCaptureKind; scope: typeof archiveScope; expected: { documentId: string; documentVersion: number }; records: CaptureRecord[] };
/** Original detail factory and real source-issued selection. Metadata is never file delivery or signature verification. */
export async function archiveChildCaptureExample(kind: ArchiveChildCaptureKind = "archive-history"): Promise<ArchiveChildCaptureExample> {
  if (!archiveChildCaptureKinds.includes(kind)) throw Error("Unknown synthetic archive child kind");
  const scope = Object.freeze({ ...archiveScope, environment: "https://market.example.invalid/api" }), parentBody = kind === "archive-related" ? sourceDocument() : kind === "archive-history" ? versionDocument() : archiveDocument(), records: CaptureRecord[] = [];
  const kernel = createArchiveChildCaptureKernel(scope, async path => {
    const body = kind === "archive-related" && records.length === 2 ? baseDocument() : parentBody; records.push({ method: "GET", path, httpStatus: 200, body }); return body;
  });
  try {
    const reader = kernel.reader; await reader.load({ kind: "archive-document", documentId: parentBody.id }); const parent = reader.getState(); if (!("read" in parent) || parent.read.kind !== "archive-document") throw Error("Synthetic archive parent rejected");
    const expected = { documentId: parent.read.value.id, documentVersion: parent.read.value.version }, query = selectArchiveChildCapture(reader, kind); if (!query) throw Error("Synthetic archive selection unavailable");
    await reader.load(query); const result = reader.getState(); if (!("read" in result) || !["ready", "empty"].includes(result.phase) || records.length !== (kind === "archive-related" ? 4 : 2) || !kernel.nativeMetadataLimitPreserved()) throw Error("Synthetic archive child rejected");
    return { formatVersion: 1, kind, scope, expected, records };
  } finally { kernel.close(); }
}
