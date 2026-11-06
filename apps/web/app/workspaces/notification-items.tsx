"use client";
import Link from "next/link";
import type { NotificationInboxItem } from "@marketplace/schemas";
import { DmButton } from "@marketplace/ui/controls";
import { formatDate } from "@marketplace/ui/format";
import { Checkmark20Regular } from "@fluentui/react-icons/svg/checkmark";
import { Document20Regular } from "@fluentui/react-icons/svg/document";
import { Chat20Regular } from "@fluentui/react-icons/svg/chat";
import { Box20Regular } from "@fluentui/react-icons/svg/box";
import { Receipt20Regular } from "@fluentui/react-icons/svg/receipt";
import { Alert20Regular } from "@fluentui/react-icons/svg/alert";
import styles from "./notifications.module.css";
import { workspaceText, withWorkspaceLocale, type WorkspaceLocale } from "./workspace-locale";

export const notificationCategories: Record<NotificationInboxItem["category"], string> = { orders: "Заказы", payments: "Оплата", delivery: "Доставка", documents: "Документы", messages: "Сообщения", support: "Поддержка", organization: "Организация", products: "Товары" };
export function notificationHref(item: NotificationInboxItem, role: "clinic" | "supplier") {
  const target = item.target;
  if (!target) return null;
  const id = encodeURIComponent(target.id);
  switch (target.type) {
    case "order": return `/${role}/orders/${id}`;
    case "conversation": return `/${role}/messages?conversationId=${id}`;
    case "support": return `/${role}/support?ticketId=${id}`;
    case "document": return `/${role}/documents?documentId=${id}`;
    case "organization": return `/${role}/settings`;
    case "products": return role === "supplier" ? `/supplier/products/${target.section ?? "proposals"}${target.section === "proposals" ? `?request=${id}` : ""}` : null;
  }
}
export function NotificationItems({ items, role, locale = "ru", compact = false, busy, onRead, onNavigate }: {
  items: NotificationInboxItem[]; role: "clinic" | "supplier"; locale?: WorkspaceLocale; compact?: boolean; busy: boolean;
  onRead: (item: NotificationInboxItem) => void; onNavigate?: () => void;
}) {
  const t = (text: string) => workspaceText(locale, text);
  const dateText = (value: string, withTime = false) => locale === "ru" ? formatDate(value, withTime) : new Intl.DateTimeFormat("kk-KZ", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
  return <ol className={styles.items}>{items.map((item, index) => {
    const href = notificationHref(item, role);
    const date = dateText(item.createdAt);
    const showDate = !compact && (index === 0 || dateText(items[index - 1].createdAt) !== date);
    const Icon = item.category === "documents" ? Document20Regular : item.category === "messages" ? Chat20Regular : item.category === "payments" ? Receipt20Regular : item.category === "orders" || item.category === "delivery" ? Box20Regular : Alert20Regular;
    return <li key={item.id}>{showDate ? <h2 className={styles.date}>{date}</h2> : null}<article className={styles.item} data-unread={!item.readAt}>
      <span className={styles.icon} aria-hidden="true"><Icon /></span>
      <div className={styles.content}><div className={styles.itemHeading}><h3>{item.title}</h3>{!item.readAt ? <span className={styles.dot} aria-label={t("Непрочитано")} /> : null}</div>
        {item.context ? <p className={styles.context}>{item.context}</p> : null}<p>{item.description}</p>
        <div className={styles.itemBottom}><time dateTime={item.createdAt}>{dateText(item.createdAt, true)}</time><span title={t(item.readScope === "organization" ? "Отметка прочтения общая для сотрудников организации" : "Личное уведомление")}>{t(item.readScope === "personal" ? "Личное" : notificationCategories[item.category])}</span></div>
        <div className={styles.itemActions}>{href ? <Link href={withWorkspaceLocale(href, locale)} onClick={() => { if (!item.readAt) onRead(item); onNavigate?.(); }}>{locale === "ru" ? item.target!.label : t("Открыть")}</Link> : null}{!item.readAt ? <DmButton appearance="subtle" size="small" icon={<Checkmark20Regular />} disabled={busy} onClick={() => onRead(item)} title={t("Отметить прочитанным")} aria-label={`${t("Прочитано")}: ${item.title}`} /> : null}</div>
      </div></article></li>;
  })}</ol>;
}
