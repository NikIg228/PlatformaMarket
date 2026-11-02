import { nativeReceiptCommandCopy } from "./ShipmentReceiptCommandUi";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ShipmentReceiptCommands } from "./shipment-receipt-command";
import { ReceiptCommandPanel, receiptCommandCopy, useReceiptCommandState } from "./ShipmentReceiptCommandUi";
import { DraftFormInput as FormInput } from "./DraftFormInput";
import { useRef, useSyncExternalStore } from "react";
import { ScrollView, StyleSheet } from "react-native";
import type { ShipmentResponse } from "../../../packages/schemas/src/core-api";
import type { ReceiptTarget, ShipmentReceiptDrafts } from "./shipment-receipt-draft";
import type { Locale } from "./format-wire";
import { Button, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
export const receiptDraftCopy = {
  ru: { title: "Черновик полученного количества", start: "Подготовить количество", resume: "Продолжить черновик количества", boundary: "Только локальная подготовка одной позиции. Приёмка не подтверждается, запрос не отправляется; товар, остатки, исполнение и комиссия не изменяются. Серверные права и все условия приёмки не проверены.", quantity: "Полученное количество в черновике (итог, не добавка)", baseline: "Уже получено по исходной записи", shipped: "Отправлено по исходной записи", line: "Позиция отгрузки", orderVersion: "Прочитанная версия заказа", shipmentVersion: "Прочитанная версия отгрузки", check: "Проверить количество локально", checked: "Формат и границы проверены локально", format: "Укажите неотрицательное число: до 12 цифр до разделителя и до 6 после него.", below: "Итог меньше уже полученного по исходной записи.", above: "Итог больше отправленного по исходной записи.", review: "Просмотреть черновик", reviewTitle: "Просмотр черновика количества", edit: "Вернуться к полю", back: "Вернуться к отгрузкам", discard: "Удалить только этот черновик", unavailable: "Исходная позиция для черновика недоступна", unavailableBody: "Версия, количество или состояние записи изменились либо сведений недостаточно. Вернитесь к отгрузкам и обновите их.", discarded: "Прежний черновик сброшен после изменения исходной позиции" },
  kk: { title: "Алынған мөлшер нобайы", start: "Мөлшерді дайындау", resume: "Мөлшер нобайын жалғастыру", boundary: "Тек бір позицияны жергілікті дайындау. Қабылдау расталмайды, сұрау жіберілмейді; тауар, қалдық, орындалу және комиссия өзгермейді. Серверлік құқықтар мен қабылдаудың барлық шарттары тексерілмеген.", quantity: "Нобайдағы алынған мөлшер (қосымша емес, қорытынды)", baseline: "Бастапқы жазба бойынша алынған", shipped: "Бастапқы жазба бойынша жөнелтілген", line: "Жөнелтім позициясы", orderVersion: "Оқылған тапсырыс нұсқасы", shipmentVersion: "Оқылған жөнелтім нұсқасы", check: "Мөлшерді жергілікті тексеру", checked: "Пішім мен шекаралар жергілікті тексерілді", format: "Теріс емес сан енгізіңіз: бөлгішке дейін 12, кейін 6 цифрға дейін.", below: "Қорытынды бастапқы жазбадағы алынған мөлшерден аз.", above: "Қорытынды бастапқы жазбадағы жөнелтілген мөлшерден көп.", review: "Нобайды қарау", reviewTitle: "Мөлшер нобайын қарау", edit: "Өріске оралу", back: "Жөнелтімдерге оралу", discard: "Тек осы нобайды жою", unavailable: "Нобайдың бастапқы позициясы қолжетімсіз", unavailableBody: "Жазбаның нұсқасы, мөлшері не күйі өзгерген немесе мәлімет жеткіліксіз. Жөнелтімдерге оралып, жаңартыңыз.", discarded: "Бастапқы позиция өзгергендіктен бұрынғы нобай тазартылды" },
} as const;
export function ReceiptDraftLauncher({ store, workflow, shipment, item, locale, onOpen }: { store: ShipmentReceiptDrafts; workflow: unknown; shipment: ShipmentResponse; item: ShipmentResponse["items"][number]; locale: Locale; onOpen: () => void }) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot); const entry = store.entryForLine(workflow, shipment, item), t = receiptDraftCopy[locale]; if (!entry) return null;
  return <Stack>{entry.discarded && <Text secondary>{t.discarded}</Text>}<Button label={entry.started ? t.resume : t.start} accessibilityLabel={`${entry.started ? t.resume : t.start}: ${shipment.shipmentNumber}, ${t.line} ${entry.target.lineNumber}`} onPress={onOpen} /></Stack>;
}
export function ShipmentReceiptDraftForm({ command, store, workflow, target, locale, onBack }: { command?: ShipmentReceiptCommands; store: ShipmentReceiptDrafts; workflow: unknown; target: ReceiptTarget; locale: Locale; onBack: () => void }) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot); const t = receiptDraftCopy[locale], input = useRef<FormInputHandle>(null), entry = store.entryForTarget(target);
  useReceiptCommandState(command); const locked=command?.isLocked(target.orderId)??false, activeCommand=command?.isAvailable()??false, body=activeCommand?(command?.runtime === "native-session" ? nativeReceiptCommandCopy : receiptCommandCopy)[locale].formBody:t.boundary;
  if (!entry?.started || !store.sourceMatches(workflow, target)) return <Stack><Notice title={t.unavailable} body={t.unavailableBody} action={<Button label={t.back} onPress={onBack} />} />{command&&<ReceiptCommandPanel command={command} orderId={target.orderId} locale={locale}/>}</Stack>;
  const check = () => { if (!locked && !store.check(target)) input.current?.focus(); }, review = () => { if (!locked && !store.review(target)) input.current?.focus(); };
  const error = entry.issue ? t[entry.issue.kind] : null;
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Notice title={entry.reviewing ? t.reviewTitle : t.title} body={body} /><Text strong>{target.shipmentNumber}</Text><Text>{t.line}: {target.lineNumber}</Text><Text>{t.orderVersion}: {target.orderVersion}</Text><Text>{t.shipmentVersion}: {target.shipmentVersion}</Text><Text>{t.baseline}: {target.deliveredQuantity}</Text><Text>{t.shipped}: {target.quantity}</Text>
    {entry.reviewing ? <><Text>{t.quantity}: {entry.text}</Text><Button disabled={locked} label={t.edit} onPress={() => store.edit(target)} /></> : <>
      <Text strong>{t.quantity}</Text><FormInput editable={!locked} draftSelection={{ owner: store, key: target, field: "quantity", readValue: () => Object.values(store.getSnapshot().entries).find(row => row.target === target && row.started && row.available)?.text ?? null }} ref={input} autoFocus accessibilityLabel={t.quantity} accessibilityHint={error ?? body} value={entry.text} onChangeText={text => {if(!locked)store.change(target, text);}} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={check} />
      {error && <Notice kind="error" title={error} />}{entry.checked && !entry.issue && <Notice title={t.checked} body={body} />}<Button disabled={locked} label={t.check} onPress={check} /><Button disabled={locked} label={t.review} onPress={review} />
    </>}
    {command&&<ReceiptCommandPanel command={command} orderId={target.orderId} workflow={workflow as OrderWorkflowResponse} target={target} locale={locale}/>}
    <Button label={t.back} onPress={onBack} /><Button disabled={locked} label={t.discard} onPress={() => { if (!locked && store.entryForTarget(target)) { store.cancel(target); onBack(); } }} />
  </ScrollView>;
}
const styles = StyleSheet.create({ body: { gap: theme.space.page, paddingBottom: theme.space.section } });
