import { useRef, useSyncExternalStore } from "react";
import { StyleSheet } from "react-native";
import type { Locale } from "./format-wire";
import type { OrderConversationWindow } from "./order-conversation-read";
import type { OrderConversationDrafts } from "./order-conversation-draft";
import { DraftFormInput } from "./DraftFormInput";
import { Button, Notice, Stack, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
export const conversationDraftCopy = {
  ru: { start: "Написать черновик сообщения", resume: "Продолжить черновик сообщения", title: "Черновик сообщения", local: "Текст сохранён только на время этой сессии. Он не отправлен в переписку.", body: "Текст сообщения", check: "Проверить текст сообщения", done: "Свернуть черновик", discard: "Удалить черновик сообщения", error: "Проверьте сообщение", required: "Введите текст сообщения", "too-long": "Не более 10 000 символов после удаления пробелов по краям", format: "Не удалось проверить текст", checked: "Текст прошёл проверку. Сообщение не отправлено." },
  kk: { start: "Хабарлама нобайын жазу", resume: "Хабарлама нобайын жалғастыру", title: "Хабарлама нобайы", local: "Мәтін тек осы сессия уақытына сақталған. Ол хат алмасуға жіберілген жоқ.", body: "Хабарлама мәтіні", check: "Хабарлама мәтінін тексеру", done: "Нобайды жию", discard: "Хабарлама нобайын жою", error: "Хабарламаны тексеріңіз", required: "Хабарлама мәтінін енгізіңіз", "too-long": "Шеттеріндегі бос орындарды алып тастағаннан кейін 10 000 таңбадан аспайды", format: "Мәтінді тексеру мүмкін болмады", checked: "Мәтін тексерілді. Хабарлама жіберілген жоқ." },
} as const;
export function OrderConversationDraftUi({ model, window, locale, locked=false, onPrepare, prepareLabel }: { model: OrderConversationDrafts; window: OrderConversationWindow; locale: Locale; locked?:boolean;onPrepare?:()=>boolean;prepareLabel?:string }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const input = useRef<FormInputHandle>(null), row = model.entryFor(window), t = conversationDraftCopy[locale];
  if (!row || locked) return null;
  if (!row.started || row.phase !== "editing") return <Stack>{row.started && <Notice title={t.title} body={t.local}/>}<Button label={row.started ? t.resume : t.start} onPress={() => model.begin(window)}/></Stack>;
  const target = row.target, key = row.formKey, issue = row.issue ? t[row.issue] : undefined;
  return <Stack><Notice title={t.title} body={t.local}/><DraftFormInput ref={input} draftSelection={{ owner: model, key, field: "body", readValue: () => { const value = model.getSnapshot()[target.conversationId]; return value?.started && value.formKey === key ? value.rawBody : null; } }} accessibilityLabel={t.body} accessibilityHint={issue ?? t.local} multiline textAlignVertical="top" style={styles.input} value={row.rawBody} onChangeText={text => model.setText(target, text)}/>{issue && <Notice kind="error" title={t.error} body={issue}/>}{row.checked && !issue && <Notice title={t.checked}/>}<Button label={t.check} onPress={() => { if (!model.check(target)) input.current?.focus(); }}/>{onPrepare&&prepareLabel&&<Button label={prepareLabel} onPress={()=>{if(!onPrepare())input.current?.focus();}}/>}<Button label={t.done} onPress={() => model.pause(target)}/><Button label={t.discard} onPress={() => model.discard(target)}/></Stack>;
}
const styles = StyleSheet.create({ input: { minHeight: theme.height * 3 } });
