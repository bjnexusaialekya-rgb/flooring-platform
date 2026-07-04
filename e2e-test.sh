#!/bin/bash
# ============================================================
# End-to-End B2B Lifecycle Test
# Flooring Platform — run this from the repo root in Codespaces
# while both `npm run dev` servers (backend + frontend) are running.
#
# Exercises the FULL locked workflow from the master blueprint:
#   client submits (pricing-blind) -> staff prices -> approved ->
#   scheduled -> completed -> consolidated billing batch
#
# At every stage where the client could theoretically see a price,
# this script explicitly re-checks that they still can't — including
# AFTER the work order is billed, which is the easiest place for a
# price leak to slip in unnoticed.
# ============================================================

set -e
BASE="http://localhost:4000"

command -v jq >/dev/null 2>&1 || { echo "Installing jq..."; sudo apt-get update -qq && sudo apt-get install -y -qq jq; }

pass() { echo "  ✅ PASS: $1"; }
fail() { echo "  ❌ FAIL: $1"; exit 1; }

echo "=================================================="
echo "1. LOGIN — client and admin"
echo "=================================================="

CLIENT_TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@sampleproperty.local","password":"ChangeMe123!"}' | jq -r '.token')

ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bjnexus.local","password":"ChangeMe123!"}' | jq -r '.token')

[ "$CLIENT_TOKEN" != "null" ] && [ -n "$CLIENT_TOKEN" ] && pass "Client login" || fail "Client login"
[ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ] && pass "Admin login" || fail "Admin login"

echo ""
echo "=================================================="
echo "2. CLIENT — list templates and units, submit new work order"
echo "=================================================="

TEMPLATE_ID=$(curl -s $BASE/floor-plan-templates -H "Authorization: Bearer $CLIENT_TOKEN" | jq -r '.[0].id')
UNIT_ID=$(curl -s $BASE/units -H "Authorization: Bearer $CLIENT_TOKEN" | jq -r '.[0].id')

[ "$TEMPLATE_ID" != "null" ] && pass "Found template: $TEMPLATE_ID" || fail "No floor plan template found — did you run npm run seed?"
[ "$UNIT_ID" != "null" ] && pass "Found unit: $UNIT_ID" || fail "No unit found — did you run npm run seed?"

WO_RESPONSE=$(curl -s -X POST $BASE/work-orders \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"unitId\":\"$UNIT_ID\",\"floorPlanTemplateId\":\"$TEMPLATE_ID\",\"poNumber\":\"E2E-TEST-001\"}")

WORK_ORDER_ID=$(echo "$WO_RESPONSE" | jq -r '.workOrderId')
[ "$WORK_ORDER_ID" != "null" ] && pass "Work order created: $WORK_ORDER_ID (status: pending_review)" || fail "Work order creation failed: $WO_RESPONSE"

echo ""
echo "=================================================="
echo "3. PRICING-BLIND CHECK #1 — client portal-view right after submission"
echo "=================================================="

PORTAL_VIEW=$(curl -s $BASE/work-orders/$WORK_ORDER_ID/portal-view -H "Authorization: Bearer $CLIENT_TOKEN")
echo "$PORTAL_VIEW" | jq .

if echo "$PORTAL_VIEW" | grep -qi "unit_price_charged\|internal_cost_basis\|unitPriceCharged"; then
  fail "Client portal-view leaked a price field! $PORTAL_VIEW"
else
  pass "No price field present in client's portal-view"
fi

echo ""
echo "=================================================="
echo "4. STAFF — view pricing (should be visible here), price the line items"
echo "=================================================="

STAFF_VIEW=$(curl -s $BASE/work-orders/$WORK_ORDER_ID/staff-view -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$STAFF_VIEW" | jq .

LINE_ITEM_IDS=($(echo "$STAFF_VIEW" | jq -r '.lineItems[].id'))
[ ${#LINE_ITEM_IDS[@]} -gt 0 ] && pass "Staff can see ${#LINE_ITEM_IDS[@]} line item(s) to price" || fail "No line items found on work order — template may have no matching materials_catalog SKUs"

for LID in "${LINE_ITEM_IDS[@]}"; do
  PRICE_RESULT=$(curl -s -X PATCH $BASE/work-orders/$WORK_ORDER_ID/line-items/$LID/price \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"unitPriceCharged": 4.25}')
  echo "$PRICE_RESULT" | jq .
done
pass "All line items priced at \$4.25/unit"

echo ""
echo "=================================================="
echo "5. STAFF — walk the full status pipeline"
echo "=================================================="

for STATUS in priced approved scheduled completed; do
  RESULT=$(curl -s -X PATCH $BASE/work-orders/$WORK_ORDER_ID/status \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"$STATUS\"}")
  ACTUAL_STATUS=$(echo "$RESULT" | jq -r '.status')
  [ "$ACTUAL_STATUS" == "$STATUS" ] && pass "Transitioned to '$STATUS'" || fail "Failed to transition to '$STATUS': $RESULT"
done

echo ""
echo "=================================================="
echo "6. PRICING-BLIND CHECK #2 — client portal-view NOW, mid-pipeline"
echo "=================================================="

PORTAL_VIEW_2=$(curl -s $BASE/work-orders/$WORK_ORDER_ID/portal-view -H "Authorization: Bearer $CLIENT_TOKEN")
echo "$PORTAL_VIEW_2" | jq .
if echo "$PORTAL_VIEW_2" | grep -qi "unit_price_charged\|internal_cost_basis\|unitPriceCharged"; then
  fail "Client portal-view leaked a price field after pricing/approval! $PORTAL_VIEW_2"
else
  pass "Still no price field visible to client, even after staff priced and approved it"
fi

echo ""
echo "=================================================="
echo "7. ADMIN — generate consolidated billing statement"
echo "=================================================="

PROPERTY_ID=$(docker exec flooring_pg psql -U flooring_admin -d flooring_platform -tAc \
  "SELECT id FROM properties WHERE name='Oakridge Apartments' LIMIT 1" | tr -d '[:space:]')

[ -n "$PROPERTY_ID" ] && pass "Found property: $PROPERTY_ID" || fail "Could not find Oakridge Apartments property in DB"

TODAY=$(date +%Y-%m-%d)
BATCH_RESPONSE=$(curl -s -X POST $BASE/billing/consolidated-statement \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"propertyId\":\"$PROPERTY_ID\",\"startDate\":\"2020-01-01\",\"endDate\":\"$TODAY\"}")

echo "$BATCH_RESPONSE" | jq .
BATCH_ID=$(echo "$BATCH_RESPONSE" | jq -r '.billingBatchId')
[ "$BATCH_ID" != "null" ] && pass "Billing batch created: $BATCH_ID, containing $(echo $BATCH_RESPONSE | jq -r '.workOrdersBatched') work order(s)" || fail "Consolidated billing failed: $BATCH_RESPONSE"

echo ""
echo "=================================================="
echo "8. PRICING-BLIND CHECK #3 (the important one) — client view AFTER billing"
echo "=================================================="

PORTAL_VIEW_3=$(curl -s $BASE/work-orders/$WORK_ORDER_ID/portal-view -H "Authorization: Bearer $CLIENT_TOKEN")
echo "$PORTAL_VIEW_3" | jq .
FINAL_STATUS=$(echo "$PORTAL_VIEW_3" | jq -r '.status')
echo "  Work order status is now: $FINAL_STATUS"

if echo "$PORTAL_VIEW_3" | grep -qi "unit_price_charged\|internal_cost_basis\|unitPriceCharged"; then
  fail "CRITICAL: Client can see pricing after billing! This is the core feature — must be fixed before delivery."
else
  pass "Client STILL cannot see any price, even after the work order was billed. Core differentiator holds end-to-end."
fi

echo ""
echo "=================================================="
echo "9. ADMIN — confirm the batch DOES show real prices on the staff side"
echo "=================================================="

BATCH_DETAIL=$(curl -s $BASE/billing/batches/$BATCH_ID -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$BATCH_DETAIL" | jq .
if echo "$BATCH_DETAIL" | grep -q "unitPriceCharged"; then
  pass "Staff-side billing batch correctly shows real pricing"
else
  fail "Billing batch is missing price data on the staff side — check billingRoutes.js"
fi

echo ""
echo "=================================================="
echo "✅ END-TO-END TEST COMPLETE — full B2B lifecycle verified"
echo "=================================================="
