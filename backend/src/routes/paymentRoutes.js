const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { createStripePaymentIntent } = require('../services/stripePaymentService');
const { createSquarePayment } = require('../services/squarePaymentService');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin'));

/**
 * POST /payments/create
 * Body: { billingBatchId, sourceId? }
 * sourceId is required only for Square. Stripe returns a clientSecret
 * for the frontend to confirm via Stripe.js instead.
 *
 * Which provider is active is a single env var (PAYMENT_PROVIDER),
 * since the client's RFP explicitly said "Stripe or Square — not yet
 * decided." Flip the env var once they choose; no code changes needed.
 */
router.post('/create', async (req, res) => {
  const { billingBatchId, sourceId } = req.body;
  if (!billingBatchId) {
    return res.status(400).json({ error: 'billingBatchId is required' });
  }

  const provider = (process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase();

  try {
    if (provider === 'stripe') {
      const result = await createStripePaymentIntent(billingBatchId);
      return res.status(201).json({ provider: 'stripe', ...result });
    }
    if (provider === 'square') {
      const result = await createSquarePayment(billingBatchId, sourceId);
      return res.status(201).json({ provider: 'square', ...result });
    }
    return res.status(500).json({ error: `Unknown PAYMENT_PROVIDER '${provider}' — must be stripe or square` });
  } catch (err) {
    console.error('Payment creation error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
