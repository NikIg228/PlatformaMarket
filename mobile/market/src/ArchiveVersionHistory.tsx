import { FlatList, StyleSheet } from "react-native";
import { documentArchiveItemSchema } from "../../../packages/schemas/src/core-api";
import type { ArchiveHistoryValue } from "./archive-version-history";
import { archiveCopy, archiveStatusLabel } from "./document-archive-i18n";
import { formatTimestamp, type Locale } from "./format-wire";
import { copy } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const archiveHistoryCopy = {
  ru: { title: "Версии документа", open: "Прочитать список версий", parentVersion: "Версия исходной карточки", count: "Версий в ответе", boundary: "Список получен отдельным чтением документа. Это метаданные версий, без проверки оригиналов, подписей и полноты архива.", empty: "В ответе список версий пуст", unknownStatus: "Неизвестный статус версии", current: "Запись исходной карточки", back: "Вернуться к карточке документа" },
  kk: { title: "Құжат нұсқалары", open: "Нұсқалар тізімін оқу", parentVersion: "Бастапқы карточка нұсқасы", count: "Жауаптағы нұсқалар", boundary: "Тізім құжатты бөлек оқу арқылы алынды. Бұл түпнұсқаларды, қолтаңбаларды және мұрағаттың толықтығын тексермейтін нұсқа метадеректері.", empty: "Жауаптағы нұсқалар тізімі бос", unknownStatus: "Нұсқаның белгісіз мәртебесі", current: "Бастапқы карточка жазбасы", back: "Құжат карточкасына оралу" },
} as const;
export function ArchiveHistoryLauncher({ locale, onOpen }: { locale: Locale; onOpen: () => void }) { return <Button label={archiveHistoryCopy[locale].open} onPress={onOpen} />; }
export function ArchiveVersionHistory({ value, locale, onBack }: { value: ArchiveHistoryValue; locale: Locale; onBack: () => void }) {
  const h = archiveHistoryCopy[locale], a = archiveCopy[locale], t = copy[locale];
  return <FlatList data={value.versions} keyExtractor={row => row.id} contentContainerStyle={styles.body} ListHeaderComponent={<Stack><Notice title={h.title} body={h.boundary} /><Text>{t.documentNumber}: {value.parent.documentNumber || a.unknown}</Text><Text>{h.parentVersion}: {value.parent.version}</Text><Text>{h.count}: {value.versions.length}</Text></Stack>} ListEmptyComponent={<Notice title={h.empty} />} renderItem={({ item }) => {
    const status = documentArchiveItemSchema.shape.status.safeParse(item.status);
    return <Surface><Text kind="subtitle">{t.documentVersion}: {item.version}</Text>{item.id === value.parent.id && <Text secondary>{h.current}</Text>}<Text>{a.status}: {status.success ? archiveStatusLabel(status.data, locale) : h.unknownStatus}</Text><Text>{a.date}: {formatTimestamp(item.documentDate, locale) ?? t.dateUnknown}</Text><Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text></Surface>;
  }} ListFooterComponent={<Button label={h.back} onPress={onBack} />} />;
}
const styles = StyleSheet.create({ body: { gap: theme.space.page, paddingBottom: theme.space.section } });
