import { FlatList, StyleSheet } from "react-native";
import type { ArchiveSignatureMetadata as Signature, ArchiveSignatureValue } from "./archive-signature-metadata";
import { archiveCopy } from "./document-archive-i18n";
import { formatTimestamp, type Locale } from "./format-wire";
import { copy } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const archiveSignatureCopy = {
  ru: { title: "Записи подписей документа", open: "Прочитать записи подписей", parentVersion: "Версия исходной карточки", count: "Записей в ответе", row: "Запись подписи", method: "Метод по записи", status: "Статус по записи", signedAt: "Время подписи по записи", empty: "В ответе записей подписей нет", back: "Вернуться к карточке документа", boundary: "Это текущие метаданные записей, а не проверка ЭЦП, сертификата, отзыва, полномочий подписанта или история проверок. Личность и стороны подписи здесь не подтверждаются." },
  kk: { title: "Құжат қолтаңбаларының жазбалары", open: "Қолтаңба жазбаларын оқу", parentVersion: "Бастапқы карточка нұсқасы", count: "Жауаптағы жазбалар", row: "Қолтаңба жазбасы", method: "Жазбадағы әдіс", status: "Жазбадағы мәртебе", signedAt: "Жазбадағы қолтаңба уақыты", empty: "Жауапта қолтаңба жазбалары жоқ", back: "Құжат карточкасына оралу", boundary: "Бұл ЭЦҚ, сертификат, кері қайтару, қол қоюшының өкілеттігі немесе тексеру тарихы емес, жазбалардың ағымдағы метадеректері. Мұнда қол қоюшының тұлғасы мен қолтаңба тараптары расталмайды." },
} as const;
const methods = { EDS: ["ЭЦП по записи", "Жазбадағы ЭЦҚ"], EGOV_QR: ["eGov QR по записи", "Жазбадағы eGov QR"], SIMPLE: ["Простая подпись по записи", "Жазбадағы қарапайым қолтаңба"], EXTERNAL: ["Внешний метод по записи", "Жазбадағы сыртқы әдіс"], MOCK: ["Тестовый метод (MOCK)", "Тестілік әдіс (MOCK)"] } satisfies Record<Signature["method"], readonly [string, string]>;
const statuses = { PENDING: ["Ожидается", "Күтілуде"], SESSION_CREATED: ["Сессия создана по записи", "Жазба бойынша сессия құрылған"], SIGNED: ["Подписано по записи", "Жазба бойынша қол қойылған"], REJECTED: ["Отклонено по записи", "Жазба бойынша қабылданбаған"], EXPIRED: ["Срок истёк по записи", "Жазба бойынша мерзімі өткен"], FAILED: ["Ошибка по записи", "Жазбадағы қате"] } satisfies Record<Signature["status"], readonly [string, string]>;
export const archiveSignatureMethodLabel = (method: Signature["method"], locale: Locale) => methods[method][locale === "kk" ? 1 : 0];
export const archiveSignatureStatusLabel = (status: Signature["status"], locale: Locale) => statuses[status][locale === "kk" ? 1 : 0];
export function ArchiveSignatureLauncher({ locale, onOpen }: { locale: Locale; onOpen: () => void }) { return <Button label={archiveSignatureCopy[locale].open} onPress={onOpen} />; }
export function ArchiveSignatureMetadata({ value, locale, onBack }: { value: ArchiveSignatureValue; locale: Locale; onBack: () => void }) {
  const s = archiveSignatureCopy[locale], a = archiveCopy[locale], t = copy[locale];
  return <FlatList data={value.signatures} keyExtractor={row => row.id} contentContainerStyle={styles.body} ListHeaderComponent={<Stack><Notice title={s.title} body={s.boundary} /><Text>{t.documentNumber}: {value.parent.documentNumber || a.unknown}</Text><Text>{s.parentVersion}: {value.parent.version}</Text><Text>{s.count}: {value.signatures.length}</Text></Stack>} ListEmptyComponent={<Notice title={s.empty} />} renderItem={({ item, index }) => <Surface><Text kind="subtitle">{s.row} {index + 1}</Text><Text>{s.method}: {archiveSignatureMethodLabel(item.method, locale)}</Text><Text>{s.status}: {archiveSignatureStatusLabel(item.status, locale)}</Text><Text>{s.signedAt}: {formatTimestamp(item.signedAt, locale) ?? t.dateUnknown}</Text></Surface>} ListFooterComponent={<Button label={s.back} onPress={onBack} />} />;
}
const styles = StyleSheet.create({ body: { gap: theme.space.page, paddingBottom: theme.space.section } });
