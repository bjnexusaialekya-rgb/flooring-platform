const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db/pool');

/**
 * Creates a Stripe PaymentIntent for the total of a billing batch.
 * The amount is computed server-side from the DB, never trusted from
 * the client — the same discipline as the pricing-blind boundary:
 * never let the caller supply a number that determines what gets
 * charged.
 */
async function createStripePaymentIntent(billingBatchId) {
  const totalRes = await pool.query(
    `SELECT COALESCE(SUM(woli.quantity_calculated * woli.unit_price_charged), 0) AS total
     FROM work_orders wo
     JOIN work_order_line_items woli ON woli.work_order_id = wo.id
     WHERE wo.billing_batch_id = $1`,
    [billingBatchId]
  );
  const totalAmount = Number(totalRes.rows[0].total);
  if (totalAmount <= 0) {
    throw new Error('Billing batch has no billable total — cannot create a payment intent for $0');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100), // Stripe expects cents
    currency: 'usd',
    metadata: { billingBatchId },
  });

  await pool.query(
    `INSERT INTO payments (billing_batch_id, provider, provider_reference_id, amount, status)
     VALUES ($1, 'stripe', $2, $3, 'pending')`,
    [billingBatchId, paymentIntent.id, totalAmount]
  );

  return { clientSecret: paymentIntent.client_secret, amount: totalAmount };
}

module.exports = { createStripePaymentIntent };
