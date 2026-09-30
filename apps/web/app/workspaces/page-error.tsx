"use client";
import { DmButton, ErrorState } from "@marketplace/ui";
export default function PageError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Не удалось открыть раздел"
      description="Повторите загрузку или выберите другой раздел кабинета. Сохранённые данные не изменены."
      action={<DmButton onClick={reset}>Повторить загрузку</DmButton>}
    />
  );
}
