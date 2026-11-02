import { z } from "zod";

export const workingIntervalSchema = z.object({
  fromMinute: z.number().int().min(0).max(1439),
  toMinute: z.number().int().min(1).max(1440),
}).strict().refine(value => value.fromMinute < value.toMinute, "Конец интервала должен быть позже начала");

const intervalsSchema = z.array(workingIntervalSchema).max(8).superRefine((intervals, context) => {
  const sorted = [...intervals].sort((a, b) => a.fromMinute - b.fromMinute);
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index - 1]!.toMinute > sorted[index]!.fromMinute)
      context.addIssue({ code: "custom", message: "Рабочие интервалы не должны пересекаться" });
  }
});
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Укажите существующую дату");

export const supplierCalendarFieldsSchema = z.object({
  timezone: z.string().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
  }, "Укажите часовой пояс IANA"),
  week: z.array(z.object({ day: z.number().int().min(1).max(7), intervals: intervalsSchema }).strict()).length(7),
  exceptions: z.array(z.object({ date: calendarDateSchema, intervals: intervalsSchema }).strict()).max(366),
}).strict().superRefine((value, context) => {
  if (new Set(value.week.map(day => day.day)).size !== 7)
    context.addIssue({ code: "custom", path: ["week"], message: "Каждый день недели должен быть указан один раз" });
  if (!value.week.some(day => day.intervals.length))
    context.addIssue({ code: "custom", path: ["week"], message: "Укажите хотя бы один рабочий интервал недели" });
  if (new Set(value.exceptions.map(day => day.date)).size !== value.exceptions.length)
    context.addIssue({ code: "custom", path: ["exceptions"], message: "Исключение для даты уже существует" });
});

export const saveSupplierCalendarSchema = supplierCalendarFieldsSchema.safeExtend({
  expectedVersion: z.number().int().nonnegative(), idempotencyKey: z.uuid(),
});
export const supplierCalendarResponseSchema = z.object({
  organizationId: z.uuid(), version: z.number().int().nonnegative(),
  source: z.enum(["DEFAULT", "SUPPLIER"]), canEdit: z.boolean(), calendar: supplierCalendarFieldsSchema,
});
export const orderResponseCalendarSchema = z.object({
  version: z.number().int().nonnegative(), source: z.enum(["DEFAULT", "SUPPLIER"]),
  calendar: supplierCalendarFieldsSchema,
});
export type SupplierCalendarFields = z.infer<typeof supplierCalendarFieldsSchema>;
export type SaveSupplierCalendar = z.infer<typeof saveSupplierCalendarSchema>;
export type SupplierCalendarResponse = z.infer<typeof supplierCalendarResponseSchema>;
export type OrderResponseCalendar = z.infer<typeof orderResponseCalendarSchema>;

export function defaultSupplierCalendar(): SupplierCalendarFields {
  return { timezone: "Asia/Almaty", week: Array.from({ length: 7 }, (_, index) => ({ day: index + 1,
    intervals: index < 5 ? [{ fromMinute: 540, toMinute: 1080 }] : [] })), exceptions: [] };
}
