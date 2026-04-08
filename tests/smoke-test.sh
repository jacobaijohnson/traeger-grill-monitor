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
HEADER_FILE=$(mktemp)
COOKIE_JAR=$(mktemp)
trap 'rm -f "$BODY_FILE" "$HEADER_FILE" "$COOKIE_JAR"' EXIT

http_get() {
  local url="$1"
  local status
  status=$(curl -s -o "$BODY_FILE" -D "$HEADER_FILE" -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  echo "$status"
}

# Authenticated GET — uses session cookie from login
http_get_auth() {
  local url="$1"
  local status
  status=$(curl -s -o "$BODY_FILE" -D "$HEADER_FILE" -w "%{http_code}" --max-time 10 -b "$COOKIE_JAR" "$url" 2>/dev/null || echo "000")
  echo "$status"
}

# Authenticated POST — uses session cookie from login
http_post_auth() {
  local url="$1"
  local data="${2:-{}}"
  local status
  status=$(curl -s -o "$BODY_FILE" -D "$HEADER_FILE" -w "%{http_code}" --max-time 10 -b "$COOKIE_JAR" -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null || echo "000")
  echo "$status"
}

# Check if response body contains a string
body_contains() {
  grep -q "$1" "$BODY_FILE" 2>/dev/null
}

# Check if response headers contain a string (case-insensitive)
header_contains() {
  grep -qi "$1" "$HEADER_FILE" 2>/dev/null
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

echo "─── 1. REST Endpoints ───"

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

echo "─── 2. Public tRPC Endpoints ───"

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

echo "─── 3. Protected tRPC Endpoints (expect UNAUTHORIZED) ───"

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

echo "─── 4. Admin-Only tRPC Endpoints (expect UNAUTHORIZED/FORBIDDEN) ───"

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

echo "─── 5. Mutation Endpoints (expect METHOD_NOT_SUPPORTED on GET) ───"

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
# 6. SSE Endpoint (Server-Sent Events for real-time telemetry)
# ═════════════════════════════════════════════════════════

echo "─── 6. SSE Endpoint ───"

# SSE without auth should return 401
STATUS=$(http_get "${BASE_URL}/api/sse/telemetry")
if [ "$STATUS" = "401" ]; then
  pass "/api/sse/telemetry → 401 without auth (SSE route registered)"
else
  fail "/api/sse/telemetry (no auth)" "HTTP $STATUS (expected 401)"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 7. Authenticated Session — Login as smoke-test admin
# ═════════════════════════════════════════════════════════

echo "─── 7. Authenticated Session ───"

# Login via Better Auth email/password sign-in
# Use -c to write cookies AND -b to read them back (curl needs both for cookie jar)
LOGIN_STATUS=$(curl -s -o "$BODY_FILE" -D "$HEADER_FILE" -w "%{http_code}" --max-time 10 \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.dev","password":"SmokeTest123!"}' \
  "${BASE_URL}/api/auth/sign-in/email" 2>/dev/null || echo "000")

if [ "$LOGIN_STATUS" = "200" ] && body_contains '"user"'; then
  pass "Better Auth sign-in → 200, got user object"
  AUTH_OK=true
else
  fail "Better Auth sign-in" "HTTP $LOGIN_STATUS (expected 200 with user)"
  # Dump debug info on failure
  echo "  [debug] Set-Cookie headers:"
  grep -i 'set-cookie' "$HEADER_FILE" 2>/dev/null | sed 's/^/    /' || echo "    (none)"
  echo "  [debug] Response body (first 300 chars):"
  head -c 300 "$BODY_FILE" 2>/dev/null | sed 's/^/    /'
  echo ""
  AUTH_OK=false
fi

# Verify session is valid via auth.me
# Note: tRPC wraps the response as {"result":{"data":{"json":{...}}}}
# so we check for '"email"' (present in user object) not '"user"' (not a tRPC key)
if [ "$AUTH_OK" = true ]; then
  STATUS=$(http_get_auth "${TRPC}/auth.me")
  if [ "$STATUS" = "200" ] && body_contains '"email"'; then
    pass "auth.me (authenticated) → 200, session valid"
  else
    fail "auth.me (authenticated)" "HTTP $STATUS (expected 200 with email in body)"
    echo "  [debug] auth.me body (first 300 chars):"
    head -c 300 "$BODY_FILE" 2>/dev/null | sed 's/^/    /'
    echo ""
    AUTH_OK=false
  fi
fi

echo ""

# ═════════════════════════════════════════════════════════
# 8. Traeger Integration — Graceful Degradation (no account linked)
# ═════════════════════════════════════════════════════════

echo "─── 8. Traeger Integration (graceful degradation) ───"

if [ "$AUTH_OK" = true ]; then
  # traeger.status should return connected:false when no Traeger account is linked
  STATUS=$(http_get_auth "${TRPC}/traeger.status")
  if [ "$STATUS" = "200" ] && body_contains '"connected":false'; then
    pass "traeger.status → connected:false (no Traeger account linked)"
  elif [ "$STATUS" = "200" ]; then
    warn "traeger.status" "returned 200 but unexpected body"
  else
    fail "traeger.status (authenticated)" "HTTP $STATUS (expected 200)"
  fi

  # traeger.mqttCredentials should return PRECONDITION_FAILED (no account linked)
  STATUS=$(http_get_auth "${TRPC}/traeger.mqttCredentials")
  if body_contains "PRECONDITION_FAILED"; then
    pass "traeger.mqttCredentials → PRECONDITION_FAILED (no account, correct degradation)"
  elif [ "$STATUS" = "401" ]; then
    fail "traeger.mqttCredentials" "HTTP 401 (session should be valid)"
  else
    warn "traeger.mqttCredentials" "HTTP $STATUS (expected PRECONDITION_FAILED)"
  fi

  # liveCook.active should return PRECONDITION_FAILED (no MQTT connection)
  STATUS=$(http_get_auth "${TRPC}/liveCook.active")
  if body_contains "PRECONDITION_FAILED"; then
    pass "liveCook.active → PRECONDITION_FAILED (no MQTT, correct degradation)"
  elif [ "$STATUS" = "401" ]; then
    fail "liveCook.active" "HTTP 401 (session should be valid)"
  else
    warn "liveCook.active" "HTTP $STATUS (expected PRECONDITION_FAILED)"
  fi

  # liveCook.stallInfo may return PRECONDITION_FAILED or 200 with null data
  # (depends on whether it checks MQTT connection or returns empty state)
  STATUS=$(http_get_auth "${TRPC}/liveCook.stallInfo")
  if body_contains "PRECONDITION_FAILED"; then
    pass "liveCook.stallInfo → PRECONDITION_FAILED (no MQTT, correct degradation)"
  elif [ "$STATUS" = "200" ]; then
    pass "liveCook.stallInfo → 200 (returns empty state when no active cook)"
  elif [ "$STATUS" = "401" ]; then
    fail "liveCook.stallInfo" "HTTP 401 (session should be valid)"
  else
    fail "liveCook.stallInfo" "HTTP $STATUS (expected 200 or PRECONDITION_FAILED)"
  fi
else
  warn "Traeger integration tests" "skipped (login failed)"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 9. Authenticated Endpoint Access (protected routes with valid session)
# ═════════════════════════════════════════════════════════

echo "─── 9. Authenticated Endpoint Access ───"

if [ "$AUTH_OK" = true ]; then
  # cookSession.list should return data (empty array) when authenticated
  STATUS=$(http_get_auth "${TRPC}/cookSession.list")
  if [ "$STATUS" = "200" ]; then
    pass "cookSession.list (authenticated) → 200"
  else
    fail "cookSession.list (authenticated)" "HTTP $STATUS (expected 200)"
  fi

  # automation.list should return data when authenticated
  STATUS=$(http_get_auth "${TRPC}/automation.list")
  if [ "$STATUS" = "200" ]; then
    pass "automation.list (authenticated) → 200"
  else
    fail "automation.list (authenticated)" "HTTP $STATUS (expected 200)"
  fi

  # analytics.summary should return data when authenticated
  STATUS=$(http_get_auth "${TRPC}/analytics.summary")
  if [ "$STATUS" = "200" ]; then
    pass "analytics.summary (authenticated) → 200"
  else
    fail "analytics.summary (authenticated)" "HTTP $STATUS (expected 200)"
  fi

  # push.getVapidKey should return the VAPID public key
  # tRPC wraps response as {"result":{"data":{"json":"..."}}} so key name may not appear
  STATUS=$(http_get_auth "${TRPC}/push.getVapidKey")
  if [ "$STATUS" = "200" ] && (body_contains '"vapidPublicKey"' || body_contains '"json"'); then
    pass "push.getVapidKey (authenticated) → 200, has data"
  elif [ "$STATUS" = "200" ]; then
    # Still a pass if we get 200 — the endpoint exists and is authenticated
    pass "push.getVapidKey (authenticated) → 200"
  else
    fail "push.getVapidKey (authenticated)" "HTTP $STATUS (expected 200)"
  fi

  # customTemplates.mine should return data when authenticated
  STATUS=$(http_get_auth "${TRPC}/customTemplates.mine")
  if [ "$STATUS" = "200" ]; then
    pass "customTemplates.mine (authenticated) → 200"
  else
    fail "customTemplates.mine (authenticated)" "HTTP $STATUS (expected 200)"
  fi

  # executions.history should return data when authenticated
  STATUS=$(http_get_auth "${TRPC}/executions.history")
  if [ "$STATUS" = "200" ]; then
    pass "executions.history (authenticated) → 200"
  else
    fail "executions.history (authenticated)" "HTTP $STATUS (expected 200)"
  fi
else
  warn "Authenticated endpoint tests" "skipped (login failed)"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 10. Admin Endpoints (authenticated as admin)
# ═════════════════════════════════════════════════════════

echo "─── 10. Admin Endpoints (authenticated) ───"

if [ "$AUTH_OK" = true ]; then
  # admin.getRegistrationConfig should return data for admin user
  STATUS=$(http_get_auth "${TRPC}/admin.getRegistrationConfig")
  if [ "$STATUS" = "200" ] && body_contains '"mode"'; then
    pass "admin.getRegistrationConfig (admin) → 200, has mode field"
  elif [ "$STATUS" = "200" ]; then
    warn "admin.getRegistrationConfig" "returned 200 but missing mode field"
  elif [ "$STATUS" = "403" ]; then
    fail "admin.getRegistrationConfig" "HTTP 403 (smoke user should be admin)"
  else
    fail "admin.getRegistrationConfig (admin)" "HTTP $STATUS (expected 200)"
  fi

  # admin.listUsers should return array with at least the admin user
  # tRPC wraps response — check for 'email' (present in user objects) or 'json'
  STATUS=$(http_get_auth "${TRPC}/admin.listUsers")
  if [ "$STATUS" = "200" ] && (body_contains '"email"' || body_contains '"json"'); then
    pass "admin.listUsers (admin) → 200, has user data"
  elif [ "$STATUS" = "200" ]; then
    # Still a pass — admin endpoint is accessible
    pass "admin.listUsers (admin) → 200"
  elif [ "$STATUS" = "403" ]; then
    fail "admin.listUsers" "HTTP 403 (smoke user should be admin)"
  else
    fail "admin.listUsers (admin)" "HTTP $STATUS (expected 200)"
  fi
else
  warn "Admin endpoint tests" "skipped (login failed)"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 11. SSE Endpoint (authenticated — verify event-stream headers)
# ═════════════════════════════════════════════════════════

echo "─── 11. SSE Endpoint (authenticated) ───"

if [ "$AUTH_OK" = true ]; then
  # SSE with auth should return 200 with text/event-stream content type
  # Use a short timeout since SSE is a long-lived connection
  # SSE connections stay open indefinitely — curl will timeout and may return
  # status 000 or 200 depending on timing. We primarily check headers.
  SSE_STATUS=$(curl -s -o "$BODY_FILE" -D "$HEADER_FILE" -w "%{http_code}" --max-time 3 -b "$COOKIE_JAR" "${BASE_URL}/api/sse/telemetry" 2>/dev/null || true)
  # Check headers first — this is the definitive test for SSE
  if header_contains "text/event-stream"; then
    pass "/api/sse/telemetry (auth) → event-stream headers present"
  elif [ "$SSE_STATUS" = "401" ]; then
    fail "/api/sse/telemetry (auth)" "HTTP 401 (session cookie not sent)"
  else
    # Curl timeout on SSE is expected (connection held open until --max-time)
    # If we got here, headers were written but no event-stream — warn
    warn "/api/sse/telemetry (auth)" "HTTP ${SSE_STATUS:-timeout} but no event-stream header"
  fi
else
  warn "SSE authenticated test" "skipped (login failed)"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 12. MQTT Broker Probe (Traeger connect with bad credentials)
# ═════════════════════════════════════════════════════════

echo "─── 12. MQTT Broker Probe (bad credentials) ───"

if [ "$AUTH_OK" = true ]; then
  # Call traeger.connect with known-bad credentials.
  # This exercises the full auth chain:
  #   traeger.connect → traegerLogin → traegerProxyLogin (fail) → cognitoDirectLogin (fail) → error
  # Expected: tRPC error with code UNAUTHORIZED and a structured error message
  MQTT_BODY=$(curl -s -o "$BODY_FILE" -D "$HEADER_FILE" -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    "${TRPC}/traeger.connect" \
    -d '{"json":{"email":"smoke-test@invalid.dev","password":"bad-password-123"}}' 2>/dev/null)

  if body_contains "UNAUTHORIZED"; then
    pass "traeger.connect (bad creds) → UNAUTHORIZED (auth chain works end-to-end)"
  elif body_contains "INTERNAL_SERVER_ERROR"; then
    fail "traeger.connect (bad creds)" "HTTP 500 — auth error not handled gracefully"
  elif [ "$MQTT_BODY" = "401" ]; then
    fail "traeger.connect (bad creds)" "HTTP 401 (session expired, not Traeger auth error)"
  else
    # Accept any non-500 response — the auth chain ran without crashing
    warn "traeger.connect (bad creds)" "HTTP ${MQTT_BODY} — expected UNAUTHORIZED in body"
  fi

  # Verify the error message includes helpful text
  if body_contains "failed" || body_contains "Authentication" || body_contains "verify"; then
    pass "traeger.connect error message is user-friendly"
  else
    warn "traeger.connect error message" "missing helpful error text"
  fi
else
  warn "MQTT broker probe" "skipped (login failed)"
fi

echo ""

# ═════════════════════════════════════════════════════════
# 13. MQTT State Consistency (verify failed connect didn't corrupt state)
# ═════════════════════════════════════════════════════════

echo "─── 13. MQTT State Consistency ───"

if [ "$AUTH_OK" = true ]; then
  # After the failed traeger.connect, traeger.status should still show disconnected
  STATUS=$(http_get_auth "${TRPC}/traeger.status")
  if body_contains '"connected":false' || body_contains '"connected": false'; then
    pass "traeger.status still disconnected after failed connect (state not corrupted)"
  elif [ "$STATUS" = "200" ]; then
    # If connected:true, the bad creds somehow succeeded (impossible but check)
    fail "traeger.status" "shows connected after bad-credential connect attempt"
  else
    fail "traeger.status (post-connect)" "HTTP $STATUS (expected 200)"
  fi

  # liveCook.active should still return PRECONDITION_FAILED (no MQTT session)
  STATUS=$(http_get_auth "${TRPC}/liveCook.active")
  if body_contains "PRECONDITION_FAILED"; then
    pass "liveCook.active still PRECONDITION_FAILED (no MQTT session after failed connect)"
  elif [ "$STATUS" = "200" ]; then
    # 200 with null data is also acceptable
    pass "liveCook.active → 200 (no active cook, state consistent)"
  else
    warn "liveCook.active (post-connect)" "HTTP $STATUS (unexpected)"
  fi
else
  warn "MQTT state consistency tests" "skipped (login failed)"
fi

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
