"use client";
import { ErrorState } from "@marketplace/ui/primitives";
import { DmButton } from "@marketplace/ui/actions";
export default function ErrorPage({ reset }: { reset: () => void }) { return <ErrorState presentation="page" title="Не удалось открыть страницу" description="Повторите попытку. Уже сохранённые данные не изменены." action={<DmButton onClick={reset}>Повторить</DmButton>} />; }
