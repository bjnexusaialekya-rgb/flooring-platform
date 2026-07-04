const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin'));

/**
 * POST /billing/consolidated-statement
 * Groups all 'completed' work orders for a property within a date
 * range into one billing_batch, per the client's stated preference
 * for one statement, not dozens of tiny invoices.
 */
router.post('/consolidated-statement', async (req, res) => {
  const { propertyId, startDate, endDate } = req.body;
  if (!propertyId || !startDate || !endDate) {
    return res.status(400).json({ error: 'propertyId, startDate, endDate are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchRes = await client.query(
      `INSERT INTO billing_batches (property_id, batch_status, billing_period_start, billing_period_end)
       VALUES ($1, 'open', $2, $3) RETURNING id`,
      [propertyId, startDate, endDate]
    );
    const batchId = batchRes.rows[0].id;

    const lockedRes = await client.query(
      `UPDATE work_orders wo
       SET billing_batch_id = $1, status = 'billing_approved'
       WHERE wo.id IN (
         SELECT wo2.id FROM work_orders wo2
         JOIN units u ON u.id = wo2.unit_id
         JOIN buildings b ON b.id = u.building_id
         WHERE b.property_id = $2
           AND wo2.status = 'completed'
           AND wo2.billing_batch_id IS NULL
           AND wo2.created_at::date BETWEEN $3::date AND $4::date
       )
       RETURNING wo.id`,
      [batchId, propertyId, startDate, endDate]
    );

    if (lockedRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No completed work orders found for this property/period' });
    }

    await client.query('COMMIT');
    return res.status(201).json({ billingBatchId: batchId, workOrdersBatched: lockedRes.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Consolidated statement error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * GET /billing/batches/:id
 * Full breakdown of a batch, INCLUDING price fields — this route is
 * staff/admin only (enforced above), so the pricing-blind boundary
 * does not apply here. Client-facing views must use the work-orders
 * portal-view route instead, never this one.
 */
router.get('/batches/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          bb.id, bb.batch_status, bb.billing_period_start, bb.billing_period_end,
          json_agg(json_build_object(
            'workOrderId', wo.id,
            'poNumber', wo.po_number,
            'lineItems', (
              SELECT json_agg(json_build_object(
                'roomName', woli.room_name,
                'quantity', woli.quantity_calculated,
                'unitPriceCharged', woli.unit_price_charged,
                'lineTotal', woli.quantity_calculated * woli.unit_price_charged
              ))
              FROM work_order_line_items woli WHERE woli.work_order_id = wo.id
            )
          )) AS work_orders
       FROM billing_batches bb
       JOIN work_orders wo ON wo.billing_batch_id = bb.id
       WHERE bb.id = $1
       GROUP BY bb.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Billing batch not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Batch detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
