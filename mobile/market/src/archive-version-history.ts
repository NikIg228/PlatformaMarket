import { documentArchiveItemSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";
import type { ArchiveMetadata } from "./document-archive-fixture-read";
import type { z } from "zod";

const parentSchema = documentArchiveItemSchema.pick({ id: true, ownerOrganizationId: true, documentNumber: true, version: true, updatedAt: true, status: true, documentDate: true, createdAt: true });
type Parent = Readonly<z.output<typeof parentSchema>>;
const versionsSchema = documentArchiveItemSchema.pick({ versions: true });
export type ArchiveVersion = z.output<typeof versionsSchema>["versions"][number];
export type ArchiveHistorySelection = Readonly<{ documentId: string; parentVersion: number; selection: number }>;
export type ArchiveHistoryValue = { parent: Parent; versions: ArchiveVersion[] };

// Local selection provenance only; this does not establish live permissions or
// replace the server's access + sameDocumentReferences version query.
export function createArchiveHistorySelections(scope: ReadScope) {
  const organizationId = scope.organizationId;
  let issued = new WeakMap<ArchiveHistorySelection, Parent>(), sequence = 0;
  return {
    select(value: ArchiveMetadata): ArchiveHistorySelection | null {
      const parent = parentSchema.safeParse(value); if (!parent.success || parent.data.ownerOrganizationId !== organizationId) return null;
      const target = Object.freeze({ documentId: parent.data.id, parentVersion: parent.data.version, selection: ++sequence });
      issued.set(target, Object.freeze(parent.data)); return target;
    },
    get(target: ArchiveHistorySelection): Parent | undefined { return typeof target === "object" && target !== null ? issued.get(target) : undefined; },
    matches(parent: Parent, value: ArchiveMetadata): boolean { return (Object.keys(parent) as (keyof Parent)[]).every(key => parent[key] === value[key]); },
    reset() { issued = new WeakMap(); },
  };
}
export function decodeArchiveVersions(body: unknown, parent: Parent, minimumVersions?: ReadonlyMap<string, number>): ArchiveVersion[] | null {
  const parsed = versionsSchema.safeParse(body); if (!parsed.success) return null;
  const rows = parsed.data.versions;
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => row.version < (minimumVersions?.get(row.id) ?? row.version))) return null;
  const current = rows.find(row => row.id === parent.id);
  if (current && (current.version !== parent.version || current.status !== parent.status || current.documentDate !== parent.documentDate || current.createdAt !== parent.createdAt)) return null;
  // No fabricated current row, continuous sequence, total, cursor or completeness.
  // Empty is allowed by the actual schema; source ordering is retained verbatim.
  return rows;
}
