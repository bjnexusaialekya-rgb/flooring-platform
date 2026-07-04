const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin'));

/**
 * GET /users?role=staff
 * Minimal lookup — just enough to populate an "assign to" dropdown.
 * Never returns password_hash or any other sensitive field.
 */
router.get('/', async (req, res) => {
  try {
    const roleFilter = req.query.role;
    const result = await pool.query(
      roleFilter
        ? `SELECT id, display_name, email, role FROM users WHERE role = $1 AND is_active = true ORDER BY display_name`
        : `SELECT id, display_name, email, role FROM users WHERE is_active = true ORDER BY display_name`,
      roleFilter ? [roleFilter] : []
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List users error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
