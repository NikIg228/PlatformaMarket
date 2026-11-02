import { decodeArchiveParticipantMetadata, type ArchiveParticipantValue } from "./archive-participant-metadata";
import { decodeArchiveSignatureMetadata, type ArchiveSignatureValue } from "./archive-signature-metadata";
import { createArchiveHistorySelections, decodeArchiveVersions, type ArchiveHistorySelection, type ArchiveHistoryValue } from "./archive-version-history";
import { createArchiveLinkSelections, type ArchiveBaseSelection, type ArchiveDocumentLinks } from "./document-archive-links";
import { z } from "zod";
import { documentArchiveQuerySchema, documentArchiveItemSchema, documentArchiveParticipantSchema, documentArchivePageResponseSchema, documentArchiveSummaryResponseSchema, errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Actual shared validators, projected before private fields are read. The
// owner-bound metadata subset does not replace server DTO/visibility rules.
const party = documentArchiveParticipantSchema.pick({ organizationId: true, role: true }).extend({ organization: documentArchiveParticipantSchema.shape.organization.pick({ id: true }) });
const binding = documentArchiveItemSchema.pick({ id: true, ownerOrganizationId: true }).extend({ participants: z.array(party) });
const metadata = documentArchiveItemSchema.pick({ id: true, ownerOrganizationId: true, category: true, kind: true, format: true, source: true, status: true, title: true, documentNumber: true, documentDate: true, version: true, fileName: true, immutableAt: true, generatedAt: true, expiresAt: true, createdAt: true, updatedAt: true });
const bindingPage = documentArchivePageResponseSchema.extend({ items: z.array(binding) });
const safePage = documentArchivePageResponseSchema.extend({ items: z.array(metadata) });
export type ArchiveMetadata = z.output<typeof metadata>;
export type ArchivePage = z.output<typeof safePage>;
export type ArchiveSummary = z.output<typeof documentArchiveSummaryResponseSchema>;
type Allowed = "q" | "view" | "category" | "kind" | "status" | "accountingStatus" | "dateFrom" | "dateTo" | "cursor" | "limit";
export type ArchiveInput = Readonly<Pick<z.input<typeof documentArchiveQuerySchema>, Allowed>>;
export type ArchiveParsedInput = Readonly<Pick<z.output<typeof documentArchiveQuerySchema>, Allowed>>;
export type { ArchiveFilterFields } from "./archive-filter-draft";
export const archiveDefaultLimit = documentArchiveQuerySchema.parse({}).limit;
const allowedKeys: readonly Allowed[] = ["q", "view", "category", "kind", "status", "accountingStatus", "dateFrom", "dateTo", "cursor", "limit"];
export function parseArchiveInput(input: unknown): ArchiveParsedInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input) || Object.keys(input).some(key => !allowedKeys.some(allowed => allowed === key))) return null;
  // Preserve actual root refinements/defaults, rather than pick an unchecked query.
  const parsed = documentArchiveQuerySchema.safeParse(input); if (!parsed.success) return null;
  const { q, view, category, kind, status, accountingStatus, dateFrom, dateTo, cursor, limit } = parsed.data;
  return Object.freeze({ limit, ...(q === undefined ? {} : { q }), ...(view === undefined ? {} : { view }), ...(category === undefined ? {} : { category }), ...(kind === undefined ? {} : { kind }), ...(status === undefined ? {} : { status }), ...(accountingStatus === undefined ? {} : { accountingStatus }), ...(dateFrom === undefined ? {} : { dateFrom }), ...(dateTo === undefined ? {} : { dateTo }), ...(cursor === undefined ? {} : { cursor }) });
}
type Decode<T> = { ok: true; value: T } | { ok: false; reason: "contract-error" | "visibility-unverified" };
function bindings(rows: z.output<typeof binding>[], organizationId: string): "contract-error" | "visibility-unverified" | null {
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => row.participants.some(participant => participant.organizationId !== participant.organization.id))) return "contract-error";
  // Owner is sufficient for the actual owner/invoice/waybill-preview branches.
  // Non-owner branch needs visibility facts not present in the shared response.
  return rows.some(row => row.ownerOrganizationId !== organizationId) ? "visibility-unverified" : null;
}
export function decodeArchivePage(body: unknown, scope: ReadScope, input: ArchiveParsedInput): Decode<ArchivePage> {
  const ids = bindingPage.safeParse(body); if (!ids.success) return { ok: false, reason: "contract-error" };
  const invalid = bindings(ids.data.items, scope.organizationId); if (invalid) return { ok: false, reason: invalid };
  // Validate only requested source filter fields after owner binding and before
  // public content. Accounting metadata stays outside the output projection.
  if (input.accountingStatus !== undefined) {
    const statuses = z.array(documentArchiveItemSchema.pick({ accountingStatus: true })).safeParse((body as { items: unknown[] }).items);
    if (!statuses.success || statuses.data.some(row => row.accountingStatus !== input.accountingStatus)) return { ok: false, reason: "contract-error" };
  }
  if (input.dateFrom !== undefined || input.dateTo !== undefined) {
    const dates = z.array(documentArchiveItemSchema.pick({ documentDate: true })).safeParse((body as { items: unknown[] }).items);
    if (!dates.success || dates.data.some(row => (input.dateFrom !== undefined && Date.parse(row.documentDate) < Date.parse(input.dateFrom)) || (input.dateTo !== undefined && Date.parse(row.documentDate) > Date.parse(input.dateTo)))) return { ok: false, reason: "contract-error" };
  }
  const parsed = safePage.safeParse(body); if (!parsed.success || parsed.data.items.length > input.limit) return { ok: false, reason: "contract-error" };
  if (parsed.data.items.some(row => (input.category !== undefined && row.category !== input.category) || (input.kind !== undefined && row.kind !== input.kind) || (input.status !== undefined && row.status !== input.status))) return { ok: false, reason: "contract-error" };
  return { ok: true, value: parsed.data };
}
export function decodeArchiveDocument(body: unknown, scope: ReadScope, documentId: string): Decode<ArchiveMetadata> {
  const ids = binding.safeParse(body); if (!ids.success || ids.data.id !== documentId) return { ok: false, reason: "contract-error" };
  const invalid = bindings([ids.data], scope.organizationId); if (invalid) return { ok: false, reason: invalid };
  const parsed = metadata.safeParse(body); return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: "contract-error" };
}
export type DocumentArchiveFixtureClient = {
  /** Local native binding limit; does not change API permissions or response DTO. */
  archiveMetadataOnly?: true;
  /** Existing native archive child GET metadata, without related links or original files. */
  archiveChildMetadata?: true;
  /** Existing native forward base-agreement metadata relation only; never original bytes. */
  archiveBaseMetadata?: true;
  documentArchiveFixture?: (scope: ReadScope, input: ArchiveParsedInput) => Promise<unknown>;
  documentArchiveSummaryFixture?: (scope: ReadScope) => Promise<unknown>;
  archiveDocumentFixture?: (scope: ReadScope, documentId: string) => Promise<unknown>;
};
export type ArchiveFixtureQuery = { kind: "archive-participants"; target: ArchiveHistorySelection } | { kind: "archive-signatures"; target: ArchiveHistorySelection } | { kind: "archive-history"; target: ArchiveHistorySelection } | { kind: "document-archive"; input: ArchiveInput } | { kind: "archive-document"; documentId: string } | { kind: "archive-related"; target: ArchiveBaseSelection };
type Failure = "relation-unverified" | "contract-error" | "visibility-unverified" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error";
export type ArchiveListValue = { page: ArchivePage; query: ArchiveParsedInput; summary: ArchiveSummary | null; summaryIssue: Failure | null; pagination: "provided" | "unconfirmed" };
export type DocumentArchiveFixtureState = { phase: "idle" } | { phase: "loading"; target: { kind: "document-archive" | "archive-document" | "archive-related" | "archive-history" | "archive-signatures" | "archive-participants" } }
  | { phase: "ready" | "empty"; read: { kind: "document-archive"; value: ArchiveListValue } }
  | { phase: "ready"; read: { kind: "archive-document"; value: ArchiveMetadata; links: ArchiveDocumentLinks } }
  | { phase: "ready" | "empty"; read: { kind: "archive-history"; value: ArchiveHistoryValue } }
  | { phase: "ready" | "empty"; read: { kind: "archive-signatures"; value: ArchiveSignatureValue } }
  | { phase: "ready" | "empty"; read: { kind: "archive-participants"; value: ArchiveParticipantValue } }
  | { phase: Failure };
function failure(error: unknown): Failure {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return "error";
  const status = error.status, parsed = errorResponseSchema.safeParse(error.payload);
  if (typeof status !== "number" || !Number.isInteger(status) || status < 300 || status > 599 || !parsed.success || parsed.data.statusCode !== status) return "contract-error";
  return status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error";
}
export function createDocumentArchiveFixtureRead(scope: ReadScope, client: DocumentArchiveFixtureClient) {
  const metadataOnly = client.archiveMetadataOnly === true;
  const childMetadata = !metadataOnly || client.archiveChildMetadata === true;
  const relatedMetadata = !metadataOnly || client.archiveBaseMetadata === true;
  const linksFor = (body: unknown, value: ArchiveMetadata): ArchiveDocumentLinks => !relatedMetadata ? { base: { state: "unsupported" }, order: { state: "unsupported" } } : selections.derive(body, value);
  const owner = Object.freeze({ ...scope }), list = client.documentArchiveFixture, summary = client.documentArchiveSummaryFixture, detail = client.archiveDocumentFixture;
  const selections = createArchiveLinkSelections(owner), histories = createArchiveHistorySelections(owner), signatures = createArchiveHistorySelections(owner), participants = createArchiveHistorySelections(owner);
  let historyAccepted: { target: ArchiveHistorySelection; versions: ReadonlyMap<string, number> } | null = null;
  let state: DocumentArchiveFixtureState = { phase: "idle" }, pending: object | null = null, last: ArchiveFixtureQuery | null = null, accepted: { value: ArchiveMetadata; links: ArchiveDocumentLinks } | null = null;
  const load = async (query: ArchiveFixtureQuery): Promise<"applied" | "discarded"> => {
    const request = {}; pending = request;
    if (metadataOnly && query.kind !== "document-archive" && query.kind !== "archive-document" && !(childMetadata && (query.kind === "archive-history" || query.kind === "archive-signatures" || query.kind === "archive-participants")) && !(relatedMetadata && query.kind === "archive-related")) { pending = null; last = null; accepted = null; state = { phase: "unavailable" }; return "applied"; }
    const input = query.kind === "document-archive" ? parseArchiveInput(query.input) : null;
    if (query.kind === "document-archive" ? !input : query.kind === "archive-participants" ? !participants.get(query.target) : query.kind === "archive-signatures" ? !signatures.get(query.target) : query.kind === "archive-history" ? !histories.get(query.target) : query.kind === "archive-related" ? !selections.get(query.target) : !documentArchiveItemSchema.shape.id.safeParse(query.documentId).success) { pending = null; last = null; accepted = null; state = { phase: "contract-error" }; return "applied"; }
    const snapshot: ArchiveFixtureQuery = query.kind === "document-archive" && input ? Object.freeze({ kind: "document-archive", input }) : Object.freeze({ ...query }); last = snapshot;
    const minimumRelatedVersion = snapshot.kind === "archive-related" && accepted?.value.id === snapshot.target.documentId ? accepted.value.version : null;
    if (snapshot.kind !== "archive-document" || accepted?.value.id !== snapshot.documentId) accepted = null;
    if (snapshot.kind === "document-archive") { selections.reset(); histories.reset(); signatures.reset(); participants.reset(); }
    if (snapshot.kind !== "archive-history" || historyAccepted?.target !== snapshot.target) historyAccepted = null;
    state = { phase: "loading", target: { kind: snapshot.kind } };
    let next: DocumentArchiveFixtureState;
    try {
      if (snapshot.kind === "archive-participants") {
        const parent = participants.get(snapshot.target);
        if (!parent) next = { phase: "contract-error" };
        else if (!detail) next = { phase: "unavailable" };
        else {
          const body = await detail(owner, parent.id); if (pending !== request) return "discarded";
          const decoded = decodeArchiveDocument(body, owner, parent.id);
          if (!decoded.ok) next = { phase: decoded.reason };
          else if (!participants.matches(parent, decoded.value)) next = { phase: "relation-unverified" };
          else {
            const rows = decodeArchiveParticipantMetadata(body);
            next = rows ? { phase: rows.length ? "ready" : "empty", read: { kind: "archive-participants", value: { parent, participants: rows } } } : { phase: "contract-error" };
          }
        }
      } else if (snapshot.kind === "archive-signatures") {
        const parent = signatures.get(snapshot.target);
        if (!parent) next = { phase: "contract-error" };
        else if (!detail) next = { phase: "unavailable" };
        else {
          const body = await detail(owner, parent.id); if (pending !== request) return "discarded";
          const decoded = decodeArchiveDocument(body, owner, parent.id);
          if (!decoded.ok) next = { phase: decoded.reason };
          else if (!signatures.matches(parent, decoded.value)) next = { phase: "relation-unverified" };
          else {
            const rows = decodeArchiveSignatureMetadata(body);
            next = rows ? { phase: rows.length ? "ready" : "empty", read: { kind: "archive-signatures", value: { parent, signatures: rows } } } : { phase: "contract-error" };
          }
        }
      } else if (snapshot.kind === "archive-history") {
        const parent = histories.get(snapshot.target);
        if (!parent) next = { phase: "contract-error" };
        else if (!detail) next = { phase: "unavailable" };
        else {
          const body = await detail(owner, parent.id); if (pending !== request) return "discarded";
          const decoded = decodeArchiveDocument(body, owner, parent.id);
          if (!decoded.ok) next = { phase: decoded.reason };
          else if (!histories.matches(parent, decoded.value)) next = { phase: "relation-unverified" };
          else {
            const versions = decodeArchiveVersions(body, parent, historyAccepted?.versions);
            if (!versions) next = { phase: "contract-error" };
            else { historyAccepted = { target: snapshot.target, versions: new Map(versions.map(row => [row.id, row.version])) }; next = { phase: versions.length ? "ready" : "empty", read: { kind: "archive-history", value: { parent, versions } } }; }
          }
        }
      } else if (snapshot.kind === "archive-related") {
        const parent = selections.get(snapshot.target);
        if (!parent) next = { phase: "contract-error" };
        else if (!detail) next = { phase: "unavailable" };
        else {
          const before = await detail(owner, parent.id); if (pending !== request) return "discarded";
          const verified = decodeArchiveDocument(before, owner, parent.id);
          if (!verified.ok) next = { phase: verified.reason };
          else if (!selections.matches(parent, before, verified.value)) next = { phase: "relation-unverified" };
          else {
            const body = await detail(owner, parent.baseAgreementDocumentId); if (pending !== request) return "discarded";
            const decoded = decodeArchiveDocument(body, owner, parent.baseAgreementDocumentId);
            if (!decoded.ok) next = { phase: decoded.reason };
            else if (decoded.value.category !== "CONTRACT" || (minimumRelatedVersion !== null && decoded.value.version < minimumRelatedVersion)) next = { phase: "relation-unverified" };
            else {
              // There is no inverse child list in the actual base-document DTO.
              // Validate the real forward reference again after the target read.
              const after = await detail(owner, parent.id); if (pending !== request) return "discarded";
              const current = decodeArchiveDocument(after, owner, parent.id);
              if (!current.ok) next = { phase: current.reason };
              else if (!selections.matches(parent, after, current.value)) next = { phase: "relation-unverified" };
              else { accepted = { value: decoded.value, links: selections.derive(body, decoded.value, [...parent.path, decoded.value.id]) }; next = { phase: "ready", read: { kind: "archive-document", ...accepted } }; }
            }
          }
        }
      } else if (snapshot.kind === "document-archive" && input) {
        if (!list) next = { phase: "unavailable" };
        else {
          const [pageResult, summaryResult] = await Promise.allSettled([Promise.resolve().then(() => list(owner, input)), summary ? Promise.resolve().then(() => summary(owner)) : Promise.reject(null)]);
          if (pending !== request) return "discarded";
          if (summaryResult.status === "rejected" && summary && failure(summaryResult.reason) === "authentication-required") next = { phase: "authentication-required" };
          else if (pageResult.status === "rejected") next = { phase: failure(pageResult.reason) };
          else {
            const page = decodeArchivePage(pageResult.value, owner, input);
            if (!page.ok) next = { phase: page.reason };
            else {
              const parsedSummary = summaryResult.status === "fulfilled" ? documentArchiveSummaryResponseSchema.safeParse(summaryResult.value) : null;
              const summaryIssue = !summary ? "unavailable" : summaryResult.status === "rejected" ? failure(summaryResult.reason) : parsedSummary?.success ? null : "contract-error";
              if (summaryIssue === "authentication-required") next = { phase: "authentication-required" };
              else {
                const value: ArchiveListValue = { page: page.value, query: input, summary: parsedSummary?.success ? parsedSummary.data : null, summaryIssue, pagination: page.value.nextCursor === null || (page.value.items.length === input.limit && page.value.nextCursor === page.value.items.at(-1)?.id && page.value.nextCursor !== input.cursor) ? "provided" : "unconfirmed" };
                next = { phase: page.value.items.length ? "ready" : "empty", read: { kind: "document-archive", value } };
              }
            }
          }
        }
      } else if (snapshot.kind === "archive-document") {
        if (!detail) next = { phase: "unavailable" };
        else {
          const body = await detail(owner, snapshot.documentId); if (pending !== request) return "discarded";
          const decoded = decodeArchiveDocument(body, owner, snapshot.documentId);
          if (!decoded.ok) { accepted = null; next = { phase: decoded.reason }; }
          else { accepted = accepted?.value.id === decoded.value.id && accepted.value.version > decoded.value.version ? accepted : { value: decoded.value, links: linksFor(body, decoded.value) }; next = { phase: "ready", read: { kind: "archive-document", ...accepted } }; }
        }
      } else next = { phase: "contract-error" };
    } catch (error) { if (pending !== request) return "discarded"; accepted = null; next = { phase: failure(error) }; }
    if (pending !== request) return "discarded";
    pending = null; state = next; return "applied";
  };
  return { selectParticipants: () => childMetadata && "read" in state && state.read.kind === "archive-document" ? participants.select(state.read.value) : null, selectSignatures: () => childMetadata && "read" in state && state.read.kind === "archive-document" ? signatures.select(state.read.value) : null, selectHistory: () => childMetadata && "read" in state && state.read.kind === "archive-document" ? histories.select(state.read.value) : null, getState: () => state, load, refresh: () => last ? load(last) : Promise.resolve("no-query" as const), reset() { pending = null; last = null; accepted = null; selections.reset(); histories.reset(); signatures.reset(); participants.reset(); historyAccepted = null; state = { phase: "idle" }; } };
}
