import type { OrderResponseCalendar } from "@marketplace/schemas";
import { DmButton, DmFeedback, PermissionFields } from "@marketplace/ui";
import { calendarCopy, type CalendarLocale } from "./calendar-copy";
import { orderResponseState, responseCopy, type ResponseStateOrder } from "./order-response-state";
import styles from "./calendar.module.css";

export function OrderResponseDeadline({ order, locale, role }: {
  order: ResponseStateOrder & { responseCalendar?: OrderResponseCalendar | null; responseSupportTicketId?: string | null };
  locale: CalendarLocale;
  role: "clinic" | "supplier";
}) {
  const t = calendarCopy[locale];
  const timezone = order.responseCalendar?.calendar.timezone;
  const copy = responseCopy[locale];
  const state = orderResponseState(order);
  const format = (value: string) => new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
    timeZone: timezone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
  const events = [
    [copy.reminderAt, order.responseRemindedAt], [copy.overdueAt, order.responseOverdueAt],
    [copy.escalatedAt, order.responseEscalatedAt], [copy.receivedAt, order.responseReceivedAt],
  ];
  return <section className={styles.section} aria-label={t.deadline} lang={locale}>
    <h3 className={styles.heading}>{t.deadline}</h3>
    {order.responseDeadlineAt && timezone ? <>
      <time dateTime={order.responseDeadlineAt}>{format(order.responseDeadlineAt)} · {timezone}</time>
      <p className={styles.text}>{t.snapshot}</p>
      <DmFeedback presentation="inline" tone={state === "overdue" || state === "answeredLate" ? "warning" : state === "escalated" ? "info" : "neutral"}
        title={copy[state][0]} description={copy[state][1]}
        action={role === "clinic" && order.responseSupportTicketId ? <PermissionFields required={["support.ticket.view"]}>
          <DmButton as="a" href={`/clinic/support?ticketId=${order.responseSupportTicketId}`}>{copy.openCase} →</DmButton>
        </PermissionFields> : undefined} />
      {events.map(([label, value]) => value ? <p className={styles.text} key={label}>
        {label}: <time dateTime={value}>{format(value)}</time>
      </p> : null)}
    </> : <p className={styles.text}>{t.legacy}</p>}
  </section>;
}
