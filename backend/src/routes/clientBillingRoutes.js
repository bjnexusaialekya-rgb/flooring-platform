const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { createStripePaymentIntent } = require('../services/stripePaymentService');
const { createSquarePayment } = require('../services/squarePaymentService');

const router = express.Router();
router.use(requireAuth, requireRole('client'));

/**
 * GET /client-billing/my-statements
 * Lists billing batches for properties belonging to the caller's own
 * client_id only. Shows the invoice total (the client must know what
 * they owe) but never internal_cost_basis — that stays staff-only,
 * same discipline as the pricing-blind boundary elsewhere.
 */
router.get('/my-statements', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bb.id, bb.batch_status, bb.qbo_invoice_id, bb.billing_period_start,
              bb.billing_period_end, bb.created_at, p.name AS property_name,
              COALESCE(SUM(woli.quantity_calculated * woli.unit_price_charged), 0) AS total_amount
       FROM billing_batches bb
       JOIN properties p ON p.id = bb.property_id
       LEFT JOIN work_orders wo ON wo.billing_batch_id = bb.id
       LEFT JOIN work_order_line_items woli ON woli.work_order_id = wo.id AND woli.is_supplemental_prep = false
       WHERE p.client_id = $1 AND ($2::uuid IS NULL OR p.id = $2)
       GROUP BY bb.id, p.name
       ORDER BY bb.created_at DESC`,
      [req.user.clientId, req.user.propertyId || null]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Client billing list error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /client-billing/pay
 * Body: { billingBatchId }
 * Ownership is verified here before ever calling the payment service —
 * a client may only pay a batch that belongs to their own client_id.
 */
router.post('/pay', async (req, res) => {
  const { billingBatchId } = req.body;
  if (!billingBatchId) {
    return res.status(400).json({ error: 'billingBatchId is required' });
  }
  try {
    const ownership = await pool.query(
      `SELECT p.client_id, p.id AS property_id FROM billing_batches bb JOIN properties p ON p.id = bb.property_id WHERE bb.id = $1`,
      [billingBatchId]
    );
    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    if (ownership.rows[0].client_id !== req.user.clientId) {
      return res.status(403).json({ error: 'Not authorized to pay this statement' });
    }
    if (req.user.propertyId && ownership.rows[0].property_id !== req.user.propertyId) {
      return res.status(403).json({ error: 'Not authorized to pay this statement' });
    }

    const provider = (process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase();
    if (provider === 'stripe') {
      const result = await createStripePaymentIntent(billingBatchId);
      return res.status(201).json({ provider: 'stripe', ...result });
    }
    if (provider === 'square') {
      const result = await createSquarePayment(billingBatchId, req.body.sourceId);
      return res.status(201).json({ provider: 'square', ...result });
    }
    return res.status(500).json({ error: `Unknown PAYMENT_PROVIDER '${provider}'` });
  } catch (err) {
    console.error('Client payment error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
