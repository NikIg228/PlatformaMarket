-- Additive migration: no existing profile/price/tax data is inferred or rewritten.
CREATE TABLE "OrganizationRequisites" (
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrganizationRequisites_pkey" PRIMARY KEY ("organizationId"),
    CONSTRAINT "OrganizationRequisites_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "OrganizationRequisitesRevision" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "source" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" UUID,
    "confirmedByName" TEXT,
    "confirmedAt" TIMESTAMP(3),
    CONSTRAINT "OrganizationRequisitesRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationRequisitesRevision_version_check" CHECK ("version" > 0),
    CONSTRAINT "OrganizationRequisitesRevision_confirmation_check" CHECK (
      ("confirmedAt" IS NULL AND "confirmedById" IS NULL AND "confirmedByName" IS NULL)
      OR ("confirmedAt" IS NOT NULL AND "confirmedById" IS NOT NULL AND "confirmedByName" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "OrganizationRequisitesRevision_organizationId_version_key" ON "OrganizationRequisitesRevision"("organizationId", "version");
ALTER TABLE "OrganizationRequisites" ADD CONSTRAINT "OrganizationRequisites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationRequisitesRevision" ADD CONSTRAINT "OrganizationRequisitesRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Revision contents and attribution cannot be overwritten, including drafts.
-- The only update is the first atomic confirmation of the same payload.
CREATE FUNCTION "protect_organization_requisites_revision"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."fields" IS DISTINCT FROM OLD."fields"
     OR NEW."source" IS DISTINCT FROM OLD."source"
     OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
     OR NEW."createdByName" IS DISTINCT FROM OLD."createdByName"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR OLD."confirmedAt" IS NOT NULL
     OR NEW."confirmedAt" IS NULL THEN
    RAISE EXCEPTION 'Organization requisites revision is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OrganizationRequisitesRevision_immutable"
BEFORE UPDATE ON "OrganizationRequisitesRevision"
FOR EACH ROW EXECUTE FUNCTION "protect_organization_requisites_revision"();
