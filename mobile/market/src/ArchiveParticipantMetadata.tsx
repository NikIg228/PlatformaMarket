import { FlatList, StyleSheet } from "react-native";
import type { ArchiveParticipantMetadata as Participant, ArchiveParticipantValue } from "./archive-participant-metadata";
import { archiveCopy } from "./document-archive-i18n";
import { type Locale } from "./format-wire";
import { copy } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const archiveParticipantCopy = {
  ru: { title: "Участники документа по записи", open: "Прочитать участников документа", count: "Участников в ответе", parentVersion: "Версия исходной карточки", role: "Роль по записи", unknownName: "Название организации не передано", empty: "В ответе участников нет", back: "Вернуться к карточке документа", boundary: "Показаны организации и роли из записи документа. Они не подтверждают полномочия, личность подписанта, право подписи или доступ к другим документам. Названия организаций сохранены как переданы источником." },
  kk: { title: "Жазбадағы құжат қатысушылары", open: "Құжат қатысушыларын оқу", count: "Жауаптағы қатысушылар", parentVersion: "Бастапқы карточка нұсқасы", role: "Жазбадағы рөл", unknownName: "Ұйым атауы берілмеген", empty: "Жауапта қатысушылар жоқ", back: "Құжат карточкасына оралу", boundary: "Құжат жазбасындағы ұйымдар мен рөлдер көрсетілген. Олар өкілеттікті, қол қоюшының тұлғасын, қол қою құқығын немесе басқа құжаттарға қолжетімділікті растамайды. Ұйым атаулары дереккөз берген күйінде сақталған." },
} as const;
const roles = { OWNER: ["Владелец", "Иесі"], ISSUER: ["Издатель", "Шығарушы"], RECIPIENT: ["Получатель", "Алушы"], SIGNER: ["Подписант", "Қол қоюшы"], PLATFORM: ["Площадка", "Алаң"] } satisfies Record<Participant["role"], readonly [string, string]>;
export const archiveParticipantRoleLabel = (role: Participant["role"], locale: Locale) => roles[role][locale === "kk" ? 1 : 0];
export function ArchiveParticipantLauncher({ locale, onOpen }: { locale: Locale; onOpen: () => void }) { return <Button label={archiveParticipantCopy[locale].open} onPress={onOpen} />; }
export function ArchiveParticipantMetadata({ value, locale, onBack }: { value: ArchiveParticipantValue; locale: Locale; onBack: () => void }) {
  const p = archiveParticipantCopy[locale], a = archiveCopy[locale], t = copy[locale];
  return <FlatList data={value.participants} keyExtractor={(row, index) => `${row.organizationId}:${row.role}:${index}`} contentContainerStyle={styles.body} ListHeaderComponent={<Stack><Notice title={p.title} body={p.boundary} /><Text>{t.documentNumber}: {value.parent.documentNumber || a.unknown}</Text><Text>{p.parentVersion}: {value.parent.version}</Text><Text>{p.count}: {value.participants.length}</Text></Stack>} ListEmptyComponent={<Notice title={p.empty} />} renderItem={({ item }) => <Surface><Text kind="subtitle">{item.displayName.trim() ? item.displayName : p.unknownName}</Text><Text>{p.role}: {archiveParticipantRoleLabel(item.role, locale)}</Text></Surface>} ListFooterComponent={<Button label={p.back} onPress={onBack} />} />;
}
const styles = StyleSheet.create({ body: { gap: theme.space.page, paddingBottom: theme.space.section } });
