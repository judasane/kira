-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PSPProvider" AS ENUM ('STRIPE', 'ADYEN');

-- CreateEnum
CREATE TYPE "PSPAttemptStatus" AS ENUM ('SUCCESS', 'DECLINED', 'TIMEOUT', 'ERROR');

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_configs" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "fixedFeeUsd" DECIMAL(10,2) NOT NULL DEFAULT 0.30,
    "variableFeePercent" DECIMAL(5,4) NOT NULL DEFAULT 0.029,
    "fxMarkupPercent" DECIMAL(5,4) NOT NULL DEFAULT 0.015,
    "firstTxFreeCount" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "feeConfigOverride" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "pspProvider" "PSPProvider",
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "amountMxn" DECIMAL(10,2),
    "fxRateApplied" DECIMAL(10,4),
    "feesTotalUsd" DECIMAL(10,2),
    "idempotencyKey" TEXT,
    "cardToken" TEXT NOT NULL,
    "metadata" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_attempts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "pspProvider" "PSPProvider" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "status" "PSPAttemptStatus" NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "pspChargeId" TEXT,
    "pspTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psp_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");

-- CreateIndex
CREATE INDEX "fee_configs_merchantId_idx" ON "fee_configs"("merchantId");

-- CreateIndex
CREATE INDEX "payment_links_merchantId_idx" ON "payment_links"("merchantId");

-- CreateIndex
CREATE INDEX "payment_links_status_idx" ON "payment_links"("status");

-- CreateIndex
CREATE INDEX "payment_links_createdAt_idx" ON "payment_links"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "transactions_paymentLinkId_idx" ON "transactions"("paymentLinkId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "psp_attempts_transactionId_idx" ON "psp_attempts"("transactionId");

-- CreateIndex
CREATE INDEX "psp_attempts_pspProvider_idx" ON "psp_attempts"("pspProvider");

-- CreateIndex
CREATE INDEX "psp_attempts_status_idx" ON "psp_attempts"("status");

-- CreateIndex
CREATE INDEX "psp_attempts_createdAt_idx" ON "psp_attempts"("createdAt");

-- AddForeignKey
ALTER TABLE "fee_configs" ADD CONSTRAINT "fee_configs_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_attempts" ADD CONSTRAINT "psp_attempts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
