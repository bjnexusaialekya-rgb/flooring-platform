const express = require('express');
const Stripe = require('stripe');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// ------------------------------------------------------------------
// CRITICAL: express.raw() must be scoped to THIS route only, and
// must be registered BEFORE any global express.json() middleware
// runs in server.js. If express.json() parses the body first,
// Stripe's signature check fails on every single request — this
// is the #1 cause of "signature verification failed" in production
// and it fails silently in the sense that the error message never
// points at middleware ordering as the cause.
// ------------------------------------------------------------------
router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      // Fail loud, not silent — an unset secret must never be
      // treated as "skip verification."
      console.error('STRIPE_WEBHOOK_SECRET is not set — rejecting webhook');
      return res.status(500).send('Webhook secret not configured');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotency: Stripe redelivers events on retry, and duplicate
    // delivery is expected behavior, not an edge case. Check before
    // doing anything, and record before processing so a crash
    // mid-handler doesn't cause a silent double-process on next retry.
    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT id FROM processed_webhooks WHERE stripe_event_id = $1`,
        [event.id]
      );
      if (existing.rows.length > 0) {
        // Already handled — acknowledge and stop, do not reprocess.
        return res.status(200).json({ received: true, duplicate: true });
      }

      await client.query(
        `INSERT INTO processed_webhooks (stripe_event_id) VALUES ($1)`,
        [event.id]
      );

      // Return 200 fast; do the actual invoice/payment-status update
      // work here or hand off to a queue. Keeping this handler light
      // avoids Stripe's timeout-triggered retry storms.
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const intent = event.data.object;
          const updated = await client.query(
            `UPDATE payments SET status = 'succeeded', completed_at = NOW()
             WHERE provider = 'stripe' AND provider_reference_id = $1
             RETURNING billing_batch_id`,
            [intent.id]
          );
          if (updated.rows.length > 0) {
            await client.query(
              `UPDATE billing_batches SET batch_status = 'closed' WHERE id = $1`,
              [updated.rows[0].billing_batch_id]
            );
          } else {
            // A succeeded PaymentIntent with no matching payments row
            // is a real anomaly (created outside this app, or the
            // insert in createStripePaymentIntent failed silently) —
            // log it loudly rather than treating it as a no-op.
            console.error(`No payments row found for succeeded PaymentIntent ${intent.id}`);
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const intent = event.data.object;
          await client.query(
            `UPDATE payments SET status = 'failed'
             WHERE provider = 'stripe' AND provider_reference_id = $1`,
            [intent.id]
          );
          break;
        }
        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
