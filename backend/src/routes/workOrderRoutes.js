const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /work-orders
 * List endpoint used by the frontend queue/history views. Scoped by
 * role at the query level, same discipline as the pricing boundary:
 * a client sees only work orders tied to their own client_id, and
 * this list NEVER includes price columns (use /:id/portal-view or
 * the staff line-item routes for that, which have their own explicit
 * boundary logic).
 */
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.user.role === 'client') {
      result = await pool.query(
        `SELECT wo.id, wo.status, wo.po_number, wo.target_turn_date, wo.created_at
         FROM work_orders wo
         JOIN units u ON u.id = wo.unit_id
         JOIN buildings b ON b.id = u.building_id
         JOIN properties p ON p.id = b.property_id
         WHERE p.client_id = $1
         ORDER BY wo.created_at DESC`,
        [req.user.clientId]
      );
    } else {
      // staff/admin see the full queue across all clients
      result = await pool.query(
        `SELECT id, status, po_number, target_turn_date, created_at
         FROM work_orders
         ORDER BY created_at DESC`
      );
    }
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List work orders error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /work-orders
 * Client-role: submits a work order against a floor plan template.
 * No price fields are accepted from the request body — quantities are
 * computed server-side from the template's room_manifest, and pricing
 * is filled in later by staff. This is what keeps submission genuinely
 * pricing-blind rather than just UI-hidden.
 */
router.post('/', requireRole('client', 'staff', 'admin'), async (req, res) => {
  const { unitId, floorPlanTemplateId, poNumber, targetTurnDate, billingContact } = req.body;
  if (!unitId || !floorPlanTemplateId) {
    return res.status(400).json({ error: 'unitId and floorPlanTemplateId are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const templateRes = await client.query(
      `SELECT ft.room_manifest, p.client_id
       FROM floor_plan_templates ft
       JOIN properties p ON p.id = ft.property_id
       WHERE ft.id = $1`,
      [floorPlanTemplateId]
    );
    if (templateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Floor plan template not found' });
    }
    const { room_manifest, client_id } = templateRes.rows[0];

    // A client user may only submit against their own client_id's templates.
    if (req.user.role === 'client' && req.user.clientId !== client_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Template does not belong to your organization' });
    }

    const woRes = await client.query(
      `INSERT INTO work_orders (unit_id, floor_plan_template_id, submitted_by, po_number, target_turn_date, billing_contact, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_review')
       RETURNING id, status, created_at`,
      [unitId, floorPlanTemplateId, req.user.userId, poNumber || null, targetTurnDate || null, billingContact || null]
    );
    const workOrderId = woRes.rows[0].id;

    for (const [roomName, specs] of Object.entries(room_manifest)) {
      const materialRes = await client.query(
        `SELECT id FROM materials_catalog WHERE sku = $1 AND is_active = true`,
        [specs.material_sku]
      );
      if (materialRes.rows.length === 0) continue; // template references an inactive/missing SKU
      const materialId = materialRes.rows[0].id;

      const wastePct = Number(specs.waste_pct || 0);
      const quantityCalculated = (Number(specs.net_qty) * (1 + wastePct / 100)).toFixed(2);

      await client.query(
        `INSERT INTO work_order_line_items (work_order_id, material_id, room_name, quantity_calculated, is_supplemental_prep)
         VALUES ($1, $2, $3, $4, false)`,
        [workOrderId, materialId, roomName, quantityCalculated]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ workOrderId, status: 'pending_review' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create work order error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * GET /work-orders/:id/portal-view
 * The pricing-blind boundary. Column-level, not row-level: the SELECT
 * list itself never includes unit_price_charged or internal_cost_basis,
 * and supplemental-prep rows are filtered out entirely. A client
 * caller gets a 403 if the work order doesn't belong to their client_id.
 */
router.get('/:id/portal-view', async (req, res) => {
  try {
    const ownershipCheck = await pool.query(
      `SELECT p.client_id
       FROM work_orders wo
       JOIN units u ON u.id = wo.unit_id
       JOIN buildings b ON b.id = u.building_id
       JOIN properties p ON p.id = b.property_id
       WHERE wo.id = $1`,
      [req.params.id]
    );
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    if (req.user.role === 'client' && req.user.clientId !== ownershipCheck.rows[0].client_id) {
      return res.status(403).json({ error: 'Not authorized to view this work order' });
    }

    const result = await pool.query(
      `SELECT
          wo.id, wo.status, wo.po_number, wo.target_turn_date, wo.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'roomName', woli.room_name,
                'quantityCalculated', woli.quantity_calculated,
                'quantityActualUsed', woli.quantity_actual_used
              )
            ) FILTER (WHERE woli.is_supplemental_prep = false),
            '[]'
          ) AS line_items
       FROM work_orders wo
       LEFT JOIN work_order_line_items woli ON woli.work_order_id = wo.id
       WHERE wo.id = $1
       GROUP BY wo.id`,
      [req.params.id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Portal view error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /work-orders/:id/staff-view
 * Staff/admin counterpart to portal-view — includes the price-bearing
 * columns that portal-view deliberately excludes. This is a SEPARATE
 * query, not a conditional branch inside portal-view, so the
 * pricing-blind SELECT list in portal-view can never accidentally
 * grow a price column through a shared code path.
 */
router.get('/:id/staff-view', requireRole('staff', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          wo.id, wo.status, wo.po_number, wo.target_turn_date, wo.created_at, wo.assigned_to,
          COALESCE(
            json_agg(
              json_build_object(
                'id', woli.id,
                'room_name', woli.room_name,
                'quantity_calculated', woli.quantity_calculated,
                'unit_price_charged', woli.unit_price_charged,
                'internal_cost_basis', woli.internal_cost_basis,
                'is_supplemental_prep', woli.is_supplemental_prep
              )
            ) FILTER (WHERE woli.id IS NOT NULL),
            '[]'
          ) AS line_items
       FROM work_orders wo
       LEFT JOIN work_order_line_items woli ON woli.work_order_id = wo.id
       WHERE wo.id = $1
       GROUP BY wo.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    const { line_items, ...rest } = result.rows[0];
    return res.status(200).json({ ...rest, lineItems: line_items });
  } catch (err) {
    console.error('Staff view error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /work-orders/:id/line-items/:lineItemId/price
 * Staff/admin only. Snapshots the rate-card price and material cost
 * basis AT THIS MOMENT into the line item, so later catalog/rate-card
 * changes never retroactively alter this work order's numbers.
 */
router.patch(
  '/:id/line-items/:lineItemId/price',
  requireRole('staff', 'admin'),
  async (req, res) => {
    const { unitPriceCharged } = req.body;
    if (unitPriceCharged === undefined || Number.isNaN(Number(unitPriceCharged))) {
      return res.status(400).json({ error: 'unitPriceCharged (numeric) is required' });
    }

    try {
      const lineItemRes = await pool.query(
        `SELECT material_id FROM work_order_line_items WHERE id = $1 AND work_order_id = $2`,
        [req.params.lineItemId, req.params.id]
      );
      if (lineItemRes.rows.length === 0) {
        return res.status(404).json({ error: 'Line item not found on this work order' });
      }

      const costRes = await pool.query(
        `SELECT internal_cost_basis FROM materials_catalog WHERE id = $1`,
        [lineItemRes.rows[0].material_id]
      );
      const internalCostBasis = costRes.rows[0]?.internal_cost_basis ?? null;

      const updated = await pool.query(
        `UPDATE work_order_line_items
         SET unit_price_charged = $1, internal_cost_basis = $2, priced_by = $3, priced_at = NOW()
         WHERE id = $4
         RETURNING id, unit_price_charged, internal_cost_basis, priced_at`,
        [unitPriceCharged, internalCostBasis, req.user.userId, req.params.lineItemId]
      );

      return res.status(200).json(updated.rows[0]);
    } catch (err) {
      console.error('Price line item error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /work-orders/:id/status
 * Staff/admin only, enforces the locked status flow.
 */
const VALID_TRANSITIONS = {
  pending_review: ['priced'],
  priced: ['approved'],
  approved: ['scheduled'],
  scheduled: ['completed'],
  completed: ['billing_approved'],
  billing_approved: ['invoiced'],
};

router.patch('/:id/status', requireRole('staff', 'admin'), async (req, res) => {
  const { status: newStatus } = req.body;
  try {
    const current = await pool.query(`SELECT status FROM work_orders WHERE id = $1`, [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    const currentStatus = current.rows[0].status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
        allowedNext,
      });
    }

    const updated = await pool.query(
      `UPDATE work_orders SET status = $1 WHERE id = $2 RETURNING id, status`,
      [newStatus, req.params.id]
    );
    return res.status(200).json(updated.rows[0]);
  } catch (err) {
    console.error('Status transition error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /work-orders/:id/assign
 * Sets the installer/crew lead for a work order. Separate from
 * status transitions since assignment can change independently of
 * where the job is in the pipeline (e.g. reassigning a scheduled job).
 */
router.patch('/:id/assign', requireRole('staff', 'admin'), async (req, res) => {
  const { assignedTo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE work_orders SET assigned_to = $1 WHERE id = $2 RETURNING id, assigned_to`,
      [assignedTo || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Assign work order error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
