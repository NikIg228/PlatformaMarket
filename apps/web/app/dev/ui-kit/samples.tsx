"use client";

import { useRef, useState } from "react";
import { Option, Spinner } from "@fluentui/react-components";
import { DmButton, DmCheckbox, DmCombobox, DmField, DmInput, DmSelect, DmSurface, DmTextarea } from "@marketplace/ui/controls";
import { DmDialog, DmDropdown, DmFeedback, DmSearch } from "@marketplace/ui";
import styles from "./samples.module.css";

export function ComponentSamples() {
  const [value, setValue] = useState("one");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  const [open, setOpen] = useState(false);
  const dialogTrigger = useRef<HTMLButtonElement>(null);
  return <main className={styles.page}>
    <h1>Компоненты Market</h1>
    <p>Светлая тема · обычные действия 44px · компактные 32px</p>
    <DmSurface className={styles.stack}>
      <h2>Действия</h2>
      <div className={styles.row}>
        <DmButton appearance="primary">Основное действие</DmButton>
        <DmButton>Вторичное действие</DmButton>
        <DmButton appearance="subtle">Ненавязчивое действие</DmButton>
        <DmButton intent="danger">Удалить пример</DmButton>
        <DmButton disabled>Недоступно</DmButton>
        <DmButton disabled icon={<Spinner size="tiny" />}>Сохранение…</DmButton>
        <DmButton density="compact">Компактное</DmButton>
        <DmButton icon={<span aria-hidden>×</span>} aria-label="Закрыть пример" />
        <DmButton as="a" href="#fields">Перейти к полям</DmButton>
        <DmButton ref={dialogTrigger} onClick={() => setOpen(true)}>Открыть диалог</DmButton>
      </div>
    </DmSurface>
    <DmSurface variant="section" className={styles.stack} id="fields">
      <h2>Поля и формы</h2>
      <form className={styles.stack} onSubmit={e => { e.preventDefault(); setResult(String(new FormData(e.currentTarget).get("company"))); }}>
        <DmField label="Организация" required><DmInput name="company" required placeholder="Название организации" /></DmField>
        <DmField label="Поле с ошибкой" validationState="error" validationMessage="Укажите корректное значение"><DmInput defaultValue="Пример" /></DmField>
        <DmField label="Недоступное поле"><DmInput disabled value="Недоступно" /></DmField>
        <DmField label="Комментарий"><DmTextarea /></DmField>
        <DmField label="Нативная форма"><DmSelect name="native" required><option value="one">Первый вариант</option><option value="two">Второй вариант</option></DmSelect></DmField>
        <DmField label="Выпадающий список"><DmDropdown value={value} onChange={(_, data) => setValue(data.value)}><option value="one">Первый вариант</option><option value="two">Второй вариант</option></DmDropdown></DmField>
        <DmField label="Поиск варианта"><DmCombobox><Option>Алматы</Option><Option>Астана</Option></DmCombobox></DmField>
        <DmCheckbox label="Подтверждаю выбор" />
        <DmButton type="submit" appearance="primary">Проверить форму</DmButton>
        <output aria-label="Результат формы">{result}</output>
      </form>
    </DmSurface>
    <DmSurface variant="filters"><DmSearch aria-label="Поиск примеров" value={search} onChange={setSearch} onSearch={setResult} /><DmButton>Применить фильтры с длинным названием</DmButton></DmSurface>
    <DmFeedback tone="info" title="Нет результатов" description="Измените условия поиска." />
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => dialogTrigger.current?.focus()} title="Пример диалога"><p>Проверьте Tab, Escape и возврат фокуса.</p></DmDialog>
  </main>;
}
