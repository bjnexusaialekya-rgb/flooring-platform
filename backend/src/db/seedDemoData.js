require('dotenv').config();
const { pool } = require('./pool');

// Additive demo-data seed for B2B SaaS demos. Does NOT touch or replace
// seed.js — that script creates the one baseline client/admin/work order
// needed for the pricing-boundary test, and this script assumes it has
// already been run (it reuses that client if present, or creates its
// own). Run this separately: `node src/db/seedDemoData.js`.
//
// Why this exists: with only one property and one work order, the
// Reports page's revenueTrend (30-day bucketed line) and topProperties
// charts have nothing to show — a single point or a single bar reads as
// "barely used" to a prospect evaluating the platform. This script adds
// several properties and a spread of invoiced work orders across the
// last 30 days so those charts look like a platform in active use.
//
// Purely additive, purely demo/seed data in the dev database — no real
// customer data involved, and safe to re-run (each run adds a fresh
// batch rather than mutating existing rows).

const PROPERTIES = [
  { name: 'Oakridge Apartments', city: 'Hyderabad', state: 'TG' },
  { name: 'Meridian Point', city: 'Austin', state: 'TX' },
  { name: 'Copperleaf Commons', city: 'Denver', state: 'CO' },
  { name: 'Harbor View Residences', city: 'Tampa', state: 'FL' },
  { name: 'Willow Creek Flats', city: 'Charlotte', state: 'NC' },
];

const INSTALLERS = [
  { name: 'Marcus Webb', specialty: 'LVP' },
  { name: 'Dana Ferreira', specialty: 'Carpet' },
  { name: 'Priya Nair', specialty: 'Tile' },
  { name: 'Colin Ashworth', specialty: 'Hardwood' },
];

const MATERIAL = { sku: 'LVP-STD', name: 'Standard LVP', category: 'LVP', unit_of_measure: 'sqft', internal_cost_basis: 1.85 };

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedDemoData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Reuse the seed.js client if it exists; otherwise create one ---
    let clientRes = await client.query(`SELECT id FROM clients WHERE corporate_name = 'Sample Property Group'`);
    let clientId;
    if (clientRes.rows.length > 0) {
      clientId = clientRes.rows[0].id;
    } else {
      const res = await client.query(
        `INSERT INTO clients (corporate_name) VALUES ('Sample Property Group') RETURNING id`
      );
      clientId = res.rows[0].id;
    }

    // Admin user, needed as priced_by on line items — reuse seed.js's if present.
    const adminRes = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRes.rows.length === 0) {
      throw new Error('No admin user found — run `node src/db/seed.js` first.');
    }
    const adminId = adminRes.rows[0].id;

    const clientUserRes = await client.query(`SELECT id FROM users WHERE role = 'client' AND client_id = $1 LIMIT 1`, [clientId]);
    const submittedBy = clientUserRes.rows.length > 0 ? clientUserRes.rows[0].id : adminId;

    // --- Material catalog entry (reuse if already seeded) ---
    const materialRes = await client.query(
      `INSERT INTO materials_catalog (sku, name, category, unit_of_measure, internal_cost_basis)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [MATERIAL.sku, MATERIAL.name, MATERIAL.category, MATERIAL.unit_of_measure, MATERIAL.internal_cost_basis]
    );
    const materialId = materialRes.rows[0].id;

    // --- Installers ---
    const installerIds = [];
    for (const inst of INSTALLERS) {
      const res = await client.query(
        `INSERT INTO installers (name, specialty, crew_capacity, is_active)
         VALUES ($1, $2, 2, TRUE)
         RETURNING id`,
        [inst.name, inst.specialty]
      );
      installerIds.push(res.rows[0].id);
    }

    // --- Properties, each with one building/unit/floor plan template ---
    const propertyRows = [];
    for (const p of PROPERTIES) {
      const propRes = await client.query(
        `INSERT INTO properties (client_id, name, city, state) VALUES ($1, $2, $3, $4) RETURNING id, name`,
        [clientId, p.name, p.city, p.state]
      );
      const propertyId = propRes.rows[0].id;

      const buildingRes = await client.query(
        `INSERT INTO buildings (property_id, building_identifier) VALUES ($1, 'Building A') RETURNING id`,
        [propertyId]
      );
      const buildingId = buildingRes.rows[0].id;

      const templateRes = await client.query(
        `INSERT INTO floor_plan_templates (property_id, plan_name, room_manifest)
         VALUES ($1, 'The Aspen 2Bed/2Bath', $2::jsonb)
         RETURNING id`,
        [propertyId, JSON.stringify({ 'Living Room': { material_sku: 'LVP-STD', net_qty: 340, waste_pct: 12 } })]
      );
      const templateId = templateRes.rows[0].id;

      propertyRows.push({ propertyId, buildingId, templateId, name: propRes.rows[0].name });
    }

    // --- Spread ~35 work orders across the last 30 days, mostly
    // invoiced/billing_approved so the revenue trend chart has real
    // daily variation instead of one spike. A few left open/in-progress
    // so the status funnel isn't unrealistically all-closed. ---
    const totalOrders = 35;
    let created = 0;

    for (let i = 0; i < totalOrders; i++) {
      const prop = propertyRows[randInt(0, propertyRows.length - 1)];
      const installerId = installerIds[randInt(0, installerIds.length - 1)];
      const daysAgo = randInt(0, 29);
      const unitNumber = String(randInt(101, 499));

      const unitRes = await client.query(
        `INSERT INTO units (building_id, unit_number) VALUES ($1, $2) RETURNING id`,
        [prop.buildingId, unitNumber]
      );
      const unitId = unitRes.rows[0].id;

      // ~75% closed/invoiced (drives revenue chart), ~25% still moving
      // through the pipeline (keeps the status funnel realistic).
      const roll = Math.random();
      const status = roll < 0.55 ? 'invoiced' : roll < 0.75 ? 'billing_approved' : roll < 0.88 ? 'scheduled' : roll < 0.96 ? 'priced' : 'pending_review';

      const woRes = await client.query(
        `INSERT INTO work_orders
           (unit_id, floor_plan_template_id, submitted_by, installer_id, status, target_turn_date, po_number, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - ($6 || ' days')::interval + INTERVAL '5 days', $7, NOW() - ($6 || ' days')::interval)
         RETURNING id`,
        [unitId, prop.templateId, submittedBy, installerId, status, daysAgo, `DEMO-${1000 + i}`]
      );
      const workOrderId = woRes.rows[0].id;

      // Only priced+ statuses get a line item, matching how pricing
      // actually flows in this app.
      if (status !== 'pending_review') {
        const qty = randInt(200, 500);
        const unitPrice = (Math.random() * 2 + 3.5).toFixed(2); // $3.50–$5.50/sqft
        await client.query(
          `INSERT INTO work_order_line_items
             (work_order_id, material_id, room_name, quantity_calculated, unit_price_charged, internal_cost_basis, priced_by, priced_at)
           VALUES ($1, $2, 'Living Room', $3, $4, $5, $6, NOW() - ($7 || ' days')::interval)`,
          [workOrderId, materialId, qty, unitPrice, MATERIAL.internal_cost_basis, adminId, daysAgo]
        );
      }

      created++;
    }

    await client.query('COMMIT');
    console.log(`Demo data seeded: ${propertyRows.length} properties, ${installerIds.length} installers, ${created} work orders spread across the last 30 days.`);
    console.log('Reports > revenue trend and top properties should now show realistic spread. Refresh the Reports page to see it.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Demo seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData();
