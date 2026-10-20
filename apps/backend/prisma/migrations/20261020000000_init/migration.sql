
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('uploaded', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'uploaded',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_reason" TEXT,
    "processing_started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "raw_text" TEXT,
    "extracted_data" JSONB,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vendor_name" TEXT,
    "invoice_number" TEXT,
    "issue_date" DATE,
    "total" DECIMAL(14,2),
    "currency" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_sha256_idx" ON "invoices"("sha256");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

