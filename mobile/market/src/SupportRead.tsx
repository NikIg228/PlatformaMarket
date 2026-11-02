import { AttachmentImageUi } from "./AttachmentImageUi";
import type { AttachmentImages } from "./attachment-images";
import { canAdvanceCursor } from "./cursor-navigation";
import type { ReactNode } from "react";
import { FlatList, StyleSheet } from "react-native";
import type { SupportTicketDetail, SupportTicketSummary } from "../../../packages/schemas/src/support-workflow";
import type { SupportAttachment } from "../../../packages/schemas/src/support-files";
import { formatTimestamp, type Locale } from "./format-wire";
import { copy, supportPriorityLabel, supportStatusLabel } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";

const formats = { "image/png": "PNG", "image/jpeg": "JPEG", "application/pdf": "PDF", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX" } satisfies Record<SupportAttachment["contentType"], string>;
export function SupportListRead({ tickets, offset, locale, controls, onOpen, onNext }: { tickets: readonly SupportTicketSummary[]; offset: number; locale: Locale; controls: ReactNode; onOpen: (ticketId: string) => void; onNext: () => void }) {
  const t = copy[locale];
  return <FlatList data={tickets} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack><Text secondary>{t.supportReadOnly}</Text>{controls}<Text kind="caption" secondary>{t.supportShown}: {tickets.length}</Text></Stack>} ListEmptyComponent={<Notice title={t.supportEmpty} />} ListFooterComponent={tickets.length === 50 && offset + 50 <= 100_000 ? <Button label={t.next} onPress={onNext} /> : undefined} renderItem={({ item }) => <Surface>
    <Text kind="subtitle" strong>{item.number.trim() ? item.number : t.supportTicket}</Text><Text strong>{item.subject.trim() ? item.subject : t.supportSubject}</Text>
    <Text>{t.supportStatus}: {supportStatusLabel(item.status, locale)}</Text><Text>{t.supportPriority}: {supportPriorityLabel(item.priority, locale)}</Text>
    <Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text>
    <Button label={t.open} accessibilityLabel={`${t.open}: ${item.number.trim() ? item.number : item.subject || t.supportTicket}`} onPress={() => onOpen(item.id)} />
  </Surface>} />;
}
export function SupportTicketRead({ ticket, beforeMessageId, visitedBefore = [], userId, locale, onOlder, retry, replyControls, attachmentImages }: { attachmentImages?: AttachmentImages; ticket: SupportTicketDetail; beforeMessageId?: string; visitedBefore?: readonly (string | undefined)[]; userId: string; locale: Locale; onOlder: (before: string) => void; retry: () => void; replyControls?: ReactNode }) {
  const t = copy[locale]; const oldest = ticket.messages[0]?.id;
  const canLoadOlder = ticket.hasOlder && oldest !== undefined && canAdvanceCursor(oldest, [...visitedBefore, beforeMessageId]);
  return <FlatList data={ticket.messages} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>
    <Surface><Text kind="subtitle" strong>{ticket.number.trim() ? ticket.number : t.supportTicket}</Text><Text strong>{ticket.subject.trim() ? ticket.subject : t.supportSubject}</Text>
      <Text>{t.supportStatus}: {supportStatusLabel(ticket.status, locale)}</Text><Text>{t.supportPriority}: {supportPriorityLabel(ticket.priority, locale)}</Text>
      <Text>{t.supportDescription}: {ticket.description.trim() ? ticket.description : t.detailsUnknown}</Text><Text>{t.createdAt}: {formatTimestamp(ticket.createdAt, locale) ?? t.dateUnknown}</Text>
    </Surface><Text secondary>{t.supportReadOnly}</Text>{replyControls}
    {canLoadOlder && <Button label={t.supportOlder} onPress={() => onOlder(oldest)} />}
    {ticket.hasOlder && !canLoadOlder && <Notice kind="error" title={t.supportOlderUnavailable} body={t.supportPartialBody} action={<Button label={t.retry} onPress={retry} />} />}
  </Stack>} ListEmptyComponent={<Notice title={t.supportMessagesEmpty} />} renderItem={({ item }) => <Surface>
    {/* Server authorLabel currently contains Russian UI roles; identity comes from the actual author ID. */}
    <Text strong>{item.authorId === userId ? t.supportSelf : t.supportOther}</Text><Text kind="caption" secondary>{formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text>
    <Text>{item.body}</Text><Text kind="caption" secondary>{t.supportAttachments}</Text>
    {item.attachments === null ? <Text secondary>{t.supportAttachmentsUnknown}</Text> : item.attachments.length === 0 ? <Text secondary>{t.supportNoAttachments}</Text> : item.attachments.map(file => <Stack key={file.assetId}><Text>{file.name}</Text><Text kind="caption" secondary>{formats[file.contentType]} · {file.sizeBytes} {t.supportBytes}</Text>{attachmentImages && <AttachmentImageUi model={attachmentImages} parent={{ kind: "support", value: ticket }} messageId={item.id} file={file} locale={locale} />}</Stack>)}
  </Surface>} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
