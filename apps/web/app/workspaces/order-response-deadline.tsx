import type { OrderResponseCalendar } from "@marketplace/schemas";
import { calendarCopy, type CalendarLocale } from "./calendar-copy";
import styles from "./calendar.module.css";

export function OrderResponseDeadline({ order, locale }: {
  order: { responseDeadlineAt?: string | null; responseCalendar?: OrderResponseCalendar | null };
  locale: CalendarLocale;
}) {
  const t = calendarCopy[locale];
  const timezone = order.responseCalendar?.calendar.timezone;
  return <section className={styles.section} aria-label={t.deadline} lang={locale}>
    <h3 className={styles.heading}>{t.deadline}</h3>
    {order.responseDeadlineAt && timezone ? <>
      <time dateTime={order.responseDeadlineAt}>{new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
        timeZone: timezone, dateStyle: "medium", timeStyle: "short",
      }).format(new Date(order.responseDeadlineAt))} · {timezone}</time>
      <p className={styles.text}>{t.snapshot}</p>
    </> : <p className={styles.text}>{t.legacy}</p>}
  </section>;
}
