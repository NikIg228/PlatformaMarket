import { bindMarketReads } from "../market-transport";
import { createDocumentArchiveFixtureRead, type ArchiveFixtureQuery } from "../document-archive-fixture-read";
import { createPublicCitiesFixtureRead } from "../public-cities-fixture-read";
import { archiveScope, archivePage, archiveSummary, archiveDocument, archiveDocumentId } from "./document-archive";
import { cityFixture } from "./public-cities";

/** Synthetic only; records are emitted by actual native bindings and model requests. */
export async function nativeMetadataCaptureExample(kind: "document-archive" | "archive-document" | "public-cities" = "document-archive") {
  const scope = Object.freeze({ ...archiveScope, environment: "https://market.example.invalid/api" });
  const records: { method: "GET"; path: string; httpStatus: number; body: unknown }[] = [];
  const query: ArchiveFixtureQuery | { kind: "public-cities" } = kind === "document-archive" ? { kind, input: { limit: 50, q: "SYNTHETIC" } } : kind === "archive-document" ? { kind, documentId: archiveDocumentId } : { kind };
  const client = bindMarketReads(async path => {
    const body = kind === "public-cities" ? cityFixture() : kind === "archive-document" ? archiveDocument() : path.endsWith("/summary") ? archiveSummary() : archivePage();
    records.push({ method: "GET", path, httpStatus: 200, body }); return body;
  }, scope.organizationId);
  if (query.kind === "public-cities") { const reader = createPublicCitiesFixtureRead(scope, client.publicCitiesFixture); await reader.load(); reader.reset(); }
  else { const reader = createDocumentArchiveFixtureRead(scope, client); await reader.load(query); reader.reset(); }
  return { formatVersion: 1 as const, scope, query, records };
}
