import type { OfferComparisonResponse } from "../../../../packages/schemas/src/core-api";
import type { ReadScope } from "../read-controller";
import type { FixtureSavedList } from "../saved-lists-fixture-read";
import { createBuyerWorkspaceTransport, type BuyerWorkspaceMutationMethod } from "../buyer-workspace-transport";
import { createSavedListCommandContext } from "../saved-list-command-context";
import { createSavedListCreateCommands } from "../saved-list-create-command";
import { createSavedListItemCommands } from "../saved-list-item-command";
import { createSavedListRemoveCommands } from "../saved-list-remove-command";
import { createLocalListDraft } from "../local-list-draft";
import { savedListWriteAuthorization } from "./saved-list-item-command";

export const savedListCaptureKinds = ["list-create", "list-upsert", "list-remove"] as const;
export type SavedListCaptureKind = typeof savedListCaptureKinds[number];
/** Isolated synthetic fixture authority. Never imported by the native app. */
export function createSavedListMutationCaptureKernel(scope: ReadScope, page: readonly FixtureSavedList[], comparison: OfferComparisonResponse | null, exchange: (method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>) {
  let active = true, reloads = 0, unexpectedReads = 0;
  const raw = createBuyerWorkspaceTransport(scope, async () => { unexpectedReads++; throw Error("Unexpected offline command read"); }, exchange, () => active);
  const context = createSavedListCommandContext(scope), draft = createLocalListDraft(scope); if (comparison) draft.syncComparison(comparison);
  const authorization = { ...savedListWriteAuthorization(), scope }, current = () => page, reload = async () => { reloads++; return undefined; }, isActive = () => active;
  const create = createSavedListCreateCommands(scope, { authorization, createSavedList: raw.createSavedList }, current, reload, isActive, () => false, true, context);
  const item = createSavedListItemCommands(scope, { authorization, upsertSavedListItem: raw.upsertSavedListItem }, draft, () => comparison, current, reload, isActive, () => false, true, context);
  const remove = createSavedListRemoveCommands(scope, { authorization, removeSavedListItem: raw.removeSavedListItem }, current, reload, isActive, () => false, true, context);
  return { create, item, remove, draft, reloads: () => reloads, unexpectedReads: () => unexpectedReads, close() { active = false; create.dispose(); item.dispose(); remove.dispose(); draft.close(); context.close(); raw.close(); } };
}
