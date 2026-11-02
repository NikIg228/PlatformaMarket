import { nativeCancellationCommandCopy } from "./OrderCancellationCommandUi";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { OrderCancellationCommands } from "./order-cancellation-command";
import { CancellationCommandPanel, useCancellationCommandState, cancellationCommandCopy } from "./OrderCancellationCommandUi";
import { DraftFormInput as FormInput } from "./DraftFormInput";
import { useRef, useSyncExternalStore, type ComponentRef } from "react";
import { ScrollView, StyleSheet, Switch } from "react-native";
import type { CancellationTarget, OrderCancellationDrafts, CancellationErrors } from "./order-cancellation-draft";
import type { Locale } from "./format-wire";
import { Button, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
export const cancellationCopy = {
  ru: { title: "Черновик причины отмены", start: "Подготовить причину отмены", resume: "Продолжить черновик причины", boundary: "Только локальный черновик. Заказ не отменяется, заявление не отправляется. Проверка полей не подтверждает право или возможность отмены: оплату, резервы и отгрузки проверяет сервер.", reason: "Причина отмены в черновике", declaration: "Подтверждаю, что не выполнял перевод по этому заказу (только в черновике)", check: "Проверить поля черновика", checked: "Поля проверены локально", errors: "Проверьте поля черновика", confirmError: "Подтверждение не отмечено. Без него локальная проверка не пройдена.", minimum: "Минимальная длина причины после проверки", maximum: "Максимальная длина причины", format: "Проверьте текст причины", review: "Просмотреть черновик", reviewTitle: "Просмотр локального черновика", edit: "Вернуться к полям", back: "Вернуться к заказу", discard: "Удалить только этот черновик", unavailable: "Исходное состояние заказа изменилось", unavailableBody: "Черновик недоступен для этой версии или состояния. Вернитесь к заказу и обновите данные.", discarded: "Прежний черновик удалён после изменения исходной записи", version: "Прочитанная версия заказа", declared: "Подтверждение отмечено только локально" },
  kk: { title: "Бас тарту себебінің нобайы", start: "Бас тарту себебін дайындау", resume: "Себеп нобайын жалғастыру", boundary: "Тек жергілікті нобай. Тапсырыс тоқтатылмайды, өтініш жіберілмейді. Өрістерді тексеру бас тарту құқығын не мүмкіндігін растамайды: төлемді, резервті және жөнелтімдерді сервер тексереді.", reason: "Нобайдағы бас тарту себебі", declaration: "Осы тапсырыс бойынша аударым жасамағанымды растаймын (тек нобайда)", check: "Нобай өрістерін тексеру", checked: "Өрістер жергілікті тексерілді", errors: "Нобай өрістерін тексеріңіз", confirmError: "Растау белгіленбеген. Онсыз жергілікті тексеру өтпейді.", minimum: "Тексеруден кейінгі себептің ең аз ұзындығы", maximum: "Себептің ең көп ұзындығы", format: "Себеп мәтінін тексеріңіз", review: "Нобайды қарау", reviewTitle: "Жергілікті нобайды қарау", edit: "Өрістерге оралу", back: "Тапсырысқа оралу", discard: "Тек осы нобайды жою", unavailable: "Тапсырыстың бастапқы күйі өзгерген", unavailableBody: "Бұл нұсқа не күй үшін нобай қолжетімсіз. Тапсырысқа оралып, деректерді жаңартыңыз.", discarded: "Бастапқы жазба өзгергендіктен бұрынғы нобай жойылды", version: "Оқылған тапсырыс нұсқасы", declared: "Растау тек жергілікті белгіленген" },
} as const;
function reasonError(error: CancellationErrors["reason"], locale: Locale): string | null { const t = cancellationCopy[locale]; return !error ? null : error.kind === "format" ? t.format : `${error.kind === "minimum" ? t.minimum : t.maximum}: ${error.count}`; }
export function OrderCancellationLauncher({ store, workflow, locale, onOpen }: { store: OrderCancellationDrafts; workflow: unknown; locale: Locale; onOpen: () => void }) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot); const entry = store.entryFor(workflow), t = cancellationCopy[locale];
  if (!entry?.available) return null;
  return <Stack>{entry.discarded && <Text secondary>{t.discarded}</Text>}<Button label={entry.started ? t.resume : t.start} onPress={onOpen} /></Stack>;
}
export function OrderCancellationDraftForm({ store, workflow, target, locale, onBack, command }: { command?: OrderCancellationCommands; store: OrderCancellationDrafts; workflow: unknown; target: CancellationTarget; locale: Locale; onBack: () => void }) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot); const t = cancellationCopy[locale], reason = useRef<FormInputHandle>(null), declaration = useRef<ComponentRef<typeof Switch>>(null), entry = store.entryForTarget(target);
  useCancellationCommandState(command);
  const boundary = command?.isAvailable() ? (command?.runtime === "native-session" ? nativeCancellationCommandCopy : cancellationCommandCopy)[locale].formBody : t.boundary;
  const locked = !!command?.isAvailable() && command.isLocked(target.orderId);
  const commandPanel = command && <CancellationCommandPanel command={command} orderId={target.orderId} workflow={workflow as OrderWorkflowResponse} target={target} locale={locale} />;
  if (!entry?.started || store.entryFor(workflow)?.target !== target) return <Stack><Notice title={t.unavailable} body={t.unavailableBody} action={<Button label={t.back} onPress={onBack} />} />{commandPanel}</Stack>;
  const focusError = () => { const errors = store.entryForTarget(target)?.errors; if (errors?.reason) reason.current?.focus(); else if (errors?.transferNotMade) declaration.current?.focus(); };
  const check = () => { store.check(target); focusError(); };
  const review = () => { if (!store.review(target)) focusError(); };
  const error = reasonError(entry.errors.reason, locale);
  const errorSummary = [error ? `${t.reason}: ${error}` : null, entry.errors.transferNotMade ? `${t.declaration}: ${t.confirmError}` : null].filter(Boolean).join(". ");
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Notice title={entry.reviewing ? t.reviewTitle : t.title} body={boundary} /><Text strong>{entry.target.orderNumber}</Text><Text>{t.version}: {entry.target.version}</Text>
    {entry.reviewing ? <><Text strong>{t.reason}</Text><Text>{entry.reason}</Text><Text>{t.declared}</Text><Button label={t.edit} disabled={locked} onPress={() => store.edit(target)} /></> : <>
      <Text strong>{t.reason}</Text><FormInput editable={!locked} draftSelection={{ owner: store, key: target, field: "reason", readValue: () => { const row = store.getSnapshot().entries[target.orderId]; return row?.target === target && row.started && row.available ? row.reason : null; } }} ref={reason} autoFocus accessibilityLabel={t.reason} accessibilityHint={error ?? boundary} value={entry.reason} onChangeText={text => store.setReason(target, text)} multiline textAlignVertical="top" style={{ minHeight: theme.height * 3 }} />
      {error && <Text secondary>{error}</Text>}<Text>{t.declaration}</Text><Switch disabled={locked} ref={declaration} accessibilityRole="switch" accessibilityLabel={t.declaration} accessibilityHint={entry.errors.transferNotMade ? t.confirmError : boundary} accessibilityState={{ checked: entry.transferNotMade, ...(locked ? { disabled: true } : {}) }} value={entry.transferNotMade} onValueChange={value => { store.setDeclaration(target, value); }} />
      {entry.errors.transferNotMade && <Text secondary>{t.confirmError}</Text>}{Object.keys(entry.errors).length > 0 && <Notice kind="error" title={t.errors} body={errorSummary} />}
      {entry.checked && !Object.keys(entry.errors).length && <Notice title={t.checked} body={boundary} />}
      <Button label={t.check} disabled={locked} onPress={check} /><Button label={t.review} disabled={locked} onPress={review} />
    </>}
    {commandPanel}
    <Button label={t.back} onPress={onBack} /><Button label={t.discard} disabled={locked} onPress={() => { if (store.entryForTarget(target)) { store.cancel(target); onBack(); } }} />
  </ScrollView>;
}
const styles = StyleSheet.create({ body: { gap: theme.space.page, paddingBottom: theme.space.section } });
