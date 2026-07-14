const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /floor-plan-templates
 * Same client-scoping principle as /units — a client user only sees
 * templates that belong to their own properties.
 */
router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'client') {
      query = `
        SELECT ft.id, ft.plan_name, ft.room_manifest, p.name AS property_name
        FROM floor_plan_templates ft
        JOIN properties p ON p.id = ft.property_id
        WHERE p.client_id = $1 AND ($2::uuid IS NULL OR p.id = $2)
        ORDER BY p.name, ft.plan_name`;
      params = [req.user.clientId, req.user.propertyId || null];
    } else {
      query = `SELECT ft.id, ft.plan_name, ft.room_manifest, p.name AS property_name
                FROM floor_plan_templates ft JOIN properties p ON p.id = ft.property_id
                ORDER BY p.name, ft.plan_name LIMIT 500`;
      params = [];
    }
    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List floor plan templates error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------------------------------------------
// BULK CSV IMPORT — resolves the "template setup bottleneck" flagged
// as an open item: staff shouldn't have to hand-type JSON room
// manifests for every property/unit-type combination. This lets them
// prepare a spreadsheet instead and upload it in one shot.
//
// Expected CSV columns (header row required):
//   property_name,plan_name,room_name,material_sku,net_qty,waste_pct
//
// One row per room. Rows sharing the same (property_name, plan_name)
// are grouped into a single template's room_manifest JSONB. Existing
// templates with the same (property_id, plan_name) are updated, not
// duplicated, matching the schema's UNIQUE constraint.
// ------------------------------------------------------------------

const EXPECTED_HEADERS = ['property_name', 'plan_name', 'room_name', 'material_sku', 'net_qty', 'waste_pct'];

/**
 * Minimal dependency-free CSV parser. Handles quoted fields
 * (commas/quotes inside "..."), which is enough for property/plan
 * names that might contain a comma (e.g. "Oakridge, Building B").
 * Not a full RFC 4180 implementation, but sufficient for this
 * internal admin tool where inputs are staff-authored spreadsheets.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        pushField();
      } else if (char === '\r') {
        // skip — handled by \n
      } else if (char === '\n') {
        pushRow();
      } else {
        field += char;
      }
    }
  }
  // Final field/row if the file doesn't end with a newline
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  // Drop fully blank trailing rows
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * GET /floor-plan-templates/import/sample-csv
 * Downloadable starting point so staff don't have to guess the
 * column format from scratch.
 */
router.get('/import/sample-csv', requireRole('staff', 'admin'), (req, res) => {
  const sample =
    'property_name,plan_name,room_name,material_sku,net_qty,waste_pct\n' +
    'Oakridge Apartments,The Aspen (2B/1B),Living Room,LVP-STD,340,12\n' +
    'Oakridge Apartments,The Aspen (2B/1B),Bedroom 1,LVP-STD,180,12\n' +
    'Oakridge Apartments,The Aspen (2B/1B),Bathroom,TILE-STD,60,15\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="floor-plan-template-sample.csv"');
  return res.status(200).send(sample);
});

/**
 * POST /floor-plan-templates/import
 * Body: { csv: "<raw csv text>" }
 * Staff/admin only. Parses the CSV, groups rows into templates,
 * resolves property names to IDs, and upserts. Returns a per-template
 * result summary plus any row-level errors so staff can fix and
 * re-upload just the bad rows rather than guessing what failed.
 */
router.post('/import', requireRole('staff', 'admin'), async (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string' || csv.trim().length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "csv" string field' });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV must include a header row plus at least one data row' });
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !header.includes(h));
  if (missingHeaders.length > 0) {
    return res.status(400).json({
      error: `CSV header is missing required column(s): ${missingHeaders.join(', ')}`,
      expectedHeader: EXPECTED_HEADERS.join(','),
    });
  }
  const colIndex = Object.fromEntries(EXPECTED_HEADERS.map((h) => [h, header.indexOf(h)]));

  // Group data rows into templates: Map<"property_name|||plan_name", { propertyName, planName, rooms }>
  const templateGroups = new Map();
  const rowErrors = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const lineNumber = i + 1; // +1 to account for the header row when reporting to the user

    const propertyName = (cols[colIndex.property_name] || '').trim();
    const planName = (cols[colIndex.plan_name] || '').trim();
    const roomName = (cols[colIndex.room_name] || '').trim();
    const materialSku = (cols[colIndex.material_sku] || '').trim();
    const netQtyRaw = (cols[colIndex.net_qty] || '').trim();
    const wastePctRaw = (cols[colIndex.waste_pct] || '').trim();

    if (!propertyName || !planName || !roomName || !materialSku || !netQtyRaw || !wastePctRaw) {
      rowErrors.push({ line: lineNumber, error: 'One or more required fields are blank' });
      continue;
    }

    const netQty = Number(netQtyRaw);
    const wastePct = Number(wastePctRaw);
    if (Number.isNaN(netQty) || netQty <= 0) {
      rowErrors.push({ line: lineNumber, error: `net_qty "${netQtyRaw}" is not a valid positive number` });
      continue;
    }
    if (Number.isNaN(wastePct) || wastePct < 0) {
      rowErrors.push({ line: lineNumber, error: `waste_pct "${wastePctRaw}" is not a valid non-negative number` });
      continue;
    }

    const groupKey = `${propertyName.toLowerCase()}|||${planName.toLowerCase()}`;
    if (!templateGroups.has(groupKey)) {
      templateGroups.set(groupKey, { propertyName, planName, rooms: {} });
    }
    templateGroups.get(groupKey).rooms[roomName] = {
      material_sku: materialSku,
      net_qty: netQty,
      waste_pct: wastePct,
    };
  }

  const results = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const { propertyName, planName, rooms } of templateGroups.values()) {
      // Resolve property by name — case-insensitive, exact match.
      // Deliberately does NOT auto-create properties: importing a
      // template for a mistyped/nonexistent property should fail
      // loudly, not silently create a duplicate/junk property row.
      const propertyRes = await client.query(
        `SELECT id FROM properties WHERE LOWER(name) = LOWER($1)`,
        [propertyName]
      );
      if (propertyRes.rows.length === 0) {
        results.push({
          propertyName,
          planName,
          status: 'failed',
          error: `No property found named "${propertyName}" — create the property first, or check spelling`,
        });
        continue;
      }
      const propertyId = propertyRes.rows[0].id;

      const upsertRes = await client.query(
        `INSERT INTO floor_plan_templates (property_id, plan_name, room_manifest)
         VALUES ($1, $2, $3)
         ON CONFLICT (property_id, plan_name)
         DO UPDATE SET room_manifest = EXCLUDED.room_manifest
         RETURNING id, (xmax = 0) AS inserted`,
        [propertyId, planName, JSON.stringify(rooms)]
      );

      results.push({
        propertyName,
        planName,
        status: upsertRes.rows[0].inserted ? 'created' : 'updated',
        templateId: upsertRes.rows[0].id,
        roomCount: Object.keys(rooms).length,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Template import error:', err.message);
    return res.status(500).json({ error: 'Import failed and was rolled back', detail: err.message });
  } finally {
    client.release();
  }

  return res.status(200).json({
    templatesProcessed: results.length,
    results,
    rowErrors,
  });
});

module.exports = router;
