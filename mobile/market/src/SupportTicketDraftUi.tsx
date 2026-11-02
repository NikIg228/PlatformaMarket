import type { SupportCreateCommand } from "./support-command-fixture";
import { SupportCreateCommandPanel, useSupportCreateState } from "./SupportCommandUi";
import { DraftFormInput as FormInput } from "./DraftFormInput";
import { useRef, useSyncExternalStore } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { supportDraftPriorities, supportTextFields, type SupportTicketDraft, type SupportTextField } from "./support-ticket-draft";
import type { Locale } from "./format-wire";
import { copy, supportDraftFieldLabel, supportDraftIssueText, supportPriorityLabel } from "./i18n";
import { Button, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";

export function SupportDraftLauncher({ store, locale, onOpen }: { store: SupportTicketDraft; locale: Locale; onOpen: () => void }) {
  const t = copy[locale], state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (!state.available) return null;
  return <Stack>{state.discarded && <Notice title={t.supportDraftDiscarded} body={t.supportDraftDiscardedBody} />}
    {state.started && <><Notice title={t.supportLocalDraft} body={t.supportDraftOnlyLocal} /><Text kind="caption" secondary>{state.dirty ? t.supportDraftDirty : t.supportDraftUnchanged}</Text></>}
    <Button label={state.started ? t.supportDraftResume : t.supportDraftStart} onPress={onOpen} />
  </Stack>;
}
export function SupportTicketDraftForm({ store, locale, onBack, command }: { command?: SupportCreateCommand; store: SupportTicketDraft; locale: Locale; onBack: () => void }) {
  const t = copy[locale], state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useSupportCreateState(command); const locked = !!command?.isAvailable() && command.isLocked();
  const subject = useRef<FormInputHandle>(null), description = useRef<FormInputHandle>(null), category = useRef<FormInputHandle>(null);
  const refs = { subject, description, category };
  if (!state.available || !state.started) return <Notice title={t.supportDraftUnavailable} body={t.supportDraftUnavailableBody} action={<Button label={t.supportDraftBack} onPress={onBack} />} />;
  const check = () => { const result = store.check(); if (result.firstError && result.firstError !== "priority") refs[result.firstError].current?.focus(); };
  const errorText = (field: SupportTextField) => state.errors[field] ? supportDraftIssueText(state.errors[field], locale) : null;
  const field = (name: SupportTextField) => {
    const error = errorText(name), label = supportDraftFieldLabel(name, locale);
    return <Stack key={name}><Text strong>{label}</Text>
      <FormInput draftSelection={{ owner: store, key: "ticket", field: name, readValue: () => { const row = store.getSnapshot(); return row.started && row.available ? row.values[name] : null; } }} ref={refs[name]} autoFocus={name === "subject"} accessibilityLabel={label} accessibilityHint={error ?? (name === "category" ? t.supportDraftCategoryHint : t.supportDraftOnlyLocal)}
        editable={!locked} value={state.values[name]} multiline={name === "description"} textAlignVertical={name === "description" ? "top" : undefined}
        style={name === "description" ? { minHeight: theme.height * 3 } : undefined}
        submitBehavior={name === "subject" ? "submit" : undefined}
        returnKeyType={name === "subject" ? "next" : name === "category" ? "done" : "default"}
        onSubmitEditing={name === "subject" ? () => description.current?.focus() : name === "category" ? check : undefined}
        onChangeText={text => store.setText(name, text)} />
      {error && <Text secondary>{error}</Text>}
    </Stack>;
  };
  const hasErrors = Object.keys(state.errors).length > 0;
  const errorSummary = [...supportTextFields.map(name => { const error = errorText(name); return error ? `${supportDraftFieldLabel(name, locale)}: ${error}` : null; }), state.errors.priority ? `${t.supportDraftPriority}: ${supportDraftIssueText(state.errors.priority, locale)}` : null].filter(Boolean).join(". ");
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Notice title={t.supportLocalDraft} body={t.supportDraftOnlyLocal} />
    <Text kind="caption" secondary>{state.dirty ? t.supportDraftDirty : t.supportDraftUnchanged}</Text>
    {field("subject")}{field("description")}{field("category")}
    <Text strong>{t.supportDraftPriority}</Text><Stack row>{supportDraftPriorities.map(priority => <Button key={priority} tone="tab" disabled={locked} label={supportPriorityLabel(priority, locale)} selected={state.values.priority === priority} onPress={() => store.setPriority(priority)} />)}</Stack>
    {state.errors.priority && <Text secondary>{supportDraftIssueText(state.errors.priority, locale)}</Text>}
    {hasErrors && <Notice kind="error" title={t.supportDraftError} body={errorSummary} />}
    {state.checked && !hasErrors && <Notice title={t.supportDraftChecked} body={t.supportDraftOnlyLocal} />}
    <Button label={t.supportDraftCheck} disabled={locked} onPress={check} /><Button label={t.supportDraftBack} onPress={onBack} />
    {command && <SupportCreateCommandPanel command={command} locale={locale} onInvalid={check} />}
    {!locked && <Button label={t.supportDraftCancel} onPress={() => { store.cancel(); onBack(); }} />}
  </ScrollView>;
}
const styles = StyleSheet.create({ form: { gap: theme.space.page, paddingBottom: theme.space.section } });
