const axios = require('axios');
const { pool } = require('../db/pool');
const { getValidAccessToken, getActiveRealmId } = require('./qboTokenManager');

function escapeQboString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function qboQuery(accessToken, realmId, query) {
  const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${realmId}/query`;
  const res = await axios.get(endpoint, {
    params: { query },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  return res.data.QueryResponse || {};
}

// Sandbox QBO companies start empty — Customer/Item records referenced
// by name don't exist yet, and QBO requires the internal Id, not the
// name, on invoice lines. This looks the record up first and creates
// it on the fly if missing, so the sandbox "fills itself in" as real
// batches get synced.
async function findOrCreateCustomer(accessToken, realmId, corporateName) {
  const safeName = escapeQboString(corporateName);
  const found = await qboQuery(
    accessToken,
    realmId,
    `SELECT Id FROM Customer WHERE DisplayName = '${safeName}'`
  );
  if (found.Customer && found.Customer.length > 0) {
    return found.Customer[0].Id;
  }

  const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${realmId}/customer`;
  const created = await axios.post(
    endpoint,
    { DisplayName: corporateName },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
  return created.data.Customer.Id;
}

// Keyed by realmId rather than a single module-level value — a
// reconnect to a different QBO company (new realm) must not reuse a
// cached Income account Id from the previous company.
const cachedIncomeAccountIdByRealm = {};
async function getIncomeAccountId(accessToken, realmId) {
  if (cachedIncomeAccountIdByRealm[realmId]) return cachedIncomeAccountIdByRealm[realmId];
  const result = await qboQuery(
    accessToken,
    realmId,
    `SELECT Id FROM Account WHERE AccountType = 'Income' MAXRESULTS 1`
  );
  if (!result.Account || result.Account.length === 0) {
    throw new Error('No Income account found in QBO sandbox — cannot create Item');
  }
  cachedIncomeAccountIdByRealm[realmId] = result.Account[0].Id;
  return cachedIncomeAccountIdByRealm[realmId];
}

async function findOrCreateItem(accessToken, realmId, sku, materialName) {
  const safeSku = escapeQboString(sku);
  const found = await qboQuery(
    accessToken,
    realmId,
    `SELECT Id FROM Item WHERE Name = '${safeSku}'`
  );
  if (found.Item && found.Item.length > 0) {
    return found.Item[0].Id;
  }

  const incomeAccountId = await getIncomeAccountId(accessToken, realmId);
  const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${realmId}/item`;
  const created = await axios.post(
    endpoint,
    {
      Name: sku,
      Type: 'Service',
      IncomeAccountRef: { value: incomeAccountId },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
  return created.data.Item.Id;
}

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

  let invoicePayload;
  try {
    // Resolve the connected company from the DB, not a static env var
    // — see getActiveRealmId's doc comment for why this was broken.
    const realmId = await getActiveRealmId();
    const accessToken = await getValidAccessToken(realmId);

    // Resolve real QBO internal Ids before building the payload —
    // QBO rejects name-only refs with an opaque NumberFormatException
    // when the sandbox has no matching record yet.
    const customerId = await findOrCreateCustomer(accessToken, realmId, compiled.rows[0].corporate_name);

    const itemIdBySku = {};
    for (const row of compiled.rows) {
      if (!itemIdBySku[row.sku]) {
        itemIdBySku[row.sku] = await findOrCreateItem(accessToken, realmId, row.sku, row.material_name);
      }
    }

    const qboLineItems = compiled.rows.map((row, index) => ({
      LineNum: index + 1,
      Description: `${row.property_name} | ${row.building_identifier} Unit ${row.unit_number} — ${row.material_name}`,
      Amount: Number((row.quantity_calculated * row.unit_price_charged).toFixed(2)),
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: itemIdBySku[row.sku] },
        UnitPrice: Number(row.unit_price_charged),
        Qty: Number(row.quantity_calculated),
      },
    }));

    invoicePayload = {
      Line: qboLineItems,
      CustomerRef: { value: customerId },
    };

    const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${realmId}/invoice`;

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
      [batchId, JSON.stringify(invoicePayload || null), JSON.stringify(err.response?.data || err.message)]
    );
    throw err;
  }
}

async function markQboInvoicePaid(qboInvoiceId, amountPaid) {
  const realmId = await getActiveRealmId();
  const accessToken = await getValidAccessToken(realmId);

  // QBO's Payment endpoint requires a CustomerRef on every payment --
  // fetch the invoice first so we use the exact customer QBO already
  // has on file for it, rather than re-deriving via findOrCreateCustomer
  // (which risks creating/matching a different customer record).
  const invoiceRes = await axios.get(
    `${process.env.QBO_BASE_URL}/v3/company/${realmId}/invoice/${qboInvoiceId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );
  const customerId = invoiceRes.data.Invoice.CustomerRef.value;

  const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${realmId}/payment`;

  await axios.post(
    endpoint,
    {
      TotalAmt: amountPaid,
      CustomerRef: { value: customerId },
      Line: [
        {
          Amount: amountPaid,
          LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: 'Invoice' }],
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );
}

async function downloadInvoicePdf(qboInvoiceId) {
  const realmId = await getActiveRealmId();
  const accessToken = await getValidAccessToken(realmId);
  const endpoint = `${process.env.QBO_BASE_URL}/v3/company/${realmId}/invoice/${qboInvoiceId}/pdf`;
  const response = await axios.get(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/pdf' },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

module.exports = { syncBatchToQuickBooks, markQboInvoicePaid, downloadInvoicePdf };
