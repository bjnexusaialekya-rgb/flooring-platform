// One-off script: replays a specific real Stripe event locally against
// our own webhook endpoint, signed with our CURRENT STRIPE_WEBHOOK_SECRET.
// Safe to delete after use — not part of the app.
//
// Usage: node replay_webhook.js
require('dotenv').config();
const Stripe = require('stripe');
const http = require('http');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// Real values pulled from `stripe payment_intents retrieve` output earlier.
const payload = JSON.stringify({
  id: 'evt_replay_' + Date.now(),
  object: 'event',
  api_version: '2026-06-24.dahlia',
  created: Math.floor(Date.now() / 1000),
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_3TuRBDDiQz25E6f72YNr19PU',
      object: 'payment_intent',
      amount: 1256640,
      amount_received: 1256640,
      currency: 'usd',
      metadata: { billingBatchId: '63016686-9519-477d-9ec2-e2c3cf1ad0f5' },
    },
  },
});

const secret = process.env.STRIPE_WEBHOOK_SECRET;
if (!secret) {
  console.error('STRIPE_WEBHOOK_SECRET not set in environment — aborting.');
  process.exit(1);
}

const header = stripe.webhooks.generateTestHeaderString({
  payload,
  secret,
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 4000,
    path: '/webhooks/stripe',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': header,
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', body);
    });
  }
);

req.on('error', (e) => console.error('Request error:', e.message));
req.write(payload);
req.end();
