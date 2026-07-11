const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin'));

const VALID_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          po.id, po.status, po.created_at, po.created_by, po.vendor_id,
          u.display_name AS created_by_name,
          v.name AS vendor_name,
          COUNT(poli.id) AS line_item_count,
          COALESCE(SUM(poli.quantity * poli.unit_cost), 0) AS total_cost
       FROM purchase_orders po
       LEFT JOIN purchase_order_line_items poli ON poli.purchase_order_id = po.id
       LEFT JOIN users u ON u.id = po.created_by
       LEFT JOIN vendors v ON v.id = po.vendor_id
       GROUP BY po.id, u.display_name, v.name
       ORDER BY po.created_at DESC`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Purchase order list error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const poRes = await pool.query(
      `SELECT po.id, po.status, po.created_at, po.created_by, po.vendor_id,
              u.display_name AS created_by_name, v.name AS vendor_name
       FROM purchase_orders po
       LEFT JOIN users u ON u.id = po.created_by
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (poRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const lineItemsRes = await pool.query(
      `SELECT poli.id, poli.material_id, mc.sku, mc.name, poli.quantity, poli.unit_cost,
              (poli.quantity * poli.unit_cost) AS line_total
       FROM purchase_order_line_items poli
       JOIN materials_catalog mc ON mc.id = poli.material_id
       WHERE poli.purchase_order_id = $1
       ORDER BY mc.name`,
      [req.params.id]
    );

    return res.status(200).json({ ...poRes.rows[0], lineItems: lineItemsRes.rows });
  } catch (err) {
    console.error('Purchase order detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { lineItems, vendorId } = req.body;
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: 'lineItems array is required' });
  }
  for (const item of lineItems) {
    if (!item.materialId || item.quantity === undefined || item.unitCost === undefined) {
      return res.status(400).json({ error: 'Each line item requires materialId, quantity, unitCost' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const poRes = await client.query(
      `INSERT INTO purchase_orders (created_by, status, vendor_id) VALUES ($1, 'draft', $2) RETURNING id, status, created_at, vendor_id`,
      [req.user.userId, vendorId || null]
    );
    const poId = poRes.rows[0].id;

    for (const item of lineItems) {
      await client.query(
        `INSERT INTO purchase_order_line_items (purchase_order_id, material_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [poId, item.materialId, item.quantity, item.unitCost]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json(poRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Purchase order create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status: newStatus } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(`SELECT status FROM purchase_orders WHERE id = $1`, [req.params.id]);
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const currentStatus = current.rows[0].status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
        allowedNext,
      });
    }

    if (newStatus === 'received') {
      const lineItemsRes = await client.query(
        `SELECT material_id, quantity FROM purchase_order_line_items WHERE purchase_order_id = $1`,
        [req.params.id]
      );
      for (const row of lineItemsRes.rows) {
        await client.query(
          `INSERT INTO inventory_stock (material_id, quantity_on_hand)
           VALUES ($1, $2)
           ON CONFLICT (material_id)
           DO UPDATE SET quantity_on_hand = inventory_stock.quantity_on_hand + $2`,
          [row.material_id, row.quantity]
        );
        await client.query(
          `INSERT INTO inventory_adjustments (material_id, delta, reason, adjusted_by)
           VALUES ($1, $2, 'purchase_order_received', $3)`,
          [row.material_id, row.quantity, req.user.userId]
        );
      }
    }

    const updated = await client.query(
      `UPDATE purchase_orders SET status = $1 WHERE id = $2 RETURNING id, status`,
      [newStatus, req.params.id]
    );

    await client.query('COMMIT');
    return res.status(200).json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Purchase order status transition error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
