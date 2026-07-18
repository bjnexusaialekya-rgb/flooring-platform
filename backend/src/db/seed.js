require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./pool');

async function seed() {
  if (!process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('SEED_ADMIN_PASSWORD is not set. Refusing to seed with a hardcoded fallback password.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Admin user (bootstrap — /auth/register requires an admin,
    // so the very first one has to be created directly) ---
    const adminEmail = 'admin@bjnexus.local';
    const adminPasswordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);
    const adminRes = await client.query(
      `INSERT INTO users (email, password_hash, role, display_name)
       VALUES ($1, $2, 'admin', 'Seed Admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [adminEmail, adminPasswordHash]
    );
    console.log(`Admin created: ${adminEmail} (password set via SEED_ADMIN_PASSWORD env var)`);

    // --- Sample client + property + building + unit ---
    const clientRes = await client.query(
      `INSERT INTO clients (corporate_name) VALUES ('Sample Property Group') RETURNING id`
    );
    const clientId = clientRes.rows[0].id;

    const propertyRes = await client.query(
      `INSERT INTO properties (client_id, name, city, state) VALUES ($1, 'Oakridge Apartments', 'Hyderabad', 'TG') RETURNING id`,
      [clientId]
    );
    const propertyId = propertyRes.rows[0].id;

    const buildingRes = await client.query(
      `INSERT INTO buildings (property_id, building_identifier) VALUES ($1, 'Building A') RETURNING id`,
      [propertyId]
    );
    const buildingId = buildingRes.rows[0].id;

    const unitRes = await client.query(
      `INSERT INTO units (building_id, unit_number) VALUES ($1, '101') RETURNING id`,
      [buildingId]
    );
    const unitId = unitRes.rows[0].id;

    // --- Client-role user, scoped to that client ---
    const clientUserPasswordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);
    const clientUserRes = await client.query(
      `INSERT INTO users (email, password_hash, role, client_id, display_name)
       VALUES ($1, $2, 'client', $3, 'Sample Building Manager')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['manager@sampleproperty.local', clientUserPasswordHash, clientId]
    );
    const clientUserId = clientUserRes.rows[0].id;

    // --- Material + floor plan template ---
    const materialRes = await client.query(
      `INSERT INTO materials_catalog (sku, name, category, unit_of_measure, internal_cost_basis)
       VALUES ('LVP-STD', 'Standard LVP', 'LVP', 'sqft', 1.85)
       ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const materialId = materialRes.rows[0].id;

    const templateRes = await client.query(
      `INSERT INTO floor_plan_templates (property_id, plan_name, room_manifest)
       VALUES ($1, 'The Aspen 2Bed/2Bath', $2::jsonb)
       RETURNING id`,
      [propertyId, JSON.stringify({ 'Living Room': { material_sku: 'LVP-STD', net_qty: 340, waste_pct: 12 } })]
    );
    const templateId = templateRes.rows[0].id;

    // --- Work order with one priced line item, to exercise the
    // pricing boundary test end-to-end ---
    const woRes = await client.query(
      `INSERT INTO work_orders (unit_id, floor_plan_template_id, submitted_by, status)
       VALUES ($1, $2, $3, 'priced') RETURNING id`,
      [unitId, templateId, clientUserId]
    );
    const workOrderId = woRes.rows[0].id;

    await client.query(
      `INSERT INTO work_order_line_items
         (work_order_id, material_id, room_name, quantity_calculated, unit_price_charged, internal_cost_basis, priced_by, priced_at)
       VALUES ($1, $2, 'Living Room', 380.80, 4.25, 1.85, $3, NOW())`,
      [workOrderId, materialId, adminRes.rows[0].id]
    );

    await client.query('COMMIT');

    const testToken = jwt.sign(
      { userId: clientUserId, role: 'client', clientId, email: 'manager@sampleproperty.local' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('\nSeed complete. For the pricing-boundary test, run:\n');
    console.log(`export TEST_CLIENT_TOKEN="${testToken}"`);
    console.log(`export TEST_WORK_ORDER_ID="${workOrderId}"`);
    console.log('npm test\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
