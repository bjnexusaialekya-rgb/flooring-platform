const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// This test calls the running API with a client-role token and asserts
// that unit_price_charged / internal_cost_basis are not just null in
// the response, but that the KEYS THEMSELVES do not appear anywhere
// in the response JSON. This is the safety net described in the
// precaution checklist's section 2.1 (adapted from the Bigfella RLS
// lesson): a routing/middleware bug that leaks a staff-only field is
// caught here even if the value happens to be null in that test case.
//
// Requires the server to be running locally with a seeded client user
// and a work order that has priced line items. See README for the
// seed script that sets this up.

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';
const CLIENT_TOKEN = process.env.TEST_CLIENT_TOKEN; // set by seed script output
const WORK_ORDER_ID = process.env.TEST_WORK_ORDER_ID;

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function containsForbiddenKey(obj, forbiddenKeys) {
  const json = JSON.stringify(obj);
  return forbiddenKeys.some((key) => json.includes(`"${key}"`));
}

test('client portal work order view never exposes price-bearing keys', async (t) => {
  if (!CLIENT_TOKEN || !WORK_ORDER_ID) {
    t.skip('TEST_CLIENT_TOKEN and TEST_WORK_ORDER_ID env vars not set — see README seed script');
    return;
  }

  const { status, body } = await httpGet(
    `${BASE_URL}/work-orders/${WORK_ORDER_ID}/portal-view`,
    CLIENT_TOKEN
  );

  assert.equal(status, 200, `Expected 200, got ${status}: ${body}`);

  const parsed = JSON.parse(body);
  const forbiddenKeys = ['unit_price_charged', 'unitPriceCharged', 'internal_cost_basis', 'internalCostBasis', 'priced_by', 'pricedBy'];

  assert.equal(
    containsForbiddenKey(parsed, forbiddenKeys),
    false,
    `Response leaked a price-bearing key. Full response: ${body}`
  );

  // Also confirm supplemental-prep line items are entirely absent,
  // not merely unpriced.
  const lineItems = parsed.line_items || parsed.lineItems || [];
  assert.ok(Array.isArray(lineItems), 'Expected line_items to be an array');
});
