"use client";
import { DmTabList } from "@marketplace/ui/controls";
import { ActionFeedback } from "@marketplace/ui/action-feedback";
import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverSurface, PopoverTrigger, Tab } from "@fluentui/react-components";
import { Alert24Regular } from "@fluentui/react-icons/svg/alert";
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss";
import { DmButton } from "@marketplace/ui/controls";
import { EmptyState, LoadingState } from "@marketplace/ui/primitives";
import { useWorkspace } from "./workspace";
import { useNotificationInbox } from "./use-notification-inbox";
import { NotificationItems } from "./notification-items";
import styles from "./notifications.module.css";
import { workspaceText, withWorkspaceLocale } from "./workspace-locale";

export function NotificationBell() {
  const { role, locale } = useWorkspace();
  const t = (text: string) => workspaceText(locale, text);
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const inbox = useNotificationInbox({ unreadOnly, limit: 7, holdChanges: open });
  const count = inbox.data?.unreadCount ?? 0;
  return <Popover open={open} onOpenChange={(_, state) => setOpen(state.open)} positioning={{ position: "below", align: "end" }}>
    <PopoverTrigger disableButtonEnhancement><DmButton className={styles.bell} appearance="subtle" title={t("Уведомления")} icon={<><Alert24Regular /><span className={styles.badge} hidden={!count} aria-hidden="true">{count > 99 ? "99+" : count}</span></>} aria-label={count ? locale === "ru" ? `Уведомления: ${count} непрочитанных` : `${t("Уведомления")}: ${t("Непрочитанных")} ${count}` : t("Уведомления")} aria-expanded={open} /></PopoverTrigger>
    <PopoverSurface className={styles.popover} aria-label={t("Последние уведомления")} lang={locale}>
      <div className={styles.popoverHeading}><h2>{t("Уведомления")}{count ? <span>{count}</span> : null}</h2><DmButton appearance="subtle" icon={<Dismiss20Regular />} aria-label={t("Закрыть уведомления")} onClick={() => setOpen(false)} /></div>
      <div className={styles.popoverControls}><DmTabList selectedValue={unreadOnly ? "unread" : "all"} onTabSelect={(_, state) => setUnreadOnly(state.value === "unread")} aria-label={t("Показать уведомления")}><Tab value="all">{t("Все")}</Tab><Tab value="unread">{t("Непрочитанные")}</Tab></DmTabList><DmButton appearance="subtle" size="small" disabled={inbox.busy || !count} onClick={() => void inbox.markRead()} title={t("Включая уведомления за пределами списка. Общие уведомления отмечаются для организации.")}>{t("Прочитать все")}</DmButton></div>
      {inbox.error ? <ActionFeedback tone="error" description={locale === "ru" ? inbox.error : t("Не удалось загрузить уведомления. Повторите попытку.")} action={<DmButton onClick={() => void inbox.refresh()}>{t("Повторить")}</DmButton>} /> : null}
      {inbox.newEvents ? <DmButton className={styles.newEvents} appearance="subtle" onClick={() => void inbox.refresh()}>{t("Есть новые уведомления — показать")}</DmButton> : null}
      <div className={styles.popoverList}>{inbox.loading && !inbox.data ? <LoadingState label={t("Загружаем уведомления")} /> : inbox.data?.items.length ? <NotificationItems items={inbox.data.items} role={role} locale={locale} compact busy={inbox.busy} onRead={item => void inbox.markRead(item)} onNavigate={() => setOpen(false)} /> : !inbox.error ? <EmptyState title={t(unreadOnly ? "Всё прочитано" : "Уведомлений пока нет")} description={t("Здесь появятся важные изменения по вашей работе.")} /> : null}</div>
      <Link className={styles.footerLink} href={withWorkspaceLocale(`/${role}/notifications`, locale)} onClick={() => setOpen(false)}>{t("Все уведомления →")}</Link>
    </PopoverSurface>
  </Popover>;
}
