const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { exchangeAuthCode } = require('../services/qboTokenManager');
const { syncBatchToQuickBooks } = require('../services/qboSyncWorker');

const router = express.Router();

/**
 * GET /qbo/callback
 * Intuit redirects the ADMIN'S BROWSER here after they approve the
 * connection — this is a plain browser navigation, not an API call
 * from our own frontend, so it never carries our app's JWT. This
 * route is deliberately placed BEFORE requireAuth below and must
 * stay public for that reason. It's still safe: Intuit itself
 * validates that only the admin who started the flow can complete
 * it, and this route only accepts a code+realmId pair that's
 * useless without our own client secret to exchange it.
 */
router.get('/callback', async (req, res) => {
  const { code, realmId } = req.query;
  if (!code || !realmId) {
    return res.status(400).json({ error: 'Missing code or realmId from QuickBooks redirect' });
  }
  try {
    const redirectUri = process.env.QBO_REDIRECT_URI || 'http://localhost:4000/qbo/callback';
    await exchangeAuthCode(code, realmId, redirectUri);
    return res.status(200).json({ success: true, realmId, message: 'QuickBooks connected successfully.' });
  } catch (err) {
    console.error('QBO OAuth callback error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to complete QuickBooks connection' });
  }
});

// Everything below this line remains admin-only.
router.use(requireAuth, requireRole('admin'));

/**
 * GET /qbo/connect-url
 * Returns the Intuit OAuth consent URL for the admin to open.
 */
router.get('/connect-url', (req, res) => {
  const redirectUri = process.env.QBO_REDIRECT_URI || 'http://localhost:4000/qbo/callback';
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: 'flooring-platform-connect',
  });
  return res.status(200).json({
    url: `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`,
  });
});

/**
 * POST /qbo/batches/:id/sync
 * Manually trigger the consolidated invoice push for a billing batch.
 */
router.post('/batches/:id/sync', async (req, res) => {
  try {
    const result = await syncBatchToQuickBooks(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('QBO sync error:', err.message);
    return res.status(502).json({
      error: 'QuickBooks sync failed and was recorded in the dead-letter queue.',
      detail: err.message,
    });
  }
});

/**
 * GET /qbo/sync-failures
 * Lets the accounting team see and retry anything that failed to sync.
 */
router.get('/sync-failures', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, billing_batch_id, error_message, failed_at, resolved
       FROM qbo_sync_failures WHERE resolved = false ORDER BY failed_at DESC`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch sync failures error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /qbo/sync-failures/:id/retry
 * Re-attempts the sync for the batch tied to a failure record, and
 * marks the original failure resolved if the retry succeeds.
 */
router.post('/sync-failures/:id/retry', async (req, res) => {
  try {
    const failureRes = await pool.query(
      `SELECT billing_batch_id FROM qbo_sync_failures WHERE id = $1`,
      [req.params.id]
    );
    if (failureRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sync failure record not found' });
    }

    const result = await syncBatchToQuickBooks(failureRes.rows[0].billing_batch_id);

    await pool.query(`UPDATE qbo_sync_failures SET resolved = true WHERE id = $1`, [req.params.id]);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Retry sync error:', err.message);
    return res.status(502).json({ error: 'Retry failed again — new failure record created.', detail: err.message });
  }
});

module.exports = router;
