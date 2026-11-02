import { archiveDocument, archiveId } from "./document-archive";
import type { ArchiveVersion } from "../archive-version-history";
export function versionDocument() {
  const parent = archiveDocument();
  const versions: ArchiveVersion[] = [{ id: parent.id, version: parent.version, status: parent.status, documentDate: parent.documentDate, createdAt: parent.createdAt }, { id: archiveId(1701), version: 1, status: "SUPERSEDED", documentDate: "2026-10-20T01:02:03.000Z", createdAt: "2026-10-20T01:02:03.000Z" }];
  return { ...parent, versions };
}
