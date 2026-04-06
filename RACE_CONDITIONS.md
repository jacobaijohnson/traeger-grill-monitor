# Race Condition Audit — Traeger Dashboard

## RC-1: Stale DB Connection (Root Cause of ECONNRESET)

**Location**: `server/db/connection.ts` — `getDb()`

**Problem**: The Drizzle connection is cached in a module-level `_db` variable. Once created, it's reused forever. When the underlying MySQL TCP connection drops (idle timeout, network blip, TiDB server restart), the cached `_db` still holds the dead socket. Every subsequent query hits `ECONNRESET` because the driver tries to write to a closed socket. There is no health check, no reconnect, and no retry.

**Impact**: All DB writes fail silently (telemetry persist, cook state persist) until the server is restarted. The MQTT manager's `setInterval` fires every 30s, each call hits the dead connection, logs the error, and moves on — losing all telemetry data.

**Fix**: 
1. Configure mysql2 connection pool with `enableKeepAlive: true` and reasonable pool limits
2. Add a `withRetry` wrapper around `getDb()` that invalidates `_db` on connection errors and recreates it
3. Add a query-level retry wrapper for critical persist operations

---

## RC-2: Concurrent MQTT Reconnect / Callback Registration

**Location**: `server/routers/helpers.ts` — `ensureMqttConnected()`

**Problem**: Two concurrent tRPC calls from the same user can both enter the `if (!isMqttConnected || needsUrlRefresh)` block simultaneously. Both will:
1. Fetch MQTT credentials (duplicate API call)
2. Call `connectMqtt()` or `refreshMqttUrl()` (second call disconnects the first's just-created session)
3. Register DB persist callbacks (stale closures from the first call may reference the now-deleted session)
4. Hydrate history twice (duplicate DB reads)

**Impact**: Wasted API calls, potential brief data loss during the overlap window, stale callback closures.

**Fix**: Add a per-user connection mutex/lock so only one `ensureMqttConnected` runs at a time per userId. Subsequent callers wait for the first to finish.

---

## RC-3: setInterval Closure Over Stale Session Reference

**Location**: `server/mqtt-manager.ts` — `connectMqtt()` line 326

**Problem**: The `setInterval` callback at line 326 captures `session` in its closure. When `refreshMqttUrl()` calls `disconnectMqtt()` then `connectMqtt()`, the old interval is cleared in `disconnectMqtt()`, but there's a race window: if the interval fires between `sessions.set(userId, session)` (line 213) and the old interval being cleared (line 350-352), the old callback runs against the new session object. More critically, `connectMqtt()` creates a new `session` object but preserves `existing?.dbPersistCallback` — if the callback was registered on the old session, it still works, but if the callback itself captures stale references, those are lost.

**Impact**: Potential duplicate persist calls during reconnect, or missed persist if callbacks aren't re-registered.

**Fix**: Clear the old interval BEFORE creating the new session. Move `disconnectMqtt()` to happen before `sessions.set()`.

---

## RC-4: Fire-and-Forget Async Persist Without Backpressure

**Location**: `server/mqtt-manager.ts` — lines 280-284 (cook state persist) and lines 326-338 (telemetry persist)

**Problem**: Both persist callbacks are fire-and-forget (`.catch()` swallows errors). If the DB is slow or temporarily down, multiple persist calls stack up concurrently. There's no queue, no backpressure, no deduplication. With MQTT messages arriving every ~2 seconds and the interval at 30s, the cook state persist fires every 5th message (~10s), potentially overlapping with the interval persist.

**Impact**: Under DB pressure, dozens of concurrent writes pile up, exhausting the connection pool. When the pool is exhausted, new queries fail with timeouts or ECONNRESET.

**Fix**: Add a simple "persist in flight" flag per session. If a persist is already running, skip the new one (latest-wins debounce). This prevents pile-up without losing data since the next persist will capture the latest state.

---

## RC-5: SSE Client Set Mutation During Iteration

**Location**: `server/sse.ts` — `pushTelemetryUpdate()`, `pushAlertEvent()`, `pushDisconnectEvent()`

**Problem**: The code correctly converts to `Array.from(clients)` before iterating, which prevents mutation-during-iteration. However, `removeClient()` can be called from both the `req.on("close")` handler AND the `catch` block in the push functions. If a client disconnects at the exact moment a push is happening, both paths try to `clients.delete(res)` — this is safe for Set but could cause a double-cleanup of the keepalive interval if `req.on("close")` fires after the catch block already removed the client.

**Impact**: Minor — potential double `clearInterval` call (harmless) or a missed cleanup. Not a data integrity issue.

**Fix**: Add a `cleaned` flag to prevent double cleanup, or just accept the current behavior as safe enough.

---

## RC-6: History Array Mutation During Read

**Location**: `server/mqtt-manager.ts` — `session.history`

**Problem**: The MQTT message handler pushes to `session.history` and occasionally slices it (line 262-264). Meanwhile, `getTelemetryHistory()` reads from the same array, and `hydrateHistory()` replaces it entirely. If a tRPC query reads `session.history` while the MQTT handler is mid-slice, the reader could get a partially-updated array.

**Impact**: In practice, JavaScript is single-threaded so true concurrent mutation doesn't happen. However, the `hydrateHistory()` function does `session.history = [...dbPoints, ...session.history]` which creates a new array reference. Any in-progress iteration over the old array would still see consistent data (old snapshot), so this is safe. **No fix needed** — JavaScript's event loop protects us here.

---

## Summary of Fixes Needed

| ID | Severity | Fix |
|----|----------|-----|
| RC-1 | **Critical** | Add mysql2 pool config with keepAlive, add connection reset on error, add query retry |
| RC-2 | **High** | Add per-user connection mutex to `ensureMqttConnected()` |
| RC-3 | **Medium** | Ensure old interval is cleared before new session is created |
| RC-4 | **Medium** | Add persist-in-flight flag to prevent concurrent DB write pile-up |
| RC-5 | **Low** | Acceptable as-is (Set operations are idempotent) |
| RC-6 | **None** | JS event loop makes this safe |
