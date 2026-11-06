"use client";
import { DmButton } from "@marketplace/ui/controls";
import { LoadingState } from "@marketplace/ui/loading-state";

import { useEffect, useState } from "react";
import { DmButton as Button } from "@marketplace/ui/controls";
import type { CurrentSession } from "@marketplace/schemas/workspace-session";
import { withWorkspaceReturn, workspaceReturnPath } from "@marketplace/schemas/product-navigation";
import { useBuyerSession } from "../../use-buyer-session";
import { loginUrl } from "../../public-links";
import styles from "./header.module.css";
import { catalogContext } from "./navigation";
import { resilientGet } from "../../resilient-get";
import { personalSessionStore, usePersonalSession } from "../../personal-session";
import { accountDestination } from "./account-destination";

export function HeaderAccount() {
  const buyer = useBuyerSession();
  const personal = usePersonalSession();
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [ready, setReady] = useState(false); const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [returnTo, setReturnTo] = useState("/catalog");
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
  useEffect(() => {
    const sync = () => setReturnTo(window.location.pathname + window.location.search);
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const currentUrl = new URL(returnTo, "http://local.invalid");
  const catalogQuery = new URL(catalogContext(currentUrl.pathname, currentUrl.search), "http://local.invalid").search;
  useEffect(() => {
    if (!buyer.ready) return;
    const controller = new AbortController(); setReady(false); setError("");
    void (async () => {
      const { currentSessionSchema } = await import("@marketplace/schemas/workspace-session");
      const response = await resilientGet(`${api}/auth/current`, { credentials: "include", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (!response.ok) throw Error();
      const raw: unknown = await response.json();
      const verified = raw === null ? null : currentSessionSchema.parse(raw);
      if (!controller.signal.aborted) setSession(verified);
    })().catch(() => { if (!controller.signal.aborted) setError("Проверка входа временно недоступна"); })
      .finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [api, buyer.ready, buyer.session?.organizationId, retry]);
  useEffect(() => {
    if (!error || !ready) return;
    const recover = () => setRetry(value => value + 1);
    const restore = (event: PageTransitionEvent) => { if (event.persisted) recover(); };
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", restore);
    return () => { window.removeEventListener("online", recover); window.removeEventListener("pageshow", restore); };
  }, [error, ready]);
  const destination = accountDestination({ ready: buyer.ready && ready, error: Boolean(error), session,
    personalReady: personal.ready, personalError: Boolean(personal.error), personalUser: personal.session?.user ?? null });
  if (destination.kind === "loading") return <span className={styles.authLoading}><LoadingState presentation="inline" label={currentUrl.searchParams.get("lang") === "kk" ? "Кабинет жүктелуде…" : "Загружаем кабинет…"} /></span>;
  if (destination.kind === "error") return <Button onClick={() => { setRetry(v => v + 1); void personalSessionStore.retry(); }}>Проверка входа временно недоступна. Повторить</Button>;
  if (destination.kind === "personal") return <a className={styles.accountLink} href="/personal/cart" aria-label={`${destination.name} · Личный кабинет`}>
    <span className={styles.organization}>{destination.name}</span>
  </a>;
  if (destination.kind === "guest") return <DmButton as="a" appearance="primary" className={styles.login} href={withWorkspaceReturn(loginUrl, returnTo)} onClick={e => { e.preventDefault(); window.location.assign(withWorkspaceReturn(loginUrl, window.location.pathname + window.location.search)); }}>Войти</DmButton>;
  if (destination.kind === "choice") return <a className={styles.accountLink} href={loginUrl} aria-label={`${destination.name} · Выбрать кабинет`}><span className={styles.organization}>{destination.name}</span></a>;
  if (destination.kind !== "workspace") return null;
  const organizationName = destination.name;
  const capability = destination.capability;
  const workspaceReturn = capability === "BUYER" ? workspaceReturnPath("/clinic" + catalogQuery, "BUYER") ?? "/clinic" : "/supplier";
  return <div style={{ display: "flex", gap: "var(--dm-space-3)", alignItems: "center", minWidth: 0 }}><a className={styles.accountLink} href={withWorkspaceReturn(loginUrl, workspaceReturn)} aria-label={`${organizationName} · ${capability === "BUYER" ? "Клиника" : "Поставщик"} · Личный кабинет`}>
    <span className={styles.organization} title={organizationName}>{organizationName}</span>
  </a></div>;
}
