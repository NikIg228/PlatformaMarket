"use client";
import { DmButton } from "@marketplace/ui/actions";
import { ErrorState } from "@marketplace/ui/primitives";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState title="Не удалось загрузить страницу" description="Сервис временно недоступен. Повторите загрузку после восстановления соединения." action={<DmButton onClick={reset}>Повторить загрузку</DmButton>} />;
}
