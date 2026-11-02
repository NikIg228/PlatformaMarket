import type { ReactNode } from "react";
import { DraftFormInput as FormInput } from "./DraftFormInput";
import { useRef, useSyncExternalStore } from "react";
import { FlatList, ScrollView, StyleSheet } from "react-native";
import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import type { LocalListDraft, LocalListTarget } from "./local-list-draft";
import type { Locale } from "./format-wire";
import { copy, listTextIssueText, quantityDraftIssueText } from "./i18n";
import { Button, Notice, Stack, Surface, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";

export function LocalListResume({ store, locale, onOpen }: { store: LocalListDraft; locale: Locale; onOpen: () => void }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return state.started ? <Button label={copy[locale].localListResume} onPress={onOpen} /> : null;
}
export function LocalListOfferAction({ store, comparison, offerId, locale, onOpen }: { store: LocalListDraft; comparison: OfferComparisonResponse; offerId: string; locale: Locale; onOpen: () => void }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), t = copy[locale];
  return store.canSelect(comparison, offerId) ? <Button label={state.entries[offerId] ? t.localListExisting : t.localListAdd} onPress={onOpen} /> : null;
}
function Unavailable({ locale, onBack }: { locale: Locale; onBack: () => void }) { const t = copy[locale]; return <Notice title={t.localListUnavailable} body={t.localListUnavailableBody} action={<Button label={t.localListBack} onPress={onBack} />} />; }
export function LocalListItemEditor({ store, target, locale, onBack, onOverview, onCancelAll, quantityAction, quantityActionHint, saveAction, saveActionHint }: { store: LocalListDraft; target: LocalListTarget; locale: Locale; onBack: () => void; onOverview: () => void; onCancelAll: () => void; quantityAction?: (focusQuantity: () => void) => ReactNode; quantityActionHint?: () => string | null; saveAction?: (focus: (field:"quantityText"|"noteText")=>void)=>ReactNode; saveActionHint?:()=>{quantity:string|null;note:string|null} }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), entry = store.entryFor(target), t = copy[locale];
  const name = useRef<FormInputHandle>(null), quantityText = useRef<FormInputHandle>(null), noteText = useRef<FormInputHandle>(null), refs = { name, quantityText, noteText };
  if (!entry) return <Unavailable locale={locale} onBack={onBack} />;
  const nameError = state.nameIssue ? listTextIssueText(state.nameIssue, locale) : null, quantityError = entry.quantityIssue ? quantityDraftIssueText(entry.quantityIssue, locale) : null, noteError = entry.noteIssue ? listTextIssueText(entry.noteIssue, locale) : null;
  const firstError = nameError ? "name" : quantityError ? "quantityText" : noteError ? "noteText" : "name";
  const errorSummary = [nameError ? `${t.localListName}: ${nameError}` : null, quantityError ? `${t.localListQuantity}: ${quantityError}` : null, noteError ? `${t.localListNote}: ${noteError}` : null].filter(Boolean).join(". ");
  const check = () => { const result = store.checkEntry(target); if (result.first) refs[result.first].current?.focus(); };
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Notice title={t.localListTitle} body={t.localListOnlyLocal} /><Text>{t.savedListOfferId}: {target.offerId}</Text>
    <Text strong>{t.localListName}</Text><FormInput draftSelection={{ owner: store, key: "list", field: "name", readValue: () => store.getSnapshot().started ? store.getSnapshot().name : null }} ref={name} autoFocus={firstError === "name"} accessibilityLabel={t.localListName} accessibilityHint={nameError ?? t.localListOnlyLocal} value={state.name} onChangeText={value => store.setName(value)} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => quantityText.current?.focus()} />{nameError && <Text secondary>{nameError}</Text>}
    <Text strong>{t.localListQuantity}</Text><FormInput draftSelection={{ owner: store, key: target, field: "quantityText", readValue: () => store.entryFor(target)?.quantityText ?? null }} ref={quantityText} autoFocus={firstError === "quantityText"} accessibilityLabel={t.localListQuantity} accessibilityHint={quantityError ?? saveActionHint?.().quantity ?? quantityActionHint?.() ?? t.localListOnlyLocal} value={entry.quantityText} keyboardType="decimal-pad" returnKeyType="next" onChangeText={value => store.setText(target, "quantityText", value)} onSubmitEditing={() => noteText.current?.focus()} />{quantityError && <Text secondary>{quantityError}</Text>}
    <Text strong>{t.localListNote}</Text><FormInput draftSelection={{ owner: store, key: target, field: "noteText", readValue: () => store.entryFor(target)?.noteText ?? null }} ref={noteText} autoFocus={firstError === "noteText"} multiline textAlignVertical="top" accessibilityLabel={t.localListNote} accessibilityHint={noteError ?? saveActionHint?.().note ?? t.localListOnlyLocal} value={entry.noteText} onChangeText={value => store.setText(target, "noteText", value)} />{noteError && <Text secondary>{noteError}</Text>}
    {(nameError || quantityError || noteError) && <Notice kind="error" title={t.localListError} body={errorSummary} />}
    {state.nameChecked && entry.checked && !nameError && !quantityError && !noteError && <Notice title={t.localListChecked} body={t.localListOnlyLocal} />}
    {quantityAction?.(() => quantityText.current?.focus())}
    {saveAction?.(field => refs[field].current?.focus())}
    <Button label={t.localListCheck} onPress={check} /><Button label={t.localListOverview} onPress={onOverview} /><Button label={t.localListBack} onPress={onBack} />
    <Button label={t.localListCancelItem} onPress={() => { store.cancelEntry(target); onBack(); }} /><Button label={t.localListCancelAll} onPress={onCancelAll} />
  </ScrollView>;
}
export function LocalListOverview({ store, locale, onBack, onEdit, onCancelAll, createAction }: { store: LocalListDraft; locale: Locale; onBack: () => void; onEdit: (target: LocalListTarget) => void; onCancelAll: () => void; createAction?:ReactNode }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), t = copy[locale], name = useRef<FormInputHandle>(null), entries = Object.values(state.entries);
  if (!state.started) return <Unavailable locale={locale} onBack={onBack} />;
  const nameError = state.nameIssue ? listTextIssueText(state.nameIssue, locale) : null, errors = !!nameError || entries.some(entry => entry.quantityIssue || entry.noteIssue);
  return <FlatList data={entries} keyExtractor={entry => entry.target.offerId} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" ListHeaderComponent={<Stack>
    <Notice title={t.localListTitle} body={t.localListOnlyLocal} />{state.discarded && <Notice title={t.localListDiscarded} body={t.localListDiscardedBody} />}
    <Text strong>{t.localListName}</Text><FormInput draftSelection={{ owner: store, key: "list", field: "name", readValue: () => store.getSnapshot().started ? store.getSnapshot().name : null }} ref={name} accessibilityLabel={t.localListName} accessibilityHint={nameError ?? t.localListOnlyLocal} value={state.name} onChangeText={value => store.setName(value)} />{nameError && <Text secondary>{nameError}</Text>}
    <Text>{t.localListCount}: {entries.length}</Text>{errors && <Notice kind="error" title={t.localListError} body={t.localListErrorBody} />}
    {state.nameChecked && entries.every(entry => entry.checked) && !errors && <Notice title={t.localListChecked} body={t.localListOnlyLocal} />}
    {createAction}<Button label={t.localListCheck} onPress={() => { store.checkAll(); const checked = store.getSnapshot(); if (checked.nameIssue) name.current?.focus(); else { const first = Object.values(checked.entries).find(entry => entry.quantityIssue || entry.noteIssue); if (first) onEdit(first.target); } }} /><Button label={t.localListBack} onPress={onBack} /><Button label={t.localListCancelAll} onPress={onCancelAll} />
  </Stack>} ListEmptyComponent={<Notice title={t.localListEmpty} />} renderItem={({ item, index }) => <Surface>
    <Text>{t.savedListOfferId}: {item.target.offerId}</Text><Text>{t.quantity}: {item.quantityText || t.draftBlank}</Text><Text>{t.savedListNote}: {item.noteText || t.savedListNoteEmpty}</Text>
    {item.quantityIssue && <Text secondary>{quantityDraftIssueText(item.quantityIssue, locale)}</Text>}{item.noteIssue && <Text secondary>{listTextIssueText(item.noteIssue, locale)}</Text>}
    <Button label={t.localListEdit} accessibilityLabel={`${t.localListEdit}: ${t.cartItem} ${index + 1}`} onPress={() => onEdit(item.target)} />
  </Surface>} />;
}
const styles = StyleSheet.create({ form: { gap: theme.space.page, paddingBottom: theme.space.section } });
