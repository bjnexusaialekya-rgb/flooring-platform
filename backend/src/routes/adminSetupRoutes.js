const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/**
 * GET /admin-setup/clients
 * Simple id+name list for populating dropdowns during onboarding.
 */
router.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, corporate_name FROM clients ORDER BY corporate_name');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List clients error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin-setup/clients
 * Creates a brand-new corporate client (company). This is the step
 * that previously required a direct database INSERT before a new
 * property manager's login could be created at all.
 */
router.post('/clients', async (req, res) => {
  const { corporateName } = req.body;
  if (!corporateName) {
    return res.status(400).json({ error: 'corporateName is required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO clients (corporate_name) VALUES ($1) RETURNING id, corporate_name`,
      [corporateName]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create client error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin-setup/properties
 * Creates a property under an existing client. Required before any
 * work order, floor-plan template, or building/unit can exist for
 * that client.
 */
router.post('/properties', async (req, res) => {
  const { clientId, name, streetAddress, city, state, zipCode } = req.body;
  if (!clientId || !name) {
    return res.status(400).json({ error: 'clientId and name are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO properties (client_id, name, street_address, city, state, zip_code)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
      [clientId, name, streetAddress || null, city || null, state || null, zipCode || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create property error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
