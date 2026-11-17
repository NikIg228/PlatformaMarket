"use client";
import { useRef, useState } from "react";
import { ActionFeedback, DmButton, DmDialog, DmFeedback, DmField, DmInput, DmSurface, ErrorState, useToast, type ToastTone } from "@marketplace/ui";
import styles from "./samples.module.css";

function DialogNotification() {
  const notify = useToast();
  return <DmButton onClick={() => notify("Изменения сохранены внутри диалога.", { title: "Готово" })}>Уведомление в диалоге</DmButton>;
}

export function FeedbackSamples() {
  const notify = useToast(), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [draft, setDraft] = useState("Мой черновик"), [failed, setFailed] = useState(false);
  return <DmSurface className={styles.stack}>
    <h2>Карточки уведомлений</h2>
    <div className={styles.row}>{(["success", "warning", "error", "info"] as ToastTone[]).map(tone =>
      <DmButton key={tone} onClick={() => notify("Пояснение результата действия.", { tone, title: `Пример: ${tone}` })}>Показать {tone}</DmButton>)}</div>
    <DmFeedback presentation="inline" tone="warning" title="Проверьте данные" description="Постоянное уведомление остаётся рядом с содержимым." />
    <DmFeedback presentation="note" tone="info" title="Информация" description="Пояснение остаётся у содержимого без цветной полосы." />
    <ErrorState presentation="page" title="Не удалось загрузить раздел" description="Проверьте соединение и повторите загрузку. Ваш ввод сохранён." action={<><DmButton onClick={() => notify("Загрузка завершена.")}>Повторить загрузку</DmButton><DmButton onClick={() => notify("Проверка завершена.")}>Проверить соединение</DmButton></>} />
    <DmField label="Черновик уведомления"><DmInput value={draft} onChange={(_, data) => setDraft(data.value)} /></DmField>
    <DmButton onClick={() => setFailed(true)}>Проверить восстановление</DmButton>
    {failed ? <ActionFeedback tone="error" title="Действие не завершено" description="Черновик сохранён. Попробуйте ещё раз."
      action={<DmButton onClick={() => { setFailed(false); notify("Черновик сохранён."); }}>Повторить действие</DmButton>} /> : null}
    <DmButton ref={trigger} onClick={() => setOpen(true)}>Диалог уведомлений</DmButton>
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => trigger.current?.focus()} title="Проверка уведомления"><DialogNotification /></DmDialog>
  </DmSurface>;
}
