"use client";
import { DmFeedback } from "@marketplace/ui/primitives";
import { useEffect, useState } from "react";
import { DmButton, DmField } from "@marketplace/ui/controls";
import { DmDropdown } from "@marketplace/ui";
import { usePersonalSession } from "../../personal-session";
import type { WorkspaceContext } from "@marketplace/schemas";
import { useBuyerMode, setBuyerMode, personalPurchaseMessage } from "../../buyer-context";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
import { loginUrl } from "../../public-links";
import styles from "./buyer-context-bar.module.css";

export function BuyerContextBar() {
  const mode = useBuyerMode();
  const personal = usePersonalSession();
  const [choices, setChoices] = useState<WorkspaceContext[]>([]);
  const [active, setActive] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
  useEffect(() => {
    const controller = new AbortController();
    setReady(false); setError("");
    void (async () => {
      const { sessionStore } = await import("../../workspace-session");
      await sessionStore.start();
      const session = sessionStore.getSnapshot().session;
      if (!session) { if (!controller.signal.aborted) { setChoices([]); setActive(""); } return; }
      const token = await sessionStore.getAccessToken();
      const response = await fetch(`${api}/auth/workspaces`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (!response.ok) throw new Error("Не удалось проверить доступные организации.");
      const { workspaceChoicesSchema } = await import("@marketplace/schemas/workspace-session");
      const items = workspaceChoicesSchema.parse(await response.json()).filter(item => item.capabilities.includes("BUYER"));
      if (!controller.signal.aborted) { setChoices(items); setActive(items.some(item => item.organizationId === session.organizationId) ? session.organizationId ?? "" : ""); }
    })().catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось загрузить организации."); })
      .finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [api, retry]);
  const choose = async (value: string) => {
    setError("");
    try {
      if (value === "personal") setBuyerMode("personal");
      else {
        const { switchBuyerOrganization } = await import("../../switch-buyer-context");
        await switchBuyerOrganization(value);
      }
      window.location.assign("/catalog");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Контекст не изменён. Повторите попытку."); }
  };
  return <div className={styles.bar} aria-label="Контекст покупателя">
    <DmField label="Покупатель">
      <DmDropdown aria-label="Покупатель" value={mode === "personal" || !active ? "personal" : active} disabled={!ready || mode === "loading" || mode === "switching"} onChange={(_, data) => void choose(data.value)}>
        <option value="personal">Личная покупка</option>
        {choices.map(item => <option key={item.organizationId} value={item.organizationId}>{item.organizationDisplayName}</option>)}
      </DmDropdown>
    </DmField>
    {!ready || mode === "loading" || mode === "switching" ? <p role="status">Проверяем контекст покупателя…</p> :
      mode === "personal" || !active ? <p role="status">{personalPurchaseMessage}</p> : <p>Покупка от организации. Личность плательщика не меняет покупателя.</p>}
    {personal.session && (mode === "personal" || !active) ? <DmButton as="a" href="/personal/cart">Личная корзина</DmButton> : null}
    {ready && personal.session && !active && !error ? <DmButton as="a" href={withWorkspaceReturn(loginUrl, "/clinic/cart")}>Войти в кабинет клиники</DmButton> : null}
    {error ? <DmFeedback presentation="inline" tone="danger" title="Покупатель не выбран" description={error} action={<DmButton onClick={() => setRetry(value => value + 1)}>Повторить проверку</DmButton>} /> : null}
  </div>;
}
