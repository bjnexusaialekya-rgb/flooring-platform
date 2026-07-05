const axios = require('axios');
const { pool } = require('../db/pool');
const { getValidAccessToken } = require('./qboTokenManager');

/**
 * Pushes ONE consolidated invoice per billing_batch to QuickBooks —
 * this is the whole point of the batching step: corporate AP gets one
 * statement per property per period, not one invoice per work order.
 * On any failure, the raw payload and error are written to
 * qbo_sync_failures instead of being silently dropped, per the
 * precaution checklist's dead-letter requirement.
 */
async function syncBatchToQuickBooks(batchId) {
  // Idempotency guard: never push a second invoice for a batch that
  // already has one. Without this, clicking Sync twice (double-click,
  // retry, re-opened tab) would double-bill the client in QuickBooks.
  const existing = await pool.query(
    `SELECT qbo_invoice_id FROM billing_batches WHERE id = $1`,
    [batchId]
  );
  if (existing.rows.length === 0) {
    throw new Error(`Billing batch ${batchId} not found`);
  }
  if (existing.rows[0].qbo_invoice_id) {
    return { success: true, qboInvoiceId: existing.rows[0].qbo_invoice_id, alreadySynced: true };
  }

  const compiled = await pool.query(
    `SELECT
        c.corporate_name,
        p.name AS property_name,
        b.building_identifier,
        u.unit_number,
        mc.sku,
        mc.name AS material_name,
        woli.quantity_calculated,
        woli.unit_price_charged
     FROM billing_batches bb
     JOIN work_orders wo ON wo.billing_batch_id = bb.id
     JOIN work_order_line_items woli ON woli.work_order_id = wo.id AND woli.is_supplemental_prep = false
     JOIN materials_catalog mc ON mc.id = woli.material_id
     JOIN units u ON u.id = wo.unit_id
     JOIN buildings b ON b.id = u.building_id
     JOIN properties p ON p.id = b.property_id
     JOIN clients c ON c.id = p.client_id
     WHERE bb.id = $1`,
    [batchId]
  );

  if (compiled.rows.length === 0) {
    throw new Error(`No billable line items found for batch ${batchId}`);
  }

  const qboLineItems = compiled.rows.map((row, index) => ({
    LineNum: index + 1,
    Description: `${row.property_name} | ${row.building_identifier} Unit ${row.unit_number} — ${row.material_name}`,
    Amount: Number((row.quantity_calculated * row.unit_price_charged).toFixed(2)),
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: { name: row.sku },
      UnitPrice: Number(row.unit_price_charged),
      Qty: Number(row.quantity_calculated),
    },
  }));

  const invoicePayload = {
    Line: qboLineItems,
    CustomerRef: { name: compiled.rows[0].corporate_name },
  };

  try {
    const accessToken = await getValidAccessToken(process.env.QBO_REALM_ID);
    const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${process.env.QBO_REALM_ID}/invoice`;

    const qboResponse = await axios.post(endpoint, invoicePayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const qboInvoiceId = qboResponse.data.Invoice.Id;
    await pool.query(
      `UPDATE billing_batches SET batch_status = 'synced_to_qbo', qbo_invoice_id = $1 WHERE id = $2`,
      [qboInvoiceId, batchId]
    );

    return { success: true, qboInvoiceId };
  } catch (err) {
    // Dead-letter: never let a rejected/throttled QBO payload vanish
    // silently. The accounting team must be able to see and retry it.
    await pool.query(
      `INSERT INTO qbo_sync_failures (billing_batch_id, raw_payload, error_message)
       VALUES ($1, $2, $3)`,
      [batchId, JSON.stringify(invoicePayload), JSON.stringify(err.response?.data || err.message)]
    );
    throw err;
  }
}

module.exports = { syncBatchToQuickBooks };
