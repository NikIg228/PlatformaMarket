"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useState } from "react";
import { DmButton, DmDropdown, EmptyState, LoadingState } from "@marketplace/ui";
import { Tab, TabList } from "@fluentui/react-components";
import type { NotificationInboxItem } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import { PermissionBoundary } from "./permission-boundary";
import { useNotificationInbox } from "./use-notification-inbox";
import { NotificationItems, notificationCategories } from "./notification-items";
import styles from "./notifications.module.css";

export default function Notifications() { return <PermissionBoundary required={["notification.view"]}><NotificationList /></PermissionBoundary>; }
function NotificationList() {
  const { role } = useWorkspace();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<NotificationInboxItem["category"]>();
  const inbox = useNotificationInbox({ unreadOnly, category });
  return <section className={styles.history} aria-label="История уведомлений">
    <div className={styles.toolbar}><TabList data-dm-tab-kind="filter" selectedValue={unreadOnly ? "unread" : "all"} onTabSelect={(_, value) => setUnreadOnly(value.value === "unread")} aria-label="Показать уведомления"><Tab value="all">Все</Tab><Tab value="unread">Непрочитанные{inbox.data?.unreadCount ? ` (${inbox.data.unreadCount})` : ""}</Tab></TabList>
      <div className={styles.category}><DmDropdown aria-label="Категория уведомлений" value={category ?? ""} onChange={(_, data) => setCategory(data.value ? data.value as NotificationInboxItem["category"] : undefined)}><option value="">Все категории</option>{Object.entries(notificationCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmDropdown></div>
      <div className={styles.toolbarActions}><DmButton disabled={inbox.busy || !inbox.data?.unreadCount} onClick={() => void inbox.markRead()}>Прочитать все</DmButton><DmButton disabled={inbox.loading} onClick={() => void inbox.refresh()}>Обновить</DmButton></div>
    </div>
    <p className={styles.scope}>Общие уведомления отмечаются прочитанными для организации. Личные — только для вас. «Прочитать все» включает все категории и ранее загруженные события за пределами списка.</p>
    {inbox.error ? <ActionFeedback tone="error" description={inbox.error} action={<DmButton onClick={() => void inbox.refresh()}>Повторить</DmButton>} /> : null}
    {inbox.newEvents ? <DmButton className={styles.newEvents} onClick={() => void inbox.refresh()}>Есть новые уведомления — показать</DmButton> : null}
    {inbox.loading && !inbox.data ? <LoadingState label="Загружаем уведомления" /> : inbox.data?.items.length ? <NotificationItems items={inbox.data.items} role={role} busy={inbox.busy} onRead={item => void inbox.markRead(item)} /> : !inbox.error ? <EmptyState title={unreadOnly ? "Непрочитанных уведомлений нет" : "Уведомлений пока нет"} description={category ? "Попробуйте другую категорию." : "Здесь появятся изменения заказов, документов и переписки."} /> : null}
    {inbox.data?.nextCursor ? <div className={styles.loadMore}><DmButton disabled={inbox.loading} onClick={() => void inbox.more()}>{inbox.loading ? "Загружаем…" : "Показать ещё"}</DmButton></div> : null}
  </section>;
}
