-- Existing clients can omit extra contacts; existing organizations retain their
-- primary contact and receive an empty additional-contact list.
ALTER TABLE "OrganizationProfile" ADD COLUMN "additionalContacts" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN "phone" TEXT,
  ADD COLUMN "avatarAssetId" UUID,
  ADD COLUMN "profileVersion" INTEGER NOT NULL DEFAULT 1;
