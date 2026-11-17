"use client";
import { useEffect } from "react";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./primitives";
import { DmButton } from "./controls";

export function sessionLoginUrl(loginUrl: string, returnTo: string, locale: string, personal = false) {
  const url = new URL(loginUrl, window.location.origin);
  url.searchParams.set("signedOut", "1");
  if (returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")) url.searchParams.set("returnTo", returnTo);
  if (locale === "kk") url.searchParams.set("lang", "kk");
  if (personal) url.searchParams.set("personal", "1");
  return url.href;
}

/** Render only at a protected boundary; public catalogue sessions never navigate. */
export function SessionRequired({ error, termination, retry, loginUrl = "/login", locale = "ru", personal = false, returnTo }: {
  error: string | null; termination?: "expired" | "access-denied" | "identity-changed";
  retry: () => void; loginUrl?: string; locale?: string; personal?: boolean; returnTo?: string;
}) {
  const redirecting = termination === "expired" || termination === "identity-changed" || (!termination && !error);
  useEffect(() => {
    if (redirecting) window.location.replace(sessionLoginUrl(loginUrl, returnTo ?? window.location.pathname + window.location.search, locale, personal));
  }, [redirecting, loginUrl, locale, personal, returnTo]);
  const kk = locale === "kk";
  if (redirecting) return <LoadingState label={kk ? "Кіру бетіне өтудеміз…" : "Переходим ко входу…"} />;
  const denied = termination === "access-denied";
  return <ErrorState presentation="page" title={denied ? (kk ? "Кабинетке кіру мүмкін емес" : "Нет доступа к кабинету") : (kk ? "Кіруді тексеру мүмкін болмады" : "Не удалось проверить вход")}
    description={denied ? (kk ? "Басқа ұйымды таңдаңыз немесе ұйым әкімшісіне хабарласыңыз." : "Выберите другую организацию или обратитесь к администратору организации.") : (kk ? "Байланысты тексеріп, қайталаңыз. Сеанс жойылған жоқ." : "Проверьте соединение и повторите проверку. Сохранённый вход не удалён.")}
    action={<><DmButton onClick={retry}>{kk ? "Қайталау" : "Повторить проверку"}</DmButton>{denied ? <DmButton as="a" href={loginUrl}>{kk ? "Ұйымды таңдау" : "Выбрать организацию"}</DmButton> : null}</>} />;
}
