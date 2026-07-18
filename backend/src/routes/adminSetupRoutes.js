const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, corporate_name FROM clients ORDER BY corporate_name LIMIT 1000');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List clients error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/clients', async (req, res) => {
  const {
    corporateName,
    paymentTerms,
    depositType,
    depositValue,
    agreementSigned,
    agreementDate,
    advanceAgreed,
    advanceAmount,
  } = req.body;

  if (!corporateName) {
    return res.status(400).json({ error: 'corporateName is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clients (
         corporate_name, payment_terms, deposit_type, deposit_value,
         agreement_signed, agreement_date, advance_agreed, advance_amount
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, corporate_name, payment_terms, agreement_signed, advance_agreed, advance_amount`,
      [
        corporateName,
        paymentTerms || 'full_only',
        depositType || null,
        depositValue || null,
        agreementSigned === true,
        agreementSigned === true ? (agreementDate || null) : null,
        advanceAgreed === true,
        advanceAgreed === true ? (advanceAmount || null) : null,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create client error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/properties', async (req, res) => {
  const { clientId, name, streetAddress, city, state, zipCode } = req.body;
  if (!clientId || !name) {
    return res.status(400).json({ error: 'clientId and name are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO properties (client_id, name, street_address, city, state, zip_code)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
      [clientId, name, streetAddress || null, city || null, state || null, zipCode || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create property error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/payment-status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         c.corporate_name, p.name AS property_name, bb.id AS batch_id,
         bb.payment_stage, bb.batch_status, pay.status AS payment_status,
         pay.amount, bb.qbo_invoice_id, bb.created_at
       FROM billing_batches bb
       JOIN properties p ON p.id = bb.property_id
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN payments pay ON pay.billing_batch_id = bb.id
       ORDER BY bb.created_at DESC`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Payment status dashboard error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/advance-status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, corporate_name, advance_amount
       FROM clients
       WHERE advance_agreed = true AND advance_cleared = false`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Advance status error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/clients/:id/clear-advance', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE clients SET advance_cleared = true, advance_cleared_at = NOW()
       WHERE id = $1 AND advance_agreed = true
       RETURNING id, corporate_name, advance_cleared, advance_cleared_at`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found or no advance agreed' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Clear advance error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
