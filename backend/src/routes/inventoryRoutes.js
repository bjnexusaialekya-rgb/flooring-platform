const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin')); // inventory is never client-visible

/**
 * GET /inventory
 * Current stock levels per material, with a reorder flag if below
 * the material's configured threshold.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          mc.id, mc.sku, mc.name, mc.category, mc.unit_of_measure,
          COALESCE(s.quantity_on_hand, 0) AS quantity_on_hand,
          COALESCE(s.reorder_threshold, 0) AS reorder_threshold,
          (COALESCE(s.quantity_on_hand, 0) <= COALESCE(s.reorder_threshold, 0)) AS needs_reorder
       FROM materials_catalog mc
       LEFT JOIN inventory_stock s ON s.material_id = mc.id
       WHERE mc.is_active = true
       ORDER BY mc.category, mc.name`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Inventory list error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /inventory/:materialId/adjust
 * Manual stock adjustment (receiving a shipment, correcting a count).
 * Positive delta = stock in, negative = stock out.
 */
router.post('/:materialId/adjust', async (req, res) => {
  const { delta, reason } = req.body;
  if (delta === undefined || Number.isNaN(Number(delta))) {
    return res.status(400).json({ error: 'delta (numeric) is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO inventory_stock (material_id, quantity_on_hand)
       VALUES ($1, $2)
       ON CONFLICT (material_id)
       DO UPDATE SET quantity_on_hand = inventory_stock.quantity_on_hand + $2
       RETURNING material_id, quantity_on_hand`,
      [req.params.materialId, delta]
    );

    await pool.query(
      `INSERT INTO inventory_adjustments (material_id, delta, reason, adjusted_by)
       VALUES ($1, $2, $3, $4)`,
      [req.params.materialId, delta, reason || null, req.user.userId]
    );

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Inventory adjust error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /inventory/purchase-orders
 * Creates a purchase order for materials flagged needs_reorder=true
 * (or any explicit list of materialIds).
 */
router.post('/purchase-orders', async (req, res) => {
  const { lineItems } = req.body; // [{ materialId, quantity, unitCost }]
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: 'lineItems array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const poRes = await client.query(
      `INSERT INTO purchase_orders (created_by, status) VALUES ($1, 'draft') RETURNING id`,
      [req.user.userId]
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
    return res.status(201).json({ purchaseOrderId: poId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Purchase order create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
