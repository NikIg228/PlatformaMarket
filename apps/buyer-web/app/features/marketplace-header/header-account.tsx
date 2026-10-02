"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import type { CurrentSession } from "@marketplace/schemas/workspace-session";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
import { useBuyerSession } from "../../use-buyer-session";
import { loginUrl, supplierAppUrl } from "../../public-links";
import styles from "./header.module.css";
import { workspacePath } from "@marketplace/api-client/frontend-routes";
import { catalogContext } from "./navigation";
import { resilientGet } from "../../resilient-get";
const HeaderMessages = dynamic(() => import("./header-messages"));

export function HeaderAccount() {
  const buyer = useBuyerSession();
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
  const current = session?.workspaces.find(w => w.organizationId === session.activeOrganizationId);
  const organizationName = buyer.session?.organizationDisplayName ?? current?.organizationDisplayName;
  const capability = buyer.session ? "BUYER" : current?.capabilities.includes("SUPPLIER") ? "SUPPLIER" : "BUYER";
  if (!buyer.ready || !ready) return <span className={styles.authLoading} role="status" aria-label="Проверяем вход">Личный кабинет…</span>;
  if (!organizationName) return error ? <Button onClick={() => setRetry(v => v + 1)}>{error}. Повторить</Button> : <a className={styles.login} href={withWorkspaceReturn(loginUrl, returnTo)} onClick={e => { e.preventDefault(); window.location.assign(withWorkspaceReturn(loginUrl, window.location.pathname + window.location.search)); }}>Войти</a>;
  return <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>{buyer.session ? <HeaderMessages /> : null}<a className={styles.accountLink} href={capability === "BUYER" ? workspacePath("BUYER") + catalogQuery : supplierAppUrl} aria-label={`${organizationName} · ${capability === "BUYER" ? "Клиника" : "Поставщик"} · Личный кабинет`}>
    <span className={styles.organization} title={organizationName}>{organizationName}</span>
  </a></div>;
}
