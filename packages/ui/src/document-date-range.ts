import { documentDateValid } from "./document-upload-model";

export const DOCUMENT_ARCHIVE_TIME_ZONE = "Asia/Almaty";

/** Resolve a business-calendar midnight without using the host's timezone. */
function midnightUtc(calendarUtc: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
  let instant = calendarUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const zone = formatter.formatToParts(new Date(instant)).find(part => part.type === "timeZoneName")?.value;
    const offset = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(zone ?? "");
    if (!offset) throw new Error("Не удалось определить часовой пояс архива.");
    const seconds = offset[1] ? (Number(offset[2]) * 3600 + Number(offset[3]) * 60 + Number(offset[4] ?? 0)) * (offset[1] === "+" ? 1 : -1) : 0;
    const next = calendarUtc - seconds * 1000;
    if (next === instant) return instant;
    instant = next;
  }
  throw new Error("Не удалось определить границы выбранного дня.");
}

export function documentArchiveDateRange(dateFrom: string, dateTo: string, timeZone = DOCUMENT_ARCHIVE_TIME_ZONE) {
  if (dateFrom && !documentDateValid(dateFrom) || dateTo && !documentDateValid(dateTo)) throw new Error("Укажите корректные даты периода.");
  if (dateFrom && dateTo && dateFrom > dateTo) throw new Error("Дата начала не может быть позже даты окончания.");
  const start = (day: string) => Date.parse(`${day}T00:00:00.000Z`);
  return {
    dateFrom: dateFrom ? new Date(midnightUtc(start(dateFrom), timeZone)).toISOString() : undefined,
    // The current API uses lte, so preserve its inclusive contract.
    dateTo: dateTo ? new Date(midnightUtc(start(dateTo) + 86_400_000, timeZone) - 1).toISOString() : undefined,
  };
}
