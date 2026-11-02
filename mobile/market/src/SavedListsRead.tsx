import type { ReactNode } from "react";
import { FlatList, StyleSheet } from "react-native";
import type { FixtureSavedList } from "./saved-lists-fixture-read";
import { formatTimestamp, type Locale } from "./format-wire";
import { copy } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";

export const nativeSavedListsBoundary={ru:"Изменения списков отправляются после отдельного просмотра и подтверждения. Доступ проверяет сервер.",kk:"Тізім өзгерістері бөлек қарау мен растаудан кейін жіберіледі. Қолжетімділікті сервер тексереді."} as const;

export function SavedListsRead({ lists, search, locale, onOpen, header, controls, nativeCommands=false }: { lists: readonly FixtureSavedList[]; search: string; locale: Locale; onOpen: (id: string) => void; header?:ReactNode; nativeCommands?:boolean; controls?:(list:FixtureSavedList)=>ReactNode }) {
  const t = copy[locale], text = search.toLocaleLowerCase(locale), shown = lists.filter(list => list.name.toLocaleLowerCase(locale).includes(text));
  return <FlatList data={shown} keyExtractor={list => list.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>{header}<Text secondary>{nativeCommands?nativeSavedListsBoundary[locale]:t.savedListsReadOnly}</Text><Text kind="caption" secondary>{t.savedListsLoaded}: {lists.length}</Text><Text secondary>{t.savedListsWindow}</Text></Stack>} ListEmptyComponent={<Notice title={lists.length ? t.savedListsNoMatch : t.savedListsEmpty} />} renderItem={({ item }) => <Surface>
    <Text kind="subtitle" strong>{item.name.trim() ? item.name : t.savedListNameUnknown}</Text><Text>{item.isDefault ? t.savedListDefault : t.savedListNotDefault}</Text>
    <Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text><Text>{t.savedListUpdated}: {formatTimestamp(item.updatedAt, locale) ?? t.dateUnknown}</Text>
    {controls?.(item)}<Button label={t.open} accessibilityLabel={`${t.open}: ${item.name.trim() ? item.name : t.savedListNameUnknown}`} onPress={() => onOpen(item.id)} />
  </Surface>} />;
}
export function SavedListItemsRead({ list, locale, onBack, header, controls, nativeCommands=false }: { list?: FixtureSavedList; locale: Locale; onBack: () => void; header?:ReactNode; nativeCommands?:boolean; controls?:(item:FixtureSavedList["items"][number])=>ReactNode }) {
  const t = copy[locale];
  if (!list) return <Stack>{header}<Notice title={t.savedListMissing} body={t.savedListMissingBody} action={<Button label={t.savedListsBack} onPress={onBack} />} /></Stack>;
  return <FlatList data={list.items} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>{header}<Text kind="subtitle" strong>{list.name.trim() ? list.name : t.savedListNameUnknown}</Text><Text>{list.isDefault ? t.savedListDefault : t.savedListNotDefault}</Text><Text secondary>{nativeCommands?nativeSavedListsBoundary[locale]:t.savedListsReadOnly}</Text><Text secondary>{t.savedListOfferBoundary}</Text><Text kind="caption" secondary>{t.savedListItemsShown}: {list.items.length}</Text><Button label={t.savedListsBack} onPress={onBack} /></Stack>} ListEmptyComponent={<Notice title={t.savedListItemsEmpty} />} renderItem={({ item }) => <Surface>
    <Text>{t.savedListOfferId}: {item.offerId}</Text><Text>{t.quantity}: {item.quantity}</Text>
    <Text>{t.savedListNote}: {item.note === null ? t.savedListNoteUnknown : item.note === "" ? t.savedListNoteEmpty : item.note}</Text>
    <Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text><Text>{t.savedListUpdated}: {formatTimestamp(item.updatedAt, locale) ?? t.dateUnknown}</Text>{controls?.(item)}
  </Surface>} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
