-- PERF-3: Add missing index on telemetry_readings(cookSessionId)
-- Used by getTelemetryForSession() which queries by cookSessionId
CREATE INDEX IF NOT EXISTS idx_telemetry_cook_session ON telemetry_readings (cookSessionId);

-- PERF-4: Add missing composite index on cook_sessions(userId, status)
-- Used by getActiveCookSession() which filters by userId + status='active'
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON cook_sessions (userId, status);

-- PERF-5: Telemetry retention purge index (recordedAt for DELETE WHERE recordedAt < cutoff)
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_readings (recordedAt);

-- PERF-6: Program executions outcome filter (used in analytics)
CREATE INDEX IF NOT EXISTS idx_executions_user_outcome ON program_executions (userId, outcome);
