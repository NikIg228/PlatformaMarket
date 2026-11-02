import type { SupportReplyCommands } from "./support-reply-command-fixture";
import { SupportReplyCommandPanel, useSupportReplyState } from "./SupportCommandUi";
import { DraftFormInput as FormInput } from "./DraftFormInput";
import { useRef, useSyncExternalStore } from "react";
import { ScrollView, StyleSheet } from "react-native";
import type { SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { SupportReplyDrafts, ReplyDraftTarget } from "./support-reply-draft";
import type { Locale } from "./format-wire";
import { copy, supportReplyIssueText } from "./i18n";
import { Button, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";

export function SupportReplyLauncher({ store, ticket, locale, onOpen }: { store: SupportReplyDrafts; ticket: SupportTicketDetail; locale: Locale; onOpen: () => void }) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const t = copy[locale], entry = store.entryFor(ticket);
  return <Stack>
    {entry?.discarded && <Notice title={t.supportReplyDiscarded} body={t.supportReplyDiscardedBody} />}
    {entry?.available ? <>
      {entry.started && <Notice title={t.supportReplyTitle} body={t.supportReplyLocal} />}
      <Button label={entry.started ? t.supportReplyResume : t.supportReplyStart} onPress={onOpen} />
    </> : <Notice title={t.supportReplyUnavailable} body={t.supportReplyUnavailableBody} />}
  </Stack>;
}
export function SupportReplyDraftForm({ store, ticket, target, locale, onBack, command }: { command?: SupportReplyCommands; store: SupportReplyDrafts; ticket: SupportTicketDetail; target: ReplyDraftTarget; locale: Locale; onBack: () => void }) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const input = useRef<FormInputHandle>(null), t = copy[locale], entry = store.entryFor(ticket);
  useSupportReplyState(command); const locked = !!command?.isAvailable() && command.isLocked(target);
  if (!entry?.available || !entry.started || entry.target !== target) return <Stack><Notice title={t.supportReplyUnavailable} body={t.supportReplyUnavailableBody} action={<Button label={t.supportReplyBack} onPress={onBack} />} />{command && <SupportReplyCommandPanel command={command} target={target} locale={locale} onInvalid={() => {}} onBack={onBack} />}</Stack>;
  const error = entry.issue ? supportReplyIssueText(entry.issue, locale) : null;
  const check = () => { if (!store.check(target)) input.current?.focus(); };
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Notice title={t.supportReplyTitle} body={t.supportReplyLocal} />
    <Text strong>{ticket.number.trim() ? ticket.number : t.supportTicket}</Text><Text>{ticket.subject.trim() ? ticket.subject : t.supportSubject}</Text>
    <Text kind="caption" secondary>{entry.dirty ? t.supportDraftDirty : t.supportReplyUnchanged}</Text>
    <Text strong>{t.supportReplyBody}</Text>
    <FormInput draftSelection={{ owner: store, key: target, field: "body", readValue: () => { const row = store.getSnapshot().entries[target.id]; return row?.target === target && row.started && row.available ? row.body : null; } }} editable={!locked} ref={input} autoFocus multiline textAlignVertical="top" style={styles.input} accessibilityLabel={t.supportReplyBody} accessibilityHint={error ?? t.supportReplyLocal} value={entry.body} onChangeText={body => store.setText(target, body)} />
    {error && <Notice kind="error" title={t.supportReplyError} body={error} />}
    {entry.checked && !error && <Notice title={t.supportReplyChecked} body={t.supportReplyLocal} />}
    <Button label={t.supportReplyCheck} disabled={locked} onPress={check} /><Button label={t.supportReplyBack} onPress={onBack} />
    {command && <SupportReplyCommandPanel command={command} target={target} locale={locale} onInvalid={check} onBack={onBack} />}
    {!locked && <Button label={t.supportReplyCancel} onPress={() => { store.cancel(target); onBack(); }} />}
  </ScrollView>;
}
const styles = StyleSheet.create({ form: { gap: theme.space.page, paddingBottom: theme.space.section }, input: { minHeight: theme.height * 3 } });
