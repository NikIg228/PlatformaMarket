import type { ReactElement } from "react";
import { FlatList, StyleSheet } from "react-native";
import type { OrderHistory } from "./order-history-read";
import { formatTimestamp, type Locale } from "./format-wire";
import { Notice, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const orderHistoryCopy = {
  ru: { title: "История действий", body: "Записи из полученных данных заказа, в порядке источника. История сама по себе не подтверждает оплату, получение товара или действительность подписи.", empty: "В полученных данных нет записей истории", unavailable: "Записи истории недоступны", unknown: "Действие не распознано", date: "Дата записи", dateUnknown: "Дата не определена" },
  kk: { title: "Әрекеттер тарихы", body: "Тапсырыстан алынған жазбалар бастапқы ретімен берілген. Тарихтың өзі төлемді, тауардың алынуын не қолтаңбаның жарамдылығын растамайды.", empty: "Алынған деректерде тарих жазбалары жоқ", unavailable: "Тарих жазбалары қолжетімсіз", unknown: "Әрекет танылмады", date: "Жазба күні", dateUnknown: "Күні анықталмаған" },
} as const;
const labels = {
  ACCEPT_COMPOSITION: { ru: "Согласование состава", kk: "Құрамды келісу" }, ISSUE_INVOICE: { ru: "Выставление счёта", kk: "Шот ұсыну" }, REPORT_TRANSFER: { ru: "Сообщение о переводе", kk: "Аударым туралы хабарлау" }, REQUEST_PAYMENT_DETAILS: { ru: "Запрос уточнения оплаты", kk: "Төлемді нақтылау сұрауы" }, CONFIRM_TRANSFER: { ru: "Подтверждение поступления", kk: "Түсімді растау" }, CANCEL: { ru: "Отмена неоплаченного заказа", kk: "Төленбеген тапсырысты тоқтату" }, RECORD_TRANSFER_CHECK: { ru: "Проверка перевода", kk: "Аударымды тексеру" }, OPEN_PAYMENT_DISPUTE: { ru: "Открытие спора по переводу", kk: "Аударым бойынша дауды ашу" }, PROPOSE_PAYMENT_REDUCTION: { ru: "Предложение уменьшения заказа", kk: "Тапсырысты азайту ұсынысы" }, DECIDE_PAYMENT_REDUCTION: { ru: "Рассмотрение уменьшения заказа", kk: "Тапсырысты азайтуды қарау" }, REQUEST_RETURN: { ru: "Запрос возврата", kk: "Қайтару сұрауы" }, DECIDE_RETURN: { ru: "Рассмотрение возврата", kk: "Қайтаруды қарау" }, SEND_RETURN_GOODS: { ru: "Отправка возвращаемого товара", kk: "Қайтарылатын тауарды жөнелту" }, RECEIVE_RETURN_GOODS: { ru: "Получение возвращённого товара", kk: "Қайтарылған тауарды алу" }, SEND_MANUAL_REFUND: { ru: "Сообщение об отправке возврата денег", kk: "Ақшаның қайтарылғаны туралы хабарлау" }, RECEIVE_MANUAL_REFUND: { ru: "Подтверждение получения возврата денег", kk: "Қайтарылған ақшаның алынуын растау" }, REORDER: { ru: "Повторная закупка", kk: "Қайта сатып алу" },
} as const;
export function orderHistoryActionLabel(action: string, locale: Locale): string { return Object.hasOwn(labels, action) ? labels[action as keyof typeof labels][locale] : orderHistoryCopy[locale].unknown; }
export function OrderHistoryRead({ history, locale, header }: { history: OrderHistory; locale: Locale; header: ReactElement }) {
  const t = orderHistoryCopy[locale];
  return <FlatList data={history.state === "ready" ? history.rows : []} keyExtractor={row => row.id} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={<Notice title={history.state === "ready" ? t.empty : t.unavailable} />} renderItem={({ item }) => <Surface><Text kind="subtitle" strong>{orderHistoryActionLabel(item.action, locale)}</Text><Text>{t.date}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text></Surface>} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
