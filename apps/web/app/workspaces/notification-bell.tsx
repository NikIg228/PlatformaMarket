"use client";
import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverSurface, PopoverTrigger, Tab, TabList } from "@fluentui/react-components";
import { Alert24Regular } from "@fluentui/react-icons/svg/alert";
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss";
import { DmButton, EmptyState, LoadingState } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useNotificationInbox } from "./use-notification-inbox";
import { NotificationItems } from "./notification-items";
import styles from "./notifications.module.css";

export function NotificationBell() {
  const { role } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const inbox = useNotificationInbox({ unreadOnly, limit: 7, holdChanges: open });
  const count = inbox.data?.unreadCount ?? 0;
  return <Popover open={open} onOpenChange={(_, state) => setOpen(state.open)} positioning={{ position: "below", align: "end" }}>
    <PopoverTrigger disableButtonEnhancement><DmButton className={styles.bell} appearance="subtle" title="Уведомления" icon={<><Alert24Regular /><span className={styles.badge} hidden={!count} aria-hidden="true">{count > 99 ? "99+" : count}</span></>} aria-label={count ? `Уведомления: ${count} непрочитанных` : "Уведомления"} aria-expanded={open} /></PopoverTrigger>
    <PopoverSurface className={styles.popover} aria-label="Последние уведомления">
      <div className={styles.popoverHeading}><h2>Уведомления{count ? <span>{count}</span> : null}</h2><DmButton appearance="subtle" icon={<Dismiss20Regular />} aria-label="Закрыть уведомления" onClick={() => setOpen(false)} /></div>
      <div className={styles.popoverControls}><TabList data-dm-tab-kind="filter" selectedValue={unreadOnly ? "unread" : "all"} onTabSelect={(_, state) => setUnreadOnly(state.value === "unread")} aria-label="Показать уведомления"><Tab value="all">Все</Tab><Tab value="unread">Непрочитанные</Tab></TabList><DmButton appearance="subtle" size="small" disabled={inbox.busy || !count} onClick={() => void inbox.markRead()} title="Включая уведомления за пределами списка. Общие уведомления отмечаются для организации.">Прочитать все</DmButton></div>
      {inbox.error ? <div className={styles.feedback} role="alert">{inbox.error}<DmButton size="small" onClick={() => void inbox.refresh()}>Повторить</DmButton></div> : null}
      {inbox.newEvents ? <DmButton className={styles.newEvents} appearance="subtle" onClick={() => void inbox.refresh()}>Есть новые уведомления — показать</DmButton> : null}
      <div className={styles.popoverList}>{inbox.loading && !inbox.data ? <LoadingState label="Загружаем уведомления" /> : inbox.data?.items.length ? <NotificationItems items={inbox.data.items} role={role} compact busy={inbox.busy} onRead={item => void inbox.markRead(item)} onNavigate={() => setOpen(false)} /> : !inbox.error ? <EmptyState title={unreadOnly ? "Всё прочитано" : "Уведомлений пока нет"} description="Здесь появятся важные изменения по вашей работе." /> : null}</div>
      <Link className={styles.footerLink} href={`/${role}/notifications`} onClick={() => setOpen(false)}>Все уведомления →</Link>
    </PopoverSurface>
  </Popover>;
}
