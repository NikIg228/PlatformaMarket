import { withoutTestLabel } from "./native-command-copy";
import type { SupportReplyCommands } from "./support-reply-command-fixture";
import type { ReplyDraftTarget } from "./support-reply-draft";
import { formatTimestamp } from "./format-wire";
import { copy } from "./i18n";
import { useSyncExternalStore } from "react";
import type { SupportCreateCommand } from "./support-command-fixture";
import type { Locale } from "./format-wire";
import { supportStatusLabel } from "./i18n";
import { Button, Loading, Notice, Stack, Text } from "./ui/controls";
export const supportCommandCopy = {
  ru: { reply: "Отправить публичный ответ (тест)", replyCreated: "Получен результат тестового ответа", replyAttempt: "Текст этой попытки", replyInvalidBody: "Не считайте сообщение отправленным. Повтор сохранит исходную попытку.", replyDone: "Завершить тестовую попытку ответа", boundary: "Тестовый сценарий отправки", boundaryBody: "Синтетический результат. Отправка на сервер отключена.", create: "Создать обращение (тест)", pending: "Ожидаем результат тестового запроса", unknown: "Результат запроса неизвестен", unknownBody: "Успех не подтверждён. Повтор использует ту же попытку и неизменный запрос.", invalid: "Результат не подтверждён контрактом", invalidBody: "Не считайте обращение созданным. Повтор сохранит исходную попытку.", rejected: "Запрос отклонён", rejectedBody: "Ввод сохранён. Исправьте поля или повторите ту же попытку, если запрос не менялся.", retry: "Повторить ту же попытку", created: "Получен результат тестового создания", newDraft: "Начать новый черновик", number: "Номер обращения", subject: "Тема обращения" },
  kk: { reply: "Жария жауап жіберу (тест)", replyCreated: "Тест жауабының нәтижесі алынды", replyAttempt: "Осы әрекеттің мәтіні", replyInvalidBody: "Хабарлама жіберілді деп есептемеңіз. Қайталау бастапқы әрекетті сақтайды.", replyDone: "Жауаптың тест әрекетін аяқтау", boundary: "Жіберудің тест сценарийі", boundaryBody: "Синтетикалық нәтиже. Серверге жіберу өшірілген.", create: "Өтініш жасау (тест)", pending: "Тест сұрауының нәтижесін күтеміз", unknown: "Сұрау нәтижесі белгісіз", unknownBody: "Сәттілік расталмаған. Қайталау сол әрекет пен өзгермеген сұрауды қолданады.", invalid: "Нәтиже келісімшартпен расталмаған", invalidBody: "Өтініш жасалды деп есептемеңіз. Қайталау бастапқы әрекетті сақтайды.", rejected: "Сұрау қабылданбады", rejectedBody: "Енгізілген мәтін сақталды. Өрістерді түзетіңіз немесе сұрау өзгермесе, сол әрекетті қайталаңыз.", retry: "Сол әрекетті қайталау", created: "Тест өтінішін жасау нәтижесі алынды", newDraft: "Жаңа нобай бастау", number: "Өтініш нөмірі", subject: "Өтініш тақырыбы" },
} as const;
export const nativeSupportCommandCopy = {
ru: { ...withoutTestLabel(supportCommandCopy.ru), replyCreated: "Получен ответ на отправку сообщения", replyDone: "Завершить отправку ответа", boundary: "Отправка в поддержку", boundaryBody: "Проверьте текст перед отправкой. При неизвестном результате можно явно повторить исходную попытку с тем же ключом.", pending: "Ожидаем ответ сервера", created: "Получен ответ на создание обращения" },
kk: { ...withoutTestLabel(supportCommandCopy.kk), replyCreated: "Хабарлама жіберуге жауап алынды", replyDone: "Жауап жіберуді аяқтау", boundary: "Қолдауға жіберу", boundaryBody: "Жіберу алдында мәтінді тексеріңіз. Нәтиже белгісіз болса, бастапқы әрекетті сол кілтпен анық қайталауға болады.", pending: "Сервер жауабын күтеміз", created: "Өтініш жасауға жауап алынды" }
} as const;
const idle = Object.freeze({ phase: "idle" as const });
const noSubscribe = () => () => {};
const getIdle = () => idle;
export function useSupportCreateState(command?: SupportCreateCommand) { return useSyncExternalStore(command?.subscribe ?? noSubscribe, command?.getSnapshot ?? getIdle, command?.getSnapshot ?? getIdle); }
export function SupportCreateCommandPanel({ command, locale, onInvalid }: { command: SupportCreateCommand; locale: Locale; onInvalid: () => void }) {
  const state = useSupportCreateState(command), t = (command.runtime === "native-session" ? nativeSupportCommandCopy : supportCommandCopy)[locale];
  if (!command.isAvailable()) return null;
  return <Stack><Notice title={t.boundary} body={t.boundaryBody} />
    {state.phase === "pending" && <Loading label={t.pending} />}
    {state.phase === "unknown" && <Notice kind="error" title={t.unknown} body={t.unknownBody} />}
    {state.phase === "invalid-result" && <Notice kind="error" title={t.invalid} body={t.invalidBody} />}
    {state.phase === "rejected" && <Notice kind="error" title={t.rejected} body={t.rejectedBody} />}
    {state.phase === "success" ? <><Notice title={t.created} /><Text>{t.number}: {state.value.number}</Text><Text>{t.subject}: {state.value.subject}</Text><Text>{supportStatusLabel(state.value.status, locale)}</Text><Button label={t.newDraft} onPress={command.startNew} /></> : <>
      {!command.isLocked() && <Button label={t.create} onPress={() => { onInvalid(); void command.submit(); }} />}
      {command.canRetry() && <Button label={t.retry} onPress={() => { void command.retry(); }} />}
    </>}
  </Stack>;
}

const noReplies = Object.freeze({});
const getNoReplies = () => noReplies;
export function useSupportReplyState(command?: SupportReplyCommands) { return useSyncExternalStore(command?.subscribe ?? noSubscribe, command?.getSnapshot ?? getNoReplies, command?.getSnapshot ?? getNoReplies); }
export function SupportReplyCommandPanel({ command, target, locale, onInvalid, onBack }: { command: SupportReplyCommands; target: ReplyDraftTarget; locale: Locale; onInvalid: () => void; onBack: () => void }) {
  useSupportReplyState(command); const state = command.stateFor(target), t = (command.runtime === "native-session" ? nativeSupportCommandCopy : supportCommandCopy)[locale], attempt = command.previewFor(target);
  if (!command.isAvailable()) return null;
  return <Stack><Notice title={t.boundary} body={t.boundaryBody} />
    {attempt !== null && state.phase !== "success" && <><Text strong>{t.replyAttempt}</Text><Text>{attempt}</Text></>}
    {state.phase === "pending" && <Loading label={t.pending} />}
    {state.phase === "unknown" && <Notice kind="error" title={t.unknown} body={t.unknownBody} />}
    {state.phase === "invalid-result" && <Notice kind="error" title={t.invalid} body={t.replyInvalidBody} />}
    {state.phase === "rejected" && <Notice kind="error" title={t.rejected} body={t.rejectedBody} />}
    {state.phase === "success" ? <><Notice title={t.replyCreated} /><Text>{state.value.body}</Text><Text>{formatTimestamp(state.value.createdAt, locale) ?? copy[locale].dateUnknown}</Text><Button label={t.replyDone} onPress={() => { command.complete(target); onBack(); }} /></> : <>
      {command.canSubmit(target) && <Button label={t.reply} onPress={() => { onInvalid(); void command.submit(target); }} />}
      {command.canRetry(target) && <Button label={t.retry} onPress={() => { void command.retry(target); }} />}
    </>}
  </Stack>;
}
