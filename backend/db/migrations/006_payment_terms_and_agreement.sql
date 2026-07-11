-- ------------------------------------------------------------
-- 006: Payment terms, agreement, and advance tracking
-- Standalone delta for an already-migrated database. Full schema.sql
-- (already updated) covers this in-line for a FRESH install; run this
-- file instead if you're migrating an existing Codespace database.
-- ------------------------------------------------------------

ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT 'full_only';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deposit_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deposit_value NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agreement_signed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agreement_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agreement_document_path TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advance_agreed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advance_amount NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advance_cleared BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advance_cleared_at TIMESTAMPTZ;
ALTER TABLE billing_batches ADD COLUMN IF NOT EXISTS payment_stage TEXT NOT NULL DEFAULT 'full';
ALTER TABLE billing_batches ADD COLUMN IF NOT EXISTS parent_batch_id UUID REFERENCES billing_batches(id);
