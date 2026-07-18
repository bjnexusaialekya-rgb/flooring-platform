const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
// Installers are an internal ops concept (crew assignment), same visibility
// tier as inventory/purchase orders — never client-visible.
router.use(requireAuth, requireRole('staff', 'admin'));

const SPECIALTIES = ['LVP', 'Carpet', 'Sheet Vinyl', 'Tile', 'Hardwood', 'General'];

/**
 * GET /installers
 * List installers with their current open work-order count, so staff
 * can see crew load at a glance when assigning a new job.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          i.id, i.name, i.phone, i.email, i.specialty, i.crew_capacity, i.is_active, i.created_at,
          COUNT(wo.id) FILTER (
            WHERE wo.status NOT IN ('completed', 'billing_approved', 'invoiced')
          )::int AS open_work_order_count
       FROM installers i
       LEFT JOIN work_orders wo ON wo.installer_id = i.id
       GROUP BY i.id
       ORDER BY i.is_active DESC, i.name
       LIMIT 1000`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Installer list error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM installers WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Installer not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Installer detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, phone, email, specialty, crewCapacity } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (specialty && !SPECIALTIES.includes(specialty)) {
    return res.status(400).json({ error: `specialty must be one of: ${SPECIALTIES.join(', ')}` });
  }
  try {
    const result = await pool.query(
      `INSERT INTO installers (name, phone, email, specialty, crew_capacity)
       VALUES ($1, $2, $3, $4, COALESCE($5, 1))
       RETURNING *`,
      [name.trim(), phone || null, email || null, specialty || null, crewCapacity || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Installer create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const { name, phone, email, specialty, crewCapacity, isActive } = req.body;
  if (specialty && !SPECIALTIES.includes(specialty)) {
    return res.status(400).json({ error: `specialty must be one of: ${SPECIALTIES.join(', ')}` });
  }
  try {
    const result = await pool.query(
      `UPDATE installers SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          email = COALESCE($3, email),
          specialty = COALESCE($4, specialty),
          crew_capacity = COALESCE($5, crew_capacity),
          is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [name || null, phone || null, email || null, specialty || null, crewCapacity || null, isActive, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Installer not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Installer update error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /installers/:id
 * Soft-delete only (is_active = false) — installers can be referenced
 * by historical work_orders.installer_id, so a hard delete would either
 * fail the FK or silently null out job history. Deactivating preserves
 * the audit trail and just removes them from active-assignment lists.
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE installers SET is_active = false WHERE id = $1 RETURNING id, is_active`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Installer not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Installer deactivate error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
