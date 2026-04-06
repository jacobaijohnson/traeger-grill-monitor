-- P0: Add database indexes for query performance
-- telemetry_data: queried constantly for charts and history
CREATE INDEX idx_telemetry_user_grill_time ON telemetry_data (userId, grillId, recordedAt);

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

-- pellet_readings: trend charts filter by user + grill + time
CREATE INDEX idx_pellets_user_grill_time ON pellet_readings (userId, grillId, recordedAt);

-- session_alerts: looked up per session
CREATE INDEX idx_alerts_user_session ON session_alerts (userId, cookSessionId);
