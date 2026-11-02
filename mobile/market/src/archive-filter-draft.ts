import { documentArchiveQuerySchema } from "../../../packages/schemas/src/core-api";
import type { ArchiveInput, ArchiveParsedInput } from "./document-archive-fixture-read";

const choiceKeys = ["view", "category", "kind", "status", "accountingStatus"] as const;
export type ArchiveFilterFields = Pick<ArchiveParsedInput, typeof choiceKeys[number]> & { dateFromText?: string; dateToText?: string };
export function archiveUTCText(value: string): string { return value.replace("T", " ").replace(/Z$/, ""); }
export function archiveFilterDraft(input: ArchiveInput): ArchiveFilterFields {
  const choices = Object.fromEntries(choiceKeys.flatMap(key => input[key] === undefined ? [] : [[key, input[key]]])) as Pick<ArchiveFilterFields, typeof choiceKeys[number]>;
  return { ...choices, ...(input.dateFrom === undefined ? {} : { dateFromText: archiveUTCText(input.dateFrom) }), ...(input.dateTo === undefined ? {} : { dateToText: archiveUTCText(input.dateTo) }) };
}
function instant(text: string | undefined): string | undefined | null {
  const value = text?.trim(); if (!value) return undefined;
  // The field explicitly says UTC. Never infer a device zone, day boundary,
  // current time or fractional precision; the actual schema validates the date.
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) return null;
  return `${value.replace(" ", "T")}Z`;
}
export function parseArchiveFilterDraft(draft: ArchiveFilterFields): ArchiveParsedInput | null {
  const dateFrom = instant(draft.dateFromText), dateTo = instant(draft.dateToText);
  if (dateFrom === null || dateTo === null) return null;
  const choices = Object.fromEntries(choiceKeys.flatMap(key => draft[key] === undefined ? [] : [[key, draft[key]]]));
  const result = documentArchiveQuerySchema.safeParse({ ...choices, ...(dateFrom === undefined ? {} : { dateFrom }), ...(dateTo === undefined ? {} : { dateTo }) });
  return result.success ? Object.freeze(result.data) : null;
}
export function archiveFiltersUnchanged(input: ArchiveInput, next: ArchiveParsedInput): boolean {
  return ([...choiceKeys, "dateFrom", "dateTo"] as const).every(key => input[key] === next[key]);
}
