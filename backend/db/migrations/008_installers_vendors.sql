-- ------------------------------------------------------------
-- 008: Installers & Vendors
-- Standalone delta for an already-migrated database. Full schema.sql
-- (already updated) covers this in-line for a FRESH install; run this
-- file instead if you're migrating an existing Codespace database.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS installers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    specialty TEXT
        CHECK (specialty IN ('LVP', 'Carpet', 'Sheet Vinyl', 'Tile', 'Hardwood', 'General') OR specialty IS NULL),
    crew_capacity INT NOT NULL DEFAULT 1 CHECK (crew_capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installers_active ON installers(is_active);

ALTER TABLE work_orders
    ADD COLUMN IF NOT EXISTS installer_id UUID REFERENCES installers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wo_installer ON work_orders(installer_id);

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    account_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
