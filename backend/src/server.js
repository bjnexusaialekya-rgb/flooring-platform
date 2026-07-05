require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const stripeWebhookRouter = require('./routes/stripeWebhook');
const qboRoutes = require('./routes/qboRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const unitRoutes = require('./routes/unitRoutes');
const floorPlanTemplateRoutes = require('./routes/floorPlanTemplateRoutes');
const projectTrackerRoutes = require('./routes/projectTrackerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userLookupRoutes = require('./routes/userLookupRoutes');
const clientBillingRoutes = require('./routes/clientBillingRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// General API rate limit — separate, tighter limit is applied to
// /auth/login inside authRoutes.js.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ------------------------------------------------------------------
// CRITICAL ORDERING: the Stripe webhook route is mounted here, BEFORE
// express.json(). stripeWebhook.js applies express.raw() itself, but
// that only works if no earlier global json parser has already
// consumed and parsed the body. Do not move this below the
// express.json() line. See precaution checklist item 1.3 / 2026-06
// session notes.
// ------------------------------------------------------------------
app.use('/', stripeWebhookRouter);

// Global JSON parser for every other route, registered AFTER the
// webhook route above.
app.use(express.json());

// Trim whitespace on all string body fields — catches accidental
// leading/trailing spaces from copy-paste (e.g. a UUID with a
// leading space failing validation further down the stack).
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/work-orders', workOrderRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/billing', billingRoutes);
app.use('/qbo', qboRoutes);
app.use('/payments', paymentRoutes);
app.use('/units', unitRoutes);
app.use('/floor-plan-templates', floorPlanTemplateRoutes);
app.use('/project-trackers', projectTrackerRoutes);
app.use('/reports', reportRoutes);
app.use('/users', userLookupRoutes);
app.use('/client-billing', clientBillingRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Fallback error handler — never let an unhandled error leak a stack
// trace to the client in production.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Flooring platform API listening on port ${PORT}`);
});
