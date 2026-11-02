import { createDocumentArchiveFixtureRead, type ArchiveFixtureQuery } from "../document-archive-fixture-read";
import { bindMarketReads } from "../market-transport";
import { createMarketOperationScope } from "../market-operation-scope";
import type { ReadScope } from "../read-controller";

export const archiveChildCaptureKinds = ["archive-related", "archive-history", "archive-signatures", "archive-participants"] as const;
export type ArchiveChildCaptureKind = typeof archiveChildCaptureKinds[number];
/** Explicit full source fixture only. The original native client retains archiveMetadataOnly:true. */
export function createArchiveChildCaptureKernel(scope: ReadScope, read: (path: string) => Promise<unknown>) {
  let active = true;
  const lifetime = createMarketOperationScope(scope, () => active, () => Error("Offline archive fixture context unavailable"));
  const native = bindMarketReads(async path => { lifetime.assert(scope); const body = await read(path); lifetime.assert(scope); return body; }, scope.organizationId);
  const detail = native.archiveDocumentFixture;
  if (!detail || native.archiveMetadataOnly !== true) throw Error("Existing native metadata limit unavailable");
  // This private fixture composition is not returned to NativeMarketApp or runtime admission.
  const reader = createDocumentArchiveFixtureRead(scope, { archiveDocumentFixture: (owner, id) => { lifetime.assert(owner); return detail(owner, id); } });
  return { reader, nativeMetadataLimitPreserved: () => native.archiveMetadataOnly === true, close() { active = false; lifetime.close(); reader.reset(); } };
}
export function selectArchiveChildCapture(reader: ReturnType<typeof createArchiveChildCaptureKernel>["reader"], kind: ArchiveChildCaptureKind): ArchiveFixtureQuery | null {
  if (kind === "archive-related") {
    const state = reader.getState(); return "read" in state && state.read.kind === "archive-document" && state.read.links.base.state === "available" ? { kind, target: state.read.links.base.target } : null;
  }
  const target = kind === "archive-history" ? reader.selectHistory() : kind === "archive-signatures" ? reader.selectSignatures() : reader.selectParticipants();
  return target ? { kind, target } : null;
}
