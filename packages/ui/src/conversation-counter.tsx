"use client";
import { useEffect, useState, type ReactElement } from "react";
import { DmButton } from "./actions";
import type { ConversationApi } from "./conversation-workspace";

export function ConversationCounter({ api, href, icon, showLabel = false, onClick, current, copy = { label: "Сообщения", unavailable: "Сообщения, счётчик временно недоступен", unread: "непрочитанных диалогов" } }: { api: Pick<ConversationApi, "conversations">; href: string; icon?: ReactElement; showLabel?: boolean; onClick?: () => void; current?: boolean; copy?: { label: string; unavailable: string; unread: string } }) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try { const result = await api.conversations({ limit: 1 }); if (active) { setCount(result.unreadCount); setFailed(false); } }
      catch { if (active) setFailed(true); }
      finally { pending = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    window.addEventListener("marketplace:conversations", load);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; clearInterval(interval); window.removeEventListener("marketplace:conversations", load); document.removeEventListener("visibilitychange", load); };
  }, [api]);
  const label = failed ? copy.unavailable : `${copy.label}${count === null ? "" : `, ${copy.unread}: ${count}`}`;
  if (showLabel) return <a href={href} onClick={onClick} aria-current={current ? "page" : undefined} aria-label={label}>
    {icon ? <span aria-hidden="true">{icon}</span> : null}{copy.label}{failed ? " · !" : count ? ` · ${count}` : ""}
  </a>;
  return <DmButton as="a" href={href} icon={icon} onClick={onClick} aria-current={current ? "page" : undefined} appearance={icon ? "subtle" : undefined} style={icon ? { position: "relative" } : undefined} aria-label={label}>
    {icon && !showLabel ? failed || count ? <span aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, minWidth: 16, borderRadius: "var(--dm-radius-pill)", padding: "0 var(--dm-space-micro)", fontSize: "var(--dm-font-size-caption)", lineHeight: "var(--dm-line-compact)", background: "var(--dm-brand-primary)", color: "var(--dm-surface)" }}>{failed ? "!" : count! > 99 ? "99+" : count}</span> : null : <>{copy.label}{failed ? " · !" : count ? ` · ${count}` : ""}</>}
  </DmButton>;
}
