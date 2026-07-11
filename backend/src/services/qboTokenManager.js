const axios = require('axios');
const { pool } = require('../db/pool');

const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

/**
 * Exchanges an authorization code for the first access/refresh token
 * pair. Called once, from the OAuth redirect handler in qboRoutes.js.
 */
async function exchangeAuthCode(authCode, realmId, redirectUri) {
  const basicAuth = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    QBO_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
    }),
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    }
  );

  await storeTokens(realmId, response.data);
  return response.data;
}

async function storeTokens(realmId, tokenData) {
  const accessExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const refreshExpiresAt = new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000);

  await pool.query(
    `INSERT INTO qbo_tokens (realm_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (realm_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
       updated_at = NOW()`,
    [realmId, tokenData.access_token, tokenData.refresh_token, accessExpiresAt, refreshExpiresAt]
  );
}

/**
 * Proactive refresh: called BEFORE the token is used, not after a 401.
 * QBO access tokens expire at 60 minutes; this refreshes once the
 * token is within 10 minutes of expiry (i.e. at ~50 min), matching
 * the locked Phase 3 decision from the master blueprint. The rotated
 * refresh token is always overwritten in storage — QBO issues a new
 * refresh token on every refresh call, and reusing a stale one is a
 * silent-failure trap.
 */
async function getValidAccessToken(realmId) {
  const result = await pool.query(`SELECT * FROM qbo_tokens WHERE realm_id = $1`, [realmId]);
  if (result.rows.length === 0) {
    throw new Error(`No QBO tokens on file for realm ${realmId} — run the OAuth connect flow first`);
  }
  const row = result.rows[0];

  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
  const needsRefresh = new Date(row.access_token_expires_at) < tenMinutesFromNow;

  if (!needsRefresh) {
    return row.access_token;
  }

  if (new Date(row.refresh_token_expires_at) < new Date()) {
    // Refresh token itself is dead (100 day life) — this requires
    // human re-authorization. Fail loud with a specific message
    // rather than a generic 401 downstream, per the precaution
    // checklist's "self-healing, alert if human re-auth is required."
    throw new Error(
      `QBO refresh token expired for realm ${realmId}. Re-authorization required — an admin must reconnect QuickBooks.`
    );
  }

  const basicAuth = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    QBO_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    }
  );

  await storeTokens(realmId, response.data);
  return response.data.access_token;
}

/**
 * Resolves which QuickBooks company (realm) this app is currently
 * connected to, by reading qbo_tokens directly instead of trusting a
 * static QBO_REALM_ID env var.
 *
 * This was the actual bug blocking sync: the OAuth callback in
 * qboRoutes.js stores tokens under whatever realmId Intuit assigns at
 * connect time (correct — that's dynamic per-connection data), but
 * every downstream sync call in qboSyncWorker.js was reading a
 * separate, manually-set env var that's blank by default. A
 * successful "Connect to QuickBooks" click still didn't make sync
 * work unless someone also hand-copied the realm ID into .env and
 * restarted the server.
 *
 * This app connects to one QuickBooks company at a time (per the
 * RFP), so "the realm with the most recently updated tokens" is
 * unambiguous and needs no extra config.
 */
async function getActiveRealmId() {
  const result = await pool.query(
    `SELECT realm_id FROM qbo_tokens ORDER BY updated_at DESC LIMIT 1`
  );
  if (result.rows.length === 0) {
    throw new Error(
      'QuickBooks is not connected yet — an admin must complete the OAuth connect flow (GET /qbo/connect-url) first.'
    );
  }
  return result.rows[0].realm_id;
}

module.exports = { exchangeAuthCode, getValidAccessToken, getActiveRealmId };
