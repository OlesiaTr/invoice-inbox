-- list() sorts and filters on these columns, but only status/sha256/created_at were indexed.
CREATE INDEX "invoices_vendor_name_idx" ON "invoices"("vendor_name");
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");
CREATE INDEX "invoices_total_idx" ON "invoices"("total");
