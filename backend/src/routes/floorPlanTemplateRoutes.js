const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /floor-plan-templates
 * Same client-scoping principle as /units — a client user only sees
 * templates that belong to their own properties.
 */
router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'client') {
      query = `
        SELECT ft.id, ft.plan_name, ft.room_manifest
        FROM floor_plan_templates ft
        JOIN properties p ON p.id = ft.property_id
        WHERE p.client_id = $1
        ORDER BY ft.plan_name`;
      params = [req.user.clientId];
    } else {
      query = `SELECT id, plan_name, room_manifest FROM floor_plan_templates ORDER BY plan_name LIMIT 500`;
      params = [];
    }
    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List floor plan templates error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
