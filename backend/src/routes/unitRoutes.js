const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /units/properties
 * Simple id+name list for populating dropdowns (e.g. the Billing page
 * property selector), instead of admin needing to know a raw UUID.
 */
router.get('/properties', requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { pool } = require('../db/pool');
    const { clientId } = req.query;
    const query = clientId
      ? 'SELECT id, name FROM properties WHERE client_id = $1 ORDER BY name'
      : 'SELECT id, name FROM properties ORDER BY name';
    const params = clientId ? [clientId] : [];
    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List properties error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /units
 * Client role sees only units within their own client_id's properties
 * (what they're allowed to submit work orders against). Staff/admin
 * see everything.
 */
router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'client') {
      query = `
        SELECT u.id, u.unit_number, b.building_identifier
        FROM units u
        JOIN buildings b ON b.id = u.building_id
        JOIN properties p ON p.id = b.property_id
        WHERE p.client_id = $1 AND ($2::uuid IS NULL OR p.id = $2)
        ORDER BY b.building_identifier, u.unit_number`;
      params = [req.user.clientId, req.user.propertyId || null];
    } else {
      query = `
        SELECT u.id, u.unit_number, b.building_identifier
        FROM units u
        JOIN buildings b ON b.id = u.building_id
        ORDER BY b.building_identifier, u.unit_number
        LIMIT 500`;
      params = [];
    }
    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List units error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
