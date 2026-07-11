const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
// Vendors are a supplier/procurement concept tied to purchase orders —
// same visibility tier as inventory/POs, never client-visible.
router.use(requireAuth, requireRole('staff', 'admin'));

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          v.id, v.name, v.contact_name, v.phone, v.email, v.account_number, v.is_active, v.created_at,
          COUNT(po.id)::int AS purchase_order_count,
          COALESCE(SUM(poli.quantity * poli.unit_cost), 0) AS total_spend
       FROM vendors v
       LEFT JOIN purchase_orders po ON po.vendor_id = v.id
       LEFT JOIN purchase_order_line_items poli ON poli.purchase_order_id = po.id
       GROUP BY v.id
       ORDER BY v.is_active DESC, v.name`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Vendor list error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM vendors WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Vendor detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, contactName, phone, email, accountNumber } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO vendors (name, contact_name, phone, email, account_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), contactName || null, phone || null, email || null, accountNumber || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Vendor create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  const { name, contactName, phone, email, accountNumber, isActive } = req.body;
  try {
    const result = await pool.query(
      `UPDATE vendors SET
          name = COALESCE($1, name),
          contact_name = COALESCE($2, contact_name),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          account_number = COALESCE($5, account_number),
          is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [name || null, contactName || null, phone || null, email || null, accountNumber || null, isActive, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Vendor update error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /vendors/:id
 * Soft-delete only — vendors can be referenced by historical
 * purchase_orders.vendor_id, so this deactivates rather than removes.
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vendors SET is_active = false WHERE id = $1 RETURNING id, is_active`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Vendor deactivate error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
