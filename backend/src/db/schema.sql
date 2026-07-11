-- ============================================================
-- B2B Flooring Work Order Platform — Full Schema
-- Extends the blind-pricing core (clients/properties/units/
-- work_orders/line_items/processed_webhooks) with the full
-- locked hierarchy from the master blueprint: Property -> Building
-- -> Unit, client rate cards, billing batches, and QBO plumbing.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. ASSET HIERARCHY
-- ------------------------------------------------------------

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corporate_name TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'credit_hold', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT NOT NULL,
    name TEXT NOT NULL,
    street_address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    building_identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(property_id, building_identifier)
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE NOT NULL,
    unit_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(building_id, unit_number)
);

-- ------------------------------------------------------------
-- 2. USERS & ROLES (custom JWT auth, per locked stack decision)
-- ------------------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client', 'staff', 'admin')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- set for role='client'
    display_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. CATALOG, RATE CARDS, FLOOR PLAN TEMPLATES
-- ------------------------------------------------------------

CREATE TABLE materials_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('LVP', 'Carpet', 'Sheet Vinyl', 'Tile', 'Baseboard', 'Prep', 'Labor')),
    unit_of_measure TEXT NOT NULL, -- sqft, linear_ft, bag, hour
    internal_cost_basis NUMERIC(10,4) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Snapshotting pattern (locked decision): rate cards feed the price
-- CHARGED at submission time into the line item; catalog price changes
-- later must never alter historical invoices.
CREATE TABLE client_rate_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    material_id UUID REFERENCES materials_catalog(id) ON DELETE RESTRICT NOT NULL,
    contracted_unit_price NUMERIC(10,2) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(client_id, material_id)
);

CREATE TABLE floor_plan_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    plan_name TEXT NOT NULL,
    -- e.g. {"Living Room": {"material_sku": "LVP-STD", "net_qty": 340, "waste_pct": 12}}
    room_manifest JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(property_id, plan_name)
);

-- ------------------------------------------------------------
-- 4. BILLING BATCHES (consolidated monthly statements)
-- ------------------------------------------------------------

CREATE TABLE billing_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE RESTRICT NOT NULL,
    batch_status TEXT NOT NULL DEFAULT 'open'
        CHECK (batch_status IN ('open', 'closed', 'synced_to_qbo')),
    qbo_invoice_id TEXT,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. WORK ORDERS — the root object (locked decision #1)
-- ------------------------------------------------------------

CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT NOT NULL,
    floor_plan_template_id UUID REFERENCES floor_plan_templates(id) ON DELETE RESTRICT NOT NULL,
    billing_batch_id UUID REFERENCES billing_batches(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES users(id) NOT NULL,
    assigned_to UUID REFERENCES users(id), -- installer/crew lead, per RFP's "basic install-date + assignee"
    scheduled_date DATE, -- staff-set install/turn date, the other half of "basic install-date assignment"
    billing_contact TEXT, -- corporate AP contact, deliberately separate from submitter (Open Item #1 default)
    po_number TEXT,
    target_turn_date DATE,
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review','priced','approved','scheduled','completed','billing_approved','invoiced')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Line items carry BOTH price-bearing and price-free columns.
-- The boundary is enforced by which columns a query SELECTs, not by
-- row-level hiding — see workOrderApi getClientPortalWorkOrder.
CREATE TABLE work_order_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
    material_id UUID REFERENCES materials_catalog(id) NOT NULL,
    room_name TEXT NOT NULL,
    quantity_calculated NUMERIC(10,2) NOT NULL,          -- visible to submitter
    quantity_actual_used NUMERIC(10,2),                  -- visible to submitter
    is_supplemental_prep BOOLEAN NOT NULL DEFAULT FALSE, -- visible to submitter only if FALSE
    unit_price_charged NUMERIC(10,2),                    -- NEVER visible to submitter
    internal_cost_basis NUMERIC(10,4),                   -- NEVER visible to submitter
    priced_by UUID REFERENCES users(id),
    priced_at TIMESTAMPTZ
);

CREATE INDEX idx_woli_work_order ON work_order_line_items(work_order_id);
CREATE INDEX idx_woli_visibility ON work_order_line_items(work_order_id, is_supplemental_prep);
CREATE INDEX idx_wo_unit ON work_orders(unit_id);
CREATE INDEX idx_wo_billing_batch ON work_orders(billing_batch_id);
CREATE INDEX idx_templates_property ON floor_plan_templates(property_id);

-- ------------------------------------------------------------
-- 5b. INVENTORY & PURCHASE ORDERS
-- ------------------------------------------------------------

CREATE TABLE inventory_stock (
    material_id UUID PRIMARY KEY REFERENCES materials_catalog(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
    reorder_threshold NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials_catalog(id) NOT NULL,
    delta NUMERIC(10,2) NOT NULL,
    reason TEXT,
    work_order_id UUID REFERENCES work_orders(id),
    adjusted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'received', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
    material_id UUID REFERENCES materials_catalog(id) NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    unit_cost NUMERIC(10,4) NOT NULL
);

-- ------------------------------------------------------------
-- 5c. PM / ESTIMATOR TRACKER — the RFP's explicitly required module
-- with no market precedent (per the master blueprint's own research:
-- no competitor platform separates "quick work orders" from "longer
-- tracked projects" as two systems feeding one invoicing layer).
-- Deliberately lightweight: this is NOT a full project-management
-- tool, just enough to track a 2-4 week job's labor/material summary
-- and feed a total into the same billing_batches invoicing path work
-- orders use — it is not its own separate invoice type.
-- ------------------------------------------------------------

CREATE TABLE project_trackers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE RESTRICT NOT NULL,
    billing_batch_id UUID REFERENCES billing_batches(id) ON DELETE SET NULL,
    project_name TEXT NOT NULL,
    estimator UUID REFERENCES users(id),
    start_date DATE NOT NULL,
    target_end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'complete', 'billing_approved', 'invoiced')),
    -- Summary-only fields: this tracker does NOT itemize
    -- room-by-room line items the way work_orders does. It rolls up
    -- to one labor total + one material total, which is exactly what
    -- gets fed into the consolidated invoice as two line items.
    summary_labor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    summary_material_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_trackers_property ON project_trackers(property_id);

CREATE TABLE project_tracker_billing_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_tracker_id UUID REFERENCES project_trackers(id) ON DELETE CASCADE NOT NULL,
    billing_batch_id UUID REFERENCES billing_batches(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6. STRIPE IDEMPOTENCY (from uploaded stripeWebhook.js baseline)
-- ------------------------------------------------------------

CREATE TABLE processed_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 7. PAYMENTS — Stripe or Square, client's choice (RFP mandate:
-- one of these two only, no custom processing)
-- ------------------------------------------------------------

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_batch_id UUID REFERENCES billing_batches(id) ON DELETE RESTRICT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'square')),
    provider_reference_id TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(provider, provider_reference_id)
);

-- ------------------------------------------------------------
-- 8. QUICKBOOKS — token manager + dead-letter queue
-- ------------------------------------------------------------

CREATE TABLE qbo_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    realm_id TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE qbo_sync_failures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_batch_id UUID REFERENCES billing_batches(id) ON DELETE SET NULL,
    raw_payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

-- ------------------------------------------------------------
-- 9. INSTALLERS & VENDORS — real entities replacing the assigned_to
-- borrow-from-users hack and the vendor-less purchase_orders gap.
-- See migrations/002_installers_vendors.sql for the standalone delta
-- to run against an already-migrated database (this file is only
-- ever applied in full against a fresh one).
-- ------------------------------------------------------------

CREATE TABLE installers (
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

CREATE INDEX idx_installers_active ON installers(is_active);

ALTER TABLE work_orders
    ADD COLUMN installer_id UUID REFERENCES installers(id) ON DELETE SET NULL;

CREATE INDEX idx_wo_installer ON work_orders(installer_id);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    account_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendors_active ON vendors(is_active);

ALTER TABLE purchase_orders
    ADD COLUMN vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
