const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin')); // internal-only, like the RFP describes it

/**
 * GET /project-trackers
 * Lightweight list — this is deliberately NOT a full project
 * management view (Gantt charts, task breakdowns, etc). It's a
 * summary tracker, per the RFP's own description of the module.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pt.id, pt.project_name, pt.status, pt.start_date, pt.target_end_date,
              pt.summary_labor_total, pt.summary_material_total,
              p.name AS property_name
       FROM project_trackers pt
       JOIN properties p ON p.id = pt.property_id
       ORDER BY pt.start_date DESC`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List project trackers error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /project-trackers
 * Creates a new tracked project.
 */
router.post('/', async (req, res) => {
  const { propertyId, projectName, startDate, targetEndDate, estimatorId, notes } = req.body;
  if (!propertyId || !projectName || !startDate || !targetEndDate) {
    return res.status(400).json({ error: 'propertyId, projectName, startDate, targetEndDate are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO project_trackers (property_id, project_name, start_date, target_end_date, estimator, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [propertyId, projectName, startDate, targetEndDate, estimatorId || req.user.userId, notes || null]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Create project tracker error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /project-trackers/:id/summary
 * Updates the two summary totals as the project progresses. This is
 * the ONLY financial data this module carries — no room-by-room line
 * items, matching the RFP's "lightweight tracker... feeding summary
 * data into invoicing" description exactly.
 */
router.patch('/:id/summary', async (req, res) => {
  const { summaryLaborTotal, summaryMaterialTotal, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE project_trackers
       SET summary_labor_total = COALESCE($1, summary_labor_total),
           summary_material_total = COALESCE($2, summary_material_total),
           notes = COALESCE($3, notes)
       WHERE id = $4
       RETURNING id, summary_labor_total, summary_material_total, notes`,
      [summaryLaborTotal, summaryMaterialTotal, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project tracker not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update project tracker summary error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /project-trackers/:id/feed-to-billing
 * The whole point of this module: when a project wraps, its two
 * summary totals get inserted as line items into a billing batch —
 * NOT a separate invoice type. This keeps QuickBooks sync, payment
 * collection, and consolidated statements all going through the one
 * billing_batches path regardless of whether the money came from a
 * quick work order or a long tracked project.
 */
router.post('/:id/feed-to-billing', async (req, res) => {
  const { billingBatchId } = req.body;
  if (!billingBatchId) {
    return res.status(400).json({ error: 'billingBatchId is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trackerRes = await client.query(
      `SELECT project_name, summary_labor_total, summary_material_total
       FROM project_trackers WHERE id = $1`,
      [req.params.id]
    );
    if (trackerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project tracker not found' });
    }
    const { project_name, summary_labor_total, summary_material_total } = trackerRes.rows[0];

    await client.query(
      `INSERT INTO project_tracker_billing_lines (project_tracker_id, billing_batch_id, description, amount)
       VALUES ($1, $2, $3, $4), ($1, $2, $5, $6)`,
      [
        req.params.id,
        billingBatchId,
        `${project_name} — Labor (summary)`,
        summary_labor_total,
        `${project_name} — Materials (summary)`,
        summary_material_total,
      ]
    );

    await client.query(
      `UPDATE project_trackers SET billing_batch_id = $1, status = 'billing_approved' WHERE id = $2`,
      [billingBatchId, req.params.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Feed to billing error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
