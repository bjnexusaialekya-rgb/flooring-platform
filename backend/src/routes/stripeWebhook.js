const express = require('express');
const Stripe = require('stripe');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not set — rejecting webhook');
      return res.status(500).send('Webhook secret not configured');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const client = await pool.connect();
    try {
      const existing = await client.query(`SELECT id FROM processed_webhooks WHERE stripe_event_id = $1`, [event.id]);
      if (existing.rows.length > 0) {
        return res.status(200).json({ received: true, duplicate: true });
      }

      await client.query(`INSERT INTO processed_webhooks (stripe_event_id) VALUES ($1)`, [event.id]);

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
            const billingBatchId = updated.rows[0].billing_batch_id;

            await client.query(`UPDATE billing_batches SET batch_status = 'closed' WHERE id = $1`, [billingBatchId]);

            try {
              const { syncBatchToQuickBooks, markQboInvoicePaid, downloadInvoicePdf } = require('../services/qboSyncWorker');
              const syncResult = await syncBatchToQuickBooks(billingBatchId);

              if (syncResult.qboInvoiceId) {
                await markQboInvoicePaid(syncResult.qboInvoiceId, Number(intent.amount_received) / 100);

                try {
                  const recipientRes = await client.query(
                    `SELECT u.email, u.display_name AS recipient_name,
                            p.name AS property_name, bb.billing_period_start,
                            bb.billing_period_end, bb.qbo_invoice_id
                     FROM billing_batches bb
                     JOIN properties p ON p.id = bb.property_id
                     JOIN clients c ON c.id = p.client_id
                     JOIN users u ON u.client_id = c.id AND u.role = 'client'
                     WHERE bb.id = $1
                     LIMIT 1`,
                    [billingBatchId]
                  );

                  if (recipientRes.rows.length > 0) {
                    const recipient = recipientRes.rows[0];
                    const { sendPaymentConfirmationEmail } = require('../services/emailService');
                    const pdfBuffer = await downloadInvoicePdf(recipient.qbo_invoice_id);

                    await sendPaymentConfirmationEmail({
                      to: recipient.email,
                      recipientName: recipient.recipient_name,
                      propertyName: recipient.property_name,
                      amount: Number(intent.amount_received) / 100,
                      billingPeriodStart: recipient.billing_period_start,
                      billingPeriodEnd: recipient.billing_period_end,
                      invoiceNumber: recipient.qbo_invoice_id,
                      pdfBuffer,
                    });
                  } else {
                    console.error(`No client-role user found for billing batch ${billingBatchId} — skipping payment confirmation email`);
                  }
                } catch (emailErr) {
                  console.error('Payment confirmation email failed (non-fatal):', emailErr.message);
                }
              }
            } catch (qboErr) {
              console.error('Auto QBO sync/mark-paid after payment failed:', qboErr.message);
            }
          } else {
            console.error(`No payments row found for succeeded PaymentIntent ${intent.id}`);
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const intent = event.data.object;
          await client.query(
            `UPDATE payments SET status = 'failed' WHERE provider = 'stripe' AND provider_reference_id = $1`,
            [intent.id]
          );
          break;
        }
        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      // A unique-violation here (23505) means two near-simultaneous
      // deliveries of the same Stripe event both passed the "not yet
      // processed" check before either INSERT committed — Stripe does
      // occasionally send duplicates close together. That race is
      // benign: the other request is handling this event, so tell
      // Stripe not to retry rather than surfacing it as a failure.
      if (err.code === '23505') {
        return res.status(200).json({ received: true, duplicate: true });
      }
      console.error('Stripe webhook processing error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
