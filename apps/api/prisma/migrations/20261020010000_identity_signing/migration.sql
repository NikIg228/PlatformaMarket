-- CreateEnum
CREATE TYPE "IdentitySigningStatus" AS ENUM ('AWAITING_USER', 'VERIFYING', 'UNKNOWN', 'COMMITTED', 'EVIDENCE_ONLY', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IdentityBindingStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "IdentitySigningSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "authSessionId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "IdentitySigningStatus" NOT NULL DEFAULT 'AWAITING_USER',
    "original" TEXT NOT NULL,
    "originalSha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cmsSha256" VARCHAR(64),
    "cmsEncrypted" TEXT,
    "reasonCode" TEXT,
    "leaseId" UUID,
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentitySigningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentitySigningCommand" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "authSessionId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestSha256" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentitySigningCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentitySigningEvidence" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "payloadSha256" VARCHAR(64) NOT NULL,
    "policySha256" VARCHAR(64) NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentitySigningEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningIdentityBinding" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "IdentityBindingStatus" NOT NULL DEFAULT 'ACTIVE',
    "iinEncrypted" TEXT NOT NULL,
    "iinFingerprint" VARCHAR(64) NOT NULL,
    "maskedIin" VARCHAR(12) NOT NULL,
    "evidenceId" UUID NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigningIdentityBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentitySigningSession_userId_authSessionId_organizationId__idx" ON "IdentitySigningSession"("userId", "authSessionId", "organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentitySigningSession_status_nextAttemptAt_leaseUntil_idx" ON "IdentitySigningSession"("status", "nextAttemptAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitySigningSession_id_userId_organizationId_authSession_key" ON "IdentitySigningSession"("id", "userId", "organizationId", "authSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitySigningCommand_authSessionId_organizationId_scope_i_key" ON "IdentitySigningCommand"("authSessionId", "organizationId", "scope", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitySigningEvidence_sessionId_key" ON "IdentitySigningEvidence"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SigningIdentityBinding_evidenceId_key" ON "SigningIdentityBinding"("evidenceId");

-- CreateIndex
CREATE INDEX "SigningIdentityBinding_userId_status_idx" ON "SigningIdentityBinding"("userId", "status");

-- CreateIndex
CREATE INDEX "SigningIdentityBinding_iinFingerprint_status_idx" ON "SigningIdentityBinding"("iinFingerprint", "status");

-- AddForeignKey
ALTER TABLE "IdentitySigningSession" ADD CONSTRAINT "IdentitySigningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySigningSession" ADD CONSTRAINT "IdentitySigningSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySigningSession" ADD CONSTRAINT "IdentitySigningSession_authSessionId_fkey" FOREIGN KEY ("authSessionId") REFERENCES "AuthSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySigningCommand" ADD CONSTRAINT "IdentitySigningCommand_sessionId_userId_organizationId_aut_fkey" FOREIGN KEY ("sessionId", "userId", "organizationId", "authSessionId") REFERENCES "IdentitySigningSession"("id", "userId", "organizationId", "authSessionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitySigningEvidence" ADD CONSTRAINT "IdentitySigningEvidence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IdentitySigningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningIdentityBinding" ADD CONSTRAINT "SigningIdentityBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningIdentityBinding" ADD CONSTRAINT "SigningIdentityBinding_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "IdentitySigningEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Identity uniqueness is enforced across concurrent workers and accounts.
CREATE UNIQUE INDEX "SigningIdentityBinding_active_user_key"
ON "SigningIdentityBinding" ("userId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "SigningIdentityBinding_active_fingerprint_key"
ON "SigningIdentityBinding" ("iinFingerprint") WHERE "status" = 'ACTIVE';

ALTER TABLE "IdentitySigningSession" ADD CONSTRAINT "IdentitySigningSession_lifecycle_check" CHECK (
  "version" > 0 AND "attempts" >= 0
  AND "expiresAt" > "createdAt"
  AND "expiresAt" <= "createdAt" + INTERVAL '10 minutes'
  AND ("acceptedAt" IS NULL OR ("acceptedAt" >= "createdAt" AND "acceptedAt" < "expiresAt"))
  AND (("cmsEncrypted" IS NULL AND "cmsSha256" IS NULL AND "acceptedAt" IS NULL)
    OR ("cmsEncrypted" IS NOT NULL AND "cmsSha256" IS NOT NULL AND "acceptedAt" IS NOT NULL))
  AND (("leaseId" IS NULL) = ("leaseUntil" IS NULL))
  AND ("status" NOT IN ('VERIFYING', 'UNKNOWN', 'COMMITTED', 'EVIDENCE_ONLY') OR "acceptedAt" IS NOT NULL)
);
ALTER TABLE "SigningIdentityBinding" ADD CONSTRAINT "SigningIdentityBinding_format_check" CHECK (
  "version" > 0 AND "iinFingerprint" ~ '^[a-f0-9]{64}$'
  AND "maskedIin" ~ '^\*{8}[0-9]{4}$'
);
