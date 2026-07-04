const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth, requireRole('staff', 'admin'));

/**
 * GET /reports/summary
 * Deliberately basic — counts and totals, not a BI tool. This exists
 * because the RFP's admin dashboard requirement explicitly includes
 * "reporting" and nothing addressed that until now.
 */
router.get('/summary', async (req, res) => {
  try {
    const statusCounts = await pool.query(
      `SELECT status, COUNT(*)::int AS count FROM work_orders GROUP BY status`
    );

    const revenueThisMonth = await pool.query(
      `SELECT COALESCE(SUM(woli.quantity_calculated * woli.unit_price_charged), 0) AS total
       FROM work_orders wo
       JOIN work_order_line_items woli ON woli.work_order_id = wo.id
       WHERE wo.status IN ('billing_approved', 'invoiced')
         AND date_trunc('month', wo.created_at) = date_trunc('month', CURRENT_DATE)`
    );

    const topProperties = await pool.query(
      `SELECT p.name, COUNT(wo.id)::int AS work_order_count
       FROM work_orders wo
       JOIN units u ON u.id = wo.unit_id
       JOIN buildings b ON b.id = u.building_id
       JOIN properties p ON p.id = b.property_id
       GROUP BY p.name
       ORDER BY work_order_count DESC
       LIMIT 5`
    );

    const pendingSyncFailures = await pool.query(
      `SELECT COUNT(*)::int AS count FROM qbo_sync_failures WHERE resolved = false`
    );

    return res.status(200).json({
      statusCounts: statusCounts.rows,
      revenueThisMonth: Number(revenueThisMonth.rows[0].total),
      topProperties: topProperties.rows,
      pendingSyncFailures: pendingSyncFailures.rows[0].count,
    });
  } catch (err) {
    console.error('Reports summary error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
