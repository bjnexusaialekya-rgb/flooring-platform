#!/bin/bash
# ============================================================
# 360-DEGREE TEST — Flooring Platform
# Goes beyond the happy-path E2E test: checks security boundaries,
# invalid inputs, wrong-role access attempts, and error handling.
# Run from repo root with both dev servers running.
# ============================================================

set -e
BASE="http://localhost:4000"
command -v jq >/dev/null 2>&1 || { sudo apt-get update -qq && sudo apt-get install -y -qq jq; }

PASS_COUNT=0
FAIL_COUNT=0
pass() { echo "  ✅ PASS: $1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
section() { echo ""; echo "=================================================="; echo "$1"; echo "=================================================="; }

section "SETUP — logins"
CLIENT_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"manager@sampleproperty.local","password":"ChangeMe123!"}' | jq -r '.token')
ADMIN_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@bjnexus.local","password":"ChangeMe123!"}' | jq -r '.token')
[ -n "$CLIENT_TOKEN" ] && [ "$CLIENT_TOKEN" != "null" ] && pass "Client login" || fail "Client login"
[ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ] && pass "Admin login" || fail "Admin login"

section "1. AUTH — negative cases"

# Wrong password must be rejected
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bjnexus.local","password":"WrongPassword!"}')
[ "$CODE" == "401" ] && pass "Wrong password correctly rejected (401)" || fail "Wrong password returned $CODE, expected 401"

# No token at all on a protected route
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/work-orders)
[ "$CODE" == "401" ] && pass "Missing Authorization header correctly rejected (401)" || fail "No-token request returned $CODE, expected 401"

# Garbage token
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/work-orders -H "Authorization: Bearer garbage.invalid.token")
[ "$CODE" == "401" ] && pass "Malformed/invalid JWT correctly rejected (401)" || fail "Invalid token returned $CODE, expected 401"

section "2. ROLE ENFORCEMENT — client blocked from staff/admin-only routes"

for ROUTE in "/inventory" "/reports/summary" "/project-trackers" "/billing/consolidated-statement"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE$ROUTE -H "Authorization: Bearer $CLIENT_TOKEN")
  [ "$CODE" == "403" ] && pass "Client correctly blocked from $ROUTE (403)" || fail "Client accessed $ROUTE, got $CODE instead of 403"
done

# Client blocked from staff-only sub-route on an existing work order
EXISTING_WO=$(curl -s $BASE/work-orders -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/work-orders/$EXISTING_WO/staff-view -H "Authorization: Bearer $CLIENT_TOKEN")
[ "$CODE" == "403" ] && pass "Client correctly blocked from staff-view (403)" || fail "Client accessed staff-view, got $CODE"

section "3. PRICING-BLIND — client cannot inject a price via request body"

TEMPLATE_ID=$(curl -s $BASE/floor-plan-templates -H "Authorization: Bearer $CLIENT_TOKEN" | jq -r '.[0].id')
UNIT_ID=$(curl -s $BASE/units -H "Authorization: Bearer $CLIENT_TOKEN" | jq -r '.[0].id')

INJECT_RESPONSE=$(curl -s -X POST $BASE/work-orders \
  -H "Authorization: Bearer $CLIENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"unitId\":\"$UNIT_ID\",\"floorPlanTemplateId\":\"$TEMPLATE_ID\",\"unitPriceCharged\":9999,\"internalCostBasis\":0.01}")
INJECT_WO_ID=$(echo "$INJECT_RESPONSE" | jq -r '.workOrderId')

STAFF_CHECK=$(curl -s $BASE/work-orders/$INJECT_WO_ID/staff-view -H "Authorization: Bearer $ADMIN_TOKEN")
INJECTED_PRICE=$(echo "$STAFF_CHECK" | jq -r '.lineItems[0].unit_price_charged')
if [ "$INJECTED_PRICE" == "null" ] || [ -z "$INJECTED_PRICE" ]; then
  pass "Client-supplied price/cost fields in request body were silently ignored, not applied"
else
  fail "SECURITY ISSUE: client-supplied price ($INJECTED_PRICE) was actually applied — a client can set their own price!"
fi

section "4. STATUS PIPELINE — invalid transitions rejected"

# Fresh work order is pending_review — try to skip straight to completed
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH $BASE/work-orders/$INJECT_WO_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"completed"}')
[ "$CODE" == "400" ] && pass "Illegal status jump (pending_review -> completed) correctly rejected (400)" || fail "Illegal transition returned $CODE, expected 400"

# Client attempting to change status at all — should be blocked (client not in requireRole list)
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH $BASE/work-orders/$INJECT_WO_ID/status \
  -H "Authorization: Bearer $CLIENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"priced"}')
[ "$CODE" == "403" ] && pass "Client correctly blocked from changing work order status (403)" || fail "Client changed status, got $CODE instead of 403"

section "5. 404 HANDLING — nonexistent resources"

FAKE_ID="00000000-0000-0000-0000-000000000000"
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/work-orders/$FAKE_ID/portal-view -H "Authorization: Bearer $CLIENT_TOKEN")
[ "$CODE" == "404" ] && pass "Nonexistent work order correctly returns 404" || fail "Nonexistent work order returned $CODE, expected 404"

CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/nonexistent-route -H "Authorization: Bearer $ADMIN_TOKEN")
[ "$CODE" == "404" ] && pass "Nonexistent route correctly returns 404" || fail "Nonexistent route returned $CODE, expected 404"

section "6. CSV IMPORTER — invalid inputs handled gracefully"

# Missing required column
BAD_CSV="property_name,plan_name,room_name\nOakridge,TestPlan,Kitchen"
RESULT=$(curl -s -X POST $BASE/floor-plan-templates/import \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"csv\":\"$BAD_CSV\"}")
if echo "$RESULT" | grep -q "missing required column"; then
  pass "CSV with missing columns correctly rejected with a clear error"
else
  fail "CSV with missing columns did not produce expected error: $RESULT"
fi

# Nonexistent property name
GHOST_CSV="property_name,plan_name,room_name,material_sku,net_qty,waste_pct\nGhost Property That Does Not Exist,Plan X,Kitchen,LVP-STD,100,10"
RESULT=$(curl -s -X POST $BASE/floor-plan-templates/import \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"csv\":\"$GHOST_CSV\"}")
STATUS=$(echo "$RESULT" | jq -r '.results[0].status')
[ "$STATUS" == "failed" ] && pass "CSV import for nonexistent property correctly fails per-row, not silently" || fail "Nonexistent property import result: $RESULT"

# Staff role blocked from import (client shouldn't even reach it, but verify)
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/floor-plan-templates/import \
  -H "Authorization: Bearer $CLIENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"csv":"test"}')
[ "$CODE" == "403" ] && pass "Client correctly blocked from CSV import endpoint (403)" || fail "Client reached import endpoint, got $CODE"

section "7. INVENTORY — reorder flagging logic"

INVENTORY=$(curl -s $BASE/inventory -H "Authorization: Bearer $ADMIN_TOKEN")
NEEDS_REORDER_COUNT=$(echo "$INVENTORY" | jq '[.[] | select(.needs_reorder == true)] | length')
echo "$INVENTORY" | jq .
[ "$NEEDS_REORDER_COUNT" -ge 0 ] && pass "Inventory endpoint returns valid reorder-flag data ($NEEDS_REORDER_COUNT item(s) flagged)" || fail "Inventory reorder logic returned unexpected data"

section "8. PROJECT TRACKER — create, update summary, feed to billing"

PROPERTY_ID=$(docker exec flooring_pg psql -U flooring_admin -d flooring_platform -tAc \
  "SELECT id FROM properties WHERE name='Oakridge Apartments' LIMIT 1" | tr -d '[:space:]')

TRACKER_RESPONSE=$(curl -s -X POST $BASE/project-trackers \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"propertyId\":\"$PROPERTY_ID\",\"projectName\":\"360-Test Project\",\"startDate\":\"2026-07-01\",\"targetEndDate\":\"2026-07-15\"}")
TRACKER_ID=$(echo "$TRACKER_RESPONSE" | jq -r '.id')
[ "$TRACKER_ID" != "null" ] && pass "Project tracker created: $TRACKER_ID" || fail "Project tracker creation failed: $TRACKER_RESPONSE"

SUMMARY_RESPONSE=$(curl -s -X PATCH $BASE/project-trackers/$TRACKER_ID/summary \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"summaryLaborTotal": 5000, "summaryMaterialTotal": 3200}')
UPDATED_LABOR=$(echo "$SUMMARY_RESPONSE" | jq -r '.summary_labor_total')
[ "$UPDATED_LABOR" == "5000" ] && pass "Project tracker summary totals updated correctly" || fail "Summary update failed: $SUMMARY_RESPONSE"

# Client should not be able to see project trackers at all
CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/project-trackers -H "Authorization: Bearer $CLIENT_TOKEN")
[ "$CODE" == "403" ] && pass "Client correctly cannot list project trackers (403)" || fail "Client listed project trackers, got $CODE"

section "9. REPORTS — admin dashboard summary"

REPORT=$(curl -s $BASE/reports/summary -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$REPORT" | jq .
HAS_STATUS_COUNTS=$(echo "$REPORT" | jq 'has("statusCounts")')
[ "$HAS_STATUS_COUNTS" == "true" ] && pass "Reports summary endpoint returns expected structure" || fail "Reports summary malformed: $REPORT"

section "10. PAYMENTS — graceful failure with placeholder Stripe key"

# We expect this to fail cleanly (400) since STRIPE_SECRET_KEY is still
# the placeholder from .env.example — the important thing is it fails
# gracefully with a real error, not a raw 500 crash/stack trace leak.
BATCH_ID_FOR_PAYMENT=$(docker exec flooring_pg psql -U flooring_admin -d flooring_platform -tAc \
  "SELECT id FROM billing_batches ORDER BY created_at DESC LIMIT 1" | tr -d '[:space:]')

PAYMENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $BASE/payments/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"billingBatchId\":\"$BATCH_ID_FOR_PAYMENT\"}")
PAYMENT_CODE=$(echo "$PAYMENT_RESPONSE" | tail -1)
PAYMENT_BODY=$(echo "$PAYMENT_RESPONSE" | head -1)
echo "  Response: $PAYMENT_BODY (HTTP $PAYMENT_CODE)"
if [ "$PAYMENT_CODE" == "400" ] || [ "$PAYMENT_CODE" == "201" ]; then
  pass "Payment endpoint responded predictably (not a raw crash) with placeholder/real Stripe key"
else
  fail "Payment endpoint returned unexpected code $PAYMENT_CODE — check for unhandled crash"
fi

section "11. QBO — admin-only enforcement"

CODE=$(curl -s -o /dev/null -w "%{http_code}" $BASE/qbo/connect-url -H "Authorization: Bearer $CLIENT_TOKEN")
[ "$CODE" == "403" ] && pass "Client correctly blocked from QBO connect-url (403)" || fail "Client reached QBO route, got $CODE"

echo ""
echo "=================================================="
echo "360-DEGREE TEST COMPLETE"
echo "  PASSED: $PASS_COUNT"
echo "  FAILED: $FAIL_COUNT"
echo "=================================================="
[ "$FAIL_COUNT" -eq 0 ] && exit 0 || exit 1
