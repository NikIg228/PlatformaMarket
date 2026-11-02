ALTER TABLE "SupplierProfile"
  ADD COLUMN "workingCalendar" JSONB,
  ADD COLUMN "workingCalendarVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SupplierOrder"
  ADD COLUMN "responseCalendar" JSONB,
  ADD COLUMN "responseStartedAt" TIMESTAMP(3),
  ADD COLUMN "responseDeadlineAt" TIMESTAMP(3);

ALTER TABLE "SupplierProfile" ADD CONSTRAINT "SupplierProfile_workingCalendarVersion_check"
  CHECK ("workingCalendarVersion" >= 0);
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_responseCalendar_complete"
  CHECK (("responseCalendar" IS NULL AND "responseStartedAt" IS NULL AND "responseDeadlineAt" IS NULL)
    OR ("responseCalendar" IS NOT NULL AND "responseStartedAt" IS NOT NULL AND "responseDeadlineAt" IS NOT NULL
      AND "responseDeadlineAt" > "responseStartedAt"));
