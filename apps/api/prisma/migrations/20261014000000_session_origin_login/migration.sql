-- Existing sessions keep an unknown origin; never infer it from user or timestamps.
ALTER TABLE "AuthSession" ADD COLUMN "originLoginSessionId" UUID;
CREATE INDEX "AuthSession_originLoginSessionId_idx" ON "AuthSession"("originLoginSessionId");
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_originLoginSessionId_fkey"
  FOREIGN KEY ("originLoginSessionId") REFERENCES "AuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
