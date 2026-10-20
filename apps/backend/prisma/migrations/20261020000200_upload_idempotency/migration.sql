-- Client-generated idempotency key: a retried upload (e.g. after a lost response)
-- returns the invoice created by the first attempt instead of creating a second one.
ALTER TABLE "invoices" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "invoices_idempotency_key_key" ON "invoices"("idempotency_key");
