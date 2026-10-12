import type { ConversationDetail, UploadedConversationAttachment } from "@marketplace/schemas";
import type { SupportQueuedFile } from "./support-files";

export type ConversationDraft = { body: string; files: UploadedConversationAttachment[]; queue: SupportQueuedFile[] };
export const emptyConversationDraft = (): ConversationDraft => ({ body: "", files: [], queue: [] });
export const conversationPayload = (draft: ConversationDraft) => ({ body: draft.body.trim(), attachments: draft.files.map(({ assetId }) => ({ assetId })) });
export function mergeConversationHistory(previous: ConversationDetail | null, next: ConversationDetail) {
  if (!previous || previous.conversation.id !== next.conversation.id) return next;
  const first = next.messages[0]?.sequence;
  const older = first === undefined ? [] : previous.messages.filter(message => message.sequence < first);
  return older.length ? { ...next, messages: [...older, ...next.messages], hasOlder: previous.hasOlder } : next;
}

/** Bridge messages received while the tab was away; never silently skip a page. */
export async function completeConversationUpdate(previous: ConversationDetail | null, latest: ConversationDetail,
  older: (before: number) => Promise<ConversationDetail>, isCurrent: () => boolean) {
  if (!previous || previous.conversation.id !== latest.conversation.id) return latest;
  const through = previous.messages.at(-1)?.sequence;
  if (through === undefined) return latest;
  let next = latest;
  while (next.hasOlder && (next.messages[0]?.sequence ?? 0) > through + 1 && isCurrent()) {
    const before = next.messages[0].sequence;
    const page = await older(before);
    if (page.conversation.id !== latest.conversation.id || !page.messages.length || page.messages[0].sequence >= before)
      throw new Error("Не удалось обновить всю историю. Повторите загрузку.");
    next = { ...latest, hasOlder: page.hasOlder, messages: [...page.messages, ...next.messages] };
  }
  return mergeConversationHistory(previous, next);
}
