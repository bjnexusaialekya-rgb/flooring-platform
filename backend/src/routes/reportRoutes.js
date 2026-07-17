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

    // Mirrors the same window used above, shifted back one month, so the
    // dashboard can show a month-over-month delta instead of just a bare total.
    const revenueLastMonth = await pool.query(
      `SELECT COALESCE(SUM(woli.quantity_calculated * woli.unit_price_charged), 0) AS total
       FROM work_orders wo
       JOIN work_order_line_items woli ON woli.work_order_id = wo.id
       WHERE wo.status IN ('billing_approved', 'invoiced')
         AND date_trunc('month', wo.created_at) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`
    );

    // Server-side mirror of the client's isOverdue() (WorkOrdersListPage):
    // target_turn_date < today AND not already in a terminal/near-terminal
    // state. Kept as an exact copy of that condition on purpose — the two
    // must never drift, or the dashboard count and the list-page count
    // disagree.
    const overdue = await pool.query(
      `SELECT COUNT(*)::int AS count FROM work_orders
       WHERE target_turn_date < CURRENT_DATE
         AND status NOT IN ('completed', 'billing_approved', 'invoiced')`
    );

    // Last 30 days of billable revenue, bucketed by day, for the dashboard's
    // revenue trend line. Zero-fills days with no billed activity via
    // generate_series so the chart doesn't show a broken/missing line.
    const revenueTrend = await pool.query(
      `SELECT
          d.day::date AS day,
          COALESCE(SUM(woli.quantity_calculated * woli.unit_price_charged), 0) AS total
       FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN work_orders wo
              ON wo.status IN ('billing_approved', 'invoiced')
             AND wo.created_at::date = d.day
       LEFT JOIN work_order_line_items woli ON woli.work_order_id = wo.id
       GROUP BY d.day
       ORDER BY d.day`
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
      revenueLastMonth: Number(revenueLastMonth.rows[0].total),
      overdueCount: overdue.rows[0].count,
      revenueTrend: revenueTrend.rows.map((r) => ({ day: r.day, total: Number(r.total) })),
      topProperties: topProperties.rows,
      pendingSyncFailures: pendingSyncFailures.rows[0].count,
    });
  } catch (err) {
    console.error('Reports summary error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /reports/ar-aging
 * Buckets outstanding (unpaid) billing batches by age since their
 * billing_period_end, into 0-30 / 31-60 / 60+ day buckets. "Outstanding"
 * mirrors stripeWebhook.js's success path exactly: batch_status only
 * flips to 'closed' once a payment_intent.succeeded event has processed
 * for that batch (see stripeWebhookRoutes.js), so any batch not in
 * 'closed' status is still owed. Reuses the same SUM(unit_price_charged *
 * quantity) amount calculation as GET /billing/batches so a batch's
 * amount here always matches what the Billing page shows for it.
 */
router.get('/ar-aging', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          bb.id,
          bb.billing_period_end,
          p.name AS property_name,
          COALESCE((
            SELECT SUM(wli.unit_price_charged * COALESCE(wli.quantity_actual_used, wli.quantity_calculated))
            FROM work_orders wo
            JOIN work_order_line_items wli ON wli.work_order_id = wo.id
            WHERE wo.billing_batch_id = bb.id
          ), 0) AS amount,
          GREATEST(0, (CURRENT_DATE - bb.billing_period_end::date))::int AS days_outstanding
       FROM billing_batches bb
       JOIN properties p ON p.id = bb.property_id
       WHERE bb.batch_status != 'closed'`
    );

    const buckets = { bucket_0_30: 0, bucket_31_60: 0, bucket_60_plus: 0 };
    for (const row of result.rows) {
      const amt = Number(row.amount);
      if (row.days_outstanding <= 30) buckets.bucket_0_30 += amt;
      else if (row.days_outstanding <= 60) buckets.bucket_31_60 += amt;
      else buckets.bucket_60_plus += amt;
    }

    return res.status(200).json({
      buckets,
      totalOutstanding: buckets.bucket_0_30 + buckets.bucket_31_60 + buckets.bucket_60_plus,
      batches: result.rows.map((r) => ({
        id: r.id,
        propertyName: r.property_name,
        amount: Number(r.amount),
        daysOutstanding: r.days_outstanding,
      })),
    });
  } catch (err) {
    console.error('AR aging report error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
