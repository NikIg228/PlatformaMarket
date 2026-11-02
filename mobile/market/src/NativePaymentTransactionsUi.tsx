import { useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import type { NativePaymentTransaction, NativePaymentTransactions } from "./native-payment-transactions";
import { formatTimestamp, type Locale } from "./format-wire";
import { copy } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";

export const paymentTransactionsCopy = {
  ru: { open: "Серверные операции", title: "Записи платёжных операций", boundary: "Это записи в полученном ответе сервера. Они не подтверждают банковское списание, зачисление или расчёты с поставщиком.", loading: "Читаем записи платёжных операций", refresh: "Обновить записи операций", back: "Назад к платёжному намерению", empty: "В полученном ответе нет записей операций", page: "Страница полученных записей", next: "Следующие записи операций", previous: "Предыдущие записи операций", type: "Тип операции", status: "Статус записи", amount: "Сумма в минимальных единицах", currency: "Валюта записи", processed: "Время обработки в записи", unprocessed: "Не указано", types: { AUTHORIZATION: "Авторизация", CAPTURE: "Списание", VOID: "Отмена авторизации", REFUND: "Возврат", PAYOUT: "Выплата", CHARGEBACK: "Оспаривание платежа", REVERSAL: "Обратная операция" }, statuses: { PENDING: "Ожидает", PROCESSING: "Обрабатывается", SUCCEEDED: "Успешно", FAILED: "Ошибка", CANCELLED: "Отменено" } },
  kk: { open: "Сервердегі операциялар", title: "Төлем операцияларының жазбалары", boundary: "Бұл — серверден алынған жауаптағы жазбалар. Олар банктегі есептен шығаруды, есепке алуды немесе жеткізушімен есеп айырысуды растамайды.", loading: "Төлем операцияларының жазбалары оқылуда", refresh: "Операция жазбаларын жаңарту", back: "Төлем ниетіне оралу", empty: "Алынған жауапта операция жазбалары жоқ", page: "Алынған жазбалар беті", next: "Келесі операция жазбалары", previous: "Алдыңғы операция жазбалары", type: "Операция түрі", status: "Жазба мәртебесі", amount: "Ең кіші бірліктердегі сома", currency: "Жазба валютасы", processed: "Жазбадағы өңдеу уақыты", unprocessed: "Көрсетілмеген", types: { AUTHORIZATION: "Авторизация", CAPTURE: "Есептен шығару", VOID: "Авторизацияны жою", REFUND: "Қайтару", PAYOUT: "Төлем жасау", CHARGEBACK: "Төлемді дауластыру", REVERSAL: "Кері операция" }, statuses: { PENDING: "Күтуде", PROCESSING: "Өңделуде", SUCCEEDED: "Сәтті", FAILED: "Қате", CANCELLED: "Бас тартылды" } },
} as const;

export function NativePaymentTransactionsUi({ value, locale, onBack }: { value: NativePaymentTransactions; locale: Locale; onBack: () => void }) {
  const c = paymentTransactionsCopy[locale], t = copy[locale];
  const [position, setPosition] = useState({ source: value, page: 0 }), page = position.source === value ? position.page : 0;
  const pages = Math.max(1, Math.ceil(value.rows.length / 20)), rows = value.rows.slice(page * 20, page * 20 + 20);
  const row = ({ item }: { item: NativePaymentTransaction }) => <Surface>
    <Text strong>{c.type}: {c.types[item.type]}</Text><Text>{c.status}: {c.statuses[item.status]}</Text>
    <Text>{c.amount}: {item.amountMinor}</Text><Text>{c.currency}: {item.currency}</Text>
    <Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text>
    <Text>{t.recordUpdated}: {formatTimestamp(item.updatedAt, locale) ?? t.dateUnknown}</Text>
    <Text>{c.processed}: {item.processedAt === null ? c.unprocessed : formatTimestamp(item.processedAt, locale) ?? t.dateUnknown}</Text>
  </Surface>;
  return <FlatList style={styles.list} contentContainerStyle={styles.body} data={rows} keyExtractor={item => item.id} renderItem={row}
    ListHeaderComponent={<Stack><Notice title={c.title} body={c.boundary} />{value.intent.provider.code === "MOCK" && <Notice title={t.intentMock} body={t.intentMockBody} />}</Stack>}
    ListEmptyComponent={<Notice title={c.empty} />}
    ListFooterComponent={<Stack><Text>{c.page}: {page + 1} / {pages}</Text><Stack row>
      <Button label={c.previous} disabled={page === 0} onPress={() => setPosition({ source: value, page: Math.max(0, page - 1) })} />
      <Button label={c.next} disabled={page + 1 >= pages} onPress={() => setPosition({ source: value, page: Math.min(pages - 1, page + 1) })} />
    </Stack><Button label={c.back} onPress={onBack} /></Stack>} />;
}
const styles = StyleSheet.create({ list: { flex: 1 }, body: { gap: theme.space.page, paddingBottom: theme.space.section } });
