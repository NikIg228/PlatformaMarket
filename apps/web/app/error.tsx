"use client";
import { ErrorState, DmButton } from "@marketplace/ui";
export default function ErrorPage({ reset }: { reset: () => void }) { return <ErrorState title="Не удалось открыть страницу" description="Повторите попытку. Уже сохранённые данные не изменены." action={<DmButton onClick={reset}>Повторить</DmButton>} />; }
