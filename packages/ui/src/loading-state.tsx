"use client";
import { Spinner } from "@fluentui/react-components";

export function LoadingState({
  label,
  presentation = "block",
}: {
  label: string;
  presentation?: "block" | "inline";
}) {
  if (presentation === "inline") return <Spinner as="span" size="tiny" role="status" aria-live="polite" label={label} />;
  return <div className="mp-state"><Spinner size="medium" role="status" aria-live="polite" label={label} /></div>;
}

export function cabinetLoadingLabel(locale?: string | null) {
  return locale === "kk" ? "Кабинет жүктелуде…" : "Загружаем кабинет…";
}
