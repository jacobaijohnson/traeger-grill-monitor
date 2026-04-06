-- P0: Add database indexes for query performance
-- NOTE: Table names match drizzle/schema.ts definitions.
-- Run these after initial schema creation. Safe to re-run (will error on duplicates, not break data).

-- telemetry_readings: queried constantly for charts and history
CREATE INDEX idx_telemetry_user_grill_time ON telemetry_readings (userId, grillId, recordedAt);

-- automation_programs: filtered by user + status on every page load
CREATE INDEX idx_automation_user_status ON automation_programs (userId, status);
CREATE INDEX idx_automation_user_active ON automation_programs (userId, isActive);
CREATE INDEX idx_automation_user_published ON automation_programs (userId, isPublished);

-- cook_sessions: listed per user, filtered by grill
CREATE INDEX idx_sessions_user_grill ON cook_sessions (userId, grillId);
CREATE INDEX idx_sessions_user_started ON cook_sessions (userId, startedAt);

-- program_executions: history queries filter by user + program
CREATE INDEX idx_executions_user_program ON program_executions (userId, automationProgramId);
CREATE INDEX idx_executions_user_started ON program_executions (userId, startedAt);

-- pellet_logs: trend charts filter by user + grill + time
CREATE INDEX idx_pellets_user_grill_time ON pellet_logs (userId, grillId, recordedAt);

-- cook_alerts: looked up per session
CREATE INDEX idx_alerts_user_session ON cook_alerts (userId, cookSessionId);

-- traeger_sessions: looked up by userId on every authenticated request
CREATE INDEX idx_traeger_sessions_user ON traeger_sessions (userId);

-- custom_templates: community browsing + user library
CREATE INDEX idx_templates_user ON custom_templates (userId);
CREATE INDEX idx_templates_published ON custom_templates (isPublished);
