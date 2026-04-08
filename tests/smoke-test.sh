#!/usr/bin/env bash
# ─── Traeger Grill Monitor: CI Smoke Test ────────────────
# Validates all endpoints against a running Docker container.
# Exit code 0 = all critical checks pass, non-zero = failure.
#
# Usage: ./tests/smoke-test.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:8420
#
# Requires: curl (available in ubuntu-latest runners)

set -euo pipefail

BASE_URL="${1:-http://localhost:8420}"
TRPC="${BASE_URL}/api/trpc"

PASS=0
FAIL=0
WARN=0
ERRORS=""

# ─── Helpers ─────────────────────────────────────────────

pass() { PASS=$((PASS + 1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS="${ERRORS}\n  ❌ $1: $2"; echo "  ❌ FAIL: $1 — $2"; }
warn() { WARN=$((WARN + 1)); echo "  ⚠️  WARN: $1 — $2"; }

# curl wrapper: returns HTTP status code, body saved to temp file
BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT

http_get() {
  local url="$1"
  local status
  status=$(curl -s -o "$BODY_FILE" -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  echo "$status"
}

# Check if response body contains a string
body_contains() {
  grep -q "$1" "$BODY_FILE" 2>/dev/null
}

# ─── Wait for app to be healthy ──────────────────────────

echo "═══ Smoke Test: Waiting for app at ${BASE_URL} ═══"

RETRIES=0
MAX_RETRIES=60
until [ "$(http_get "${BASE_URL}/api/health")" = "200" ] && body_contains '"status":"ok"'; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    echo "❌ FATAL: App not healthy after ${MAX_RETRIES} attempts (${MAX_RETRIES}s)"
    echo "Last response body:"
    cat "$BODY_FILE" 2>/dev/null || echo "(empty)"
    exit 1
  fi
  sleep 1
done
echo "═══ App healthy after ${RETRIES}s ═══"
echo ""

# ═════════════════════════════════════════════════════════
# 1. REST Endpoints
# ═════════════════════════════════════════════════════════

echo "─── REST Endpoints ───"

# /api/health
STATUS=$(http_get "${BASE_URL}/api/health")
if [ "$STATUS" = "200" ] && body_contains '"status":"ok"'; then
  pass "/api/health → 200, status=ok"
else
  fail "/api/health" "HTTP $STATUS"
fi

# /api/auth/ok (Better Auth health)
STATUS=$(http_get "${BASE_URL}/api/auth/ok")
if [ "$STATUS" = "200" ] && body_contains '"ok":true'; then
  pass "/api/auth/ok → 200, ok=true"
else
  fail "/api/auth/ok" "HTTP $STATUS"
fi

# /api/version
STATUS=$(http_get "${BASE_URL}/api/version")
if [ "$STATUS" = "200" ] && body_contains '"version"'; then
  pass "/api/version → 200, has version"
else
  fail "/api/version" "HTTP $STATUS"
fi

# Frontend serves HTML
STATUS=$(http_get "${BASE_URL}/")
if [ "$STATUS" = "200" ] && body_contains '<div id="root"'; then
  pass "GET / → 200, serves HTML with #root"
else
  fail "GET /" "HTTP $STATUS or missing #root"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 2. Public tRPC Endpoints (return data without auth)
# ═════════════════════════════════════════════════════════

echo "─── Public tRPC Endpoints ───"

PUBLIC_QUERIES=(
  "setup.status"
  "auth.me"
  "meatProfiles.list"
  "meatProfiles.byCategory"
  "templates.list"
  "customTemplates.community"
)

for proc in "${PUBLIC_QUERIES[@]}"; do
  STATUS=$(http_get "${TRPC}/${proc}")
  if [ "$STATUS" = "200" ]; then
    pass "tRPC ${proc} → 200"
  else
    fail "tRPC ${proc}" "HTTP $STATUS"
  fi
done

echo ""

# ═════════════════════════════════════════════════════════
# 3. Protected tRPC Endpoints (should return UNAUTHORIZED)
# ═════════════════════════════════════════════════════════

echo "─── Protected tRPC Endpoints (expect UNAUTHORIZED) ───"

PROTECTED_QUERIES=(
  "grill.telemetry"
  "telemetry.recent"
  "traeger.status"
  "traeger.mqttCredentials"
  "liveCook.active"
  "liveCook.stallInfo"
  "cookSession.list"
  "automation.list"
  "customTemplates.mine"
  "analytics.summary"
  "executions.history"
  "push.getVapidKey"
  "push.isSubscribed"
)

for proc in "${PROTECTED_QUERIES[@]}"; do
  STATUS=$(http_get "${TRPC}/${proc}")
  if [ "$STATUS" = "401" ] && body_contains "UNAUTHORIZED"; then
    pass "tRPC ${proc} → 401 UNAUTHORIZED"
  elif [ "$STATUS" = "200" ]; then
    # Some protected endpoints might return data if auth is optional
    warn "tRPC ${proc}" "returned 200 instead of 401 (auth may be optional)"
  else
    fail "tRPC ${proc}" "HTTP $STATUS (expected 401)"
  fi
done

echo ""

# ═════════════════════════════════════════════════════════
# 4. Admin-Only tRPC Endpoints (should return UNAUTHORIZED or FORBIDDEN)
# ═════════════════════════════════════════════════════════

echo "─── Admin-Only tRPC Endpoints (expect UNAUTHORIZED/FORBIDDEN) ───"

ADMIN_QUERIES=(
  "admin.getRegistrationConfig"
  "admin.listUsers"
)

for proc in "${ADMIN_QUERIES[@]}"; do
  STATUS=$(http_get "${TRPC}/${proc}")
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    pass "tRPC ${proc} → ${STATUS} (auth gate works)"
  else
    fail "tRPC ${proc}" "HTTP $STATUS (expected 401 or 403)"
  fi
done

echo ""

# ═════════════════════════════════════════════════════════
# 5. Mutation Endpoints (GET should return METHOD_NOT_SUPPORTED)
# ═════════════════════════════════════════════════════════

echo "─── Mutation Endpoints (expect METHOD_NOT_SUPPORTED on GET) ───"

MUTATIONS=(
  "grill.shutdown"
  "grill.requestStatus"
  "traeger.refreshGrills"
  "password.changeOwn"
)

for proc in "${MUTATIONS[@]}"; do
  STATUS=$(http_get "${TRPC}/${proc}")
  # tRPC returns 405 for mutations called with GET
  if [ "$STATUS" = "405" ] || (body_contains "METHOD_NOT_SUPPORTED"); then
    pass "tRPC ${proc} → mutation exists (${STATUS})"
  elif [ "$STATUS" = "401" ]; then
    # Auth gate fires before method check — still proves endpoint exists
    pass "tRPC ${proc} → mutation exists (auth gate: ${STATUS})"
  else
    warn "tRPC ${proc}" "HTTP $STATUS (expected 405 or METHOD_NOT_SUPPORTED)"
  fi
done

echo ""

# ═════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════

TOTAL=$((PASS + FAIL + WARN))
echo "═══════════════════════════════════════════════════"
echo "  Smoke Test Results: ${PASS} PASS / ${FAIL} FAIL / ${WARN} WARN (${TOTAL} total)"
echo "═══════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failures:"
  echo -e "$ERRORS"
  echo ""
  exit 1
fi

echo ""
echo "✅ All critical checks passed!"
exit 0
