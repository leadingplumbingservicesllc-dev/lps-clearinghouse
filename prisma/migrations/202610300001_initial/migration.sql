-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Lien" (
    "id" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "instrument_number" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "bookPage" TEXT,
    "recordingDate" TIMESTAMP(3) NOT NULL,
    "grantor" TEXT NOT NULL,
    "grantee" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "legalDescription" TEXT NOT NULL,
    "siteAddress" TEXT NOT NULL,
    "parcelId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceDigest" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "lienId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactSource" TEXT NOT NULL,
    "contactVerifiedAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "underwriting" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "messageId" TEXT,
    "lastError" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "assignmentText" TEXT NOT NULL,
    "assignmentDigest" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signerWallet" TEXT,
    "walletSignature" TEXT,
    "openedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "MailEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskReport" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "analysis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Lien_recordingDate_idx" ON "Lien"("recordingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lien_county_instrument_number_key" ON "Lien"("county", "instrument_number");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_messageId_key" ON "Campaign"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_tokenHash_key" ON "Campaign"("tokenHash");

-- CreateIndex
CREATE INDEX "Campaign_status_nextAttemptAt_idx" ON "Campaign"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_lienId_email_key" ON "Campaign"("lienId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RiskReport_tokenHash_key" ON "RiskReport"("tokenHash");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_lienId_fkey" FOREIGN KEY ("lienId") REFERENCES "Lien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailEvent" ADD CONSTRAINT "MailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
