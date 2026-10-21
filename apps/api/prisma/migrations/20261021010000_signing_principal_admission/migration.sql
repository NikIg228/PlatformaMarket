-- CreateTable
-- One active principal per organization and one pending application per member.
-- Partial indexes and lifecycle checks are added after table creation below.
CREATE TABLE "SigningPrincipalAdmission" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "identityBindingId" UUID NOT NULL,
    "identityBindingVersion" INTEGER NOT NULL,
    "membershipId" UUID NOT NULL,
    "membershipUpdatedAt" TIMESTAMP(3) NOT NULL,
    "organizationVersion" INTEGER NOT NULL,
    "requisitesVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "application" JSONB NOT NULL,
    "applicantName" TEXT NOT NULL,
    "maskedIin" VARCHAR(12) NOT NULL,
    "basisDocumentId" UUID NOT NULL,
    "basisDocumentVersion" INTEGER NOT NULL,
    "basisChecksum" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigningPrincipalAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningPrincipalReview" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "operatorOrganizationId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "verification" JSONB,
    "evidenceDocumentId" UUID,
    "evidenceChecksum" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningPrincipalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningPrincipalAuthority" (
    "id" UUID NOT NULL,
    "admissionId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "identityBindingId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningPrincipalAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningAdmissionCommand" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestSha256" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningAdmissionCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigningPrincipalAdmission_organizationId_userId_createdAt_idx" ON "SigningPrincipalAdmission"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "SigningPrincipalAdmission_status_createdAt_idx" ON "SigningPrincipalAdmission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SigningPrincipalReview_admissionId_key" ON "SigningPrincipalReview"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SigningPrincipalAuthority_admissionId_key" ON "SigningPrincipalAuthority"("admissionId");

-- CreateIndex
CREATE INDEX "SigningPrincipalAuthority_organizationId_status_idx" ON "SigningPrincipalAuthority"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SigningAdmissionCommand_actorId_scope_key_key" ON "SigningAdmissionCommand"("actorId", "scope", "key");

-- AddForeignKey
ALTER TABLE "SigningPrincipalAdmission" ADD CONSTRAINT "SigningPrincipalAdmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAdmission" ADD CONSTRAINT "SigningPrincipalAdmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAdmission" ADD CONSTRAINT "SigningPrincipalAdmission_identityBindingId_fkey" FOREIGN KEY ("identityBindingId") REFERENCES "SigningIdentityBinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAdmission" ADD CONSTRAINT "SigningPrincipalAdmission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAdmission" ADD CONSTRAINT "SigningPrincipalAdmission_basisDocumentId_fkey" FOREIGN KEY ("basisDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalReview" ADD CONSTRAINT "SigningPrincipalReview_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "SigningPrincipalAdmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalReview" ADD CONSTRAINT "SigningPrincipalReview_operatorOrganizationId_fkey" FOREIGN KEY ("operatorOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalReview" ADD CONSTRAINT "SigningPrincipalReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalReview" ADD CONSTRAINT "SigningPrincipalReview_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAuthority" ADD CONSTRAINT "SigningPrincipalAuthority_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "SigningPrincipalAdmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAuthority" ADD CONSTRAINT "SigningPrincipalAuthority_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAuthority" ADD CONSTRAINT "SigningPrincipalAuthority_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPrincipalAuthority" ADD CONSTRAINT "SigningPrincipalAuthority_identityBindingId_fkey" FOREIGN KEY ("identityBindingId") REFERENCES "SigningIdentityBinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningAdmissionCommand" ADD CONSTRAINT "SigningAdmissionCommand_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SigningPrincipalAuthority_active_organization" ON "SigningPrincipalAuthority"("organizationId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "SigningPrincipalAdmission_pending_member" ON "SigningPrincipalAdmission"("organizationId", "userId") WHERE "status" = 'PENDING_REVIEW';
ALTER TABLE "SigningPrincipalAdmission" ADD CONSTRAINT "SigningPrincipalAdmission_state_check" CHECK (
  "status" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED') AND "version" > 0 AND
  "organizationVersion" > 0 AND "identityBindingVersion" > 0 AND "requisitesVersion" > 0 AND "basisDocumentVersion" > 0 AND
  "maskedIin" ~ '^\*{8}[0-9]{4}$' AND "basisChecksum" ~ '^[a-f0-9]{64}$'
);
ALTER TABLE "SigningPrincipalAuthority" ADD CONSTRAINT "SigningPrincipalAuthority_state_check" CHECK (
  "status" IN ('ACTIVE', 'SUSPENDED', 'REVOKED') AND "version" > 0
);
ALTER TABLE "SigningPrincipalReview" ADD CONSTRAINT "SigningPrincipalReview_decision_check" CHECK (
  length("reason") BETWEEN 2 AND 1000 AND (
    ("decision" = 'APPROVE' AND "verification" IS NOT NULL AND "evidenceDocumentId" IS NOT NULL AND "evidenceChecksum" IS NOT NULL AND "evidenceChecksum" ~ '^[a-f0-9]{64}$') OR
    ("decision" = 'REJECT' AND "verification" IS NULL AND "evidenceDocumentId" IS NULL AND "evidenceChecksum" IS NULL)
  )
);
