/**
 * Barrel re-export for all database modules.
 * Preserves backward compatibility — existing `import { ... } from "./db"` still works.
 */

// Connection & user helpers
export { getDb } from "./connection";

// Traeger sessions
export {
  upsertTraegerSession,
  getTraegerSession,
  updateTraegerSessionTokens,
  updateSelectedGrill,
  deleteTraegerSession,
} from "./traeger-sessions";

// Telemetry
export {
  insertTelemetry,
  getTelemetryForSession,
  getRecentTelemetry,
  persistTelemetryFromMqtt,
  purgeStaleTelemetry,
  getTelemetryCount,
} from "./telemetry";

// Cook sessions & alerts
export {
  createCookSession,
  endCookSession,
  updateCookSessionNotes,
  getUserCookSessions,
  getCookSession,
  getActiveCookSession,
  updateCookSessionStatus,
  updateCookSessionAlerts,
  updateCookSessionStages,
  insertCookAlert,
  getCookAlertsForSession,
  updateCookAlertStatus,
  dismissCookAlert,
} from "./cook-sessions";

// Templates & automation
export {
  createCustomTemplate,
  getUserCustomTemplates,
  getPublishedTemplates,
  getCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  forkCustomTemplate,
  createAutomationProgram,
  getUserAutomationPrograms,
  getActiveAutomation,
  updateAutomationState,
  deleteAutomationProgram,
  getAutomationProgram,
  publishAutomationProgram,
  getPublishedAutomationPrograms,
  forkAutomationProgram,
} from "./templates";

// Analytics
export {
  getCookAnalyticsSummary,
  getCooksByMeatType,
  getCooksByMethod,
  getCooksByMonth,
  getCooksByCut,
  getRatingDistribution,
  type CookAnalyticsSummary,
  type CookByMeatType,
  type CookByMethod,
  type CookByMonth,
  type CookByCut,
  type RatingDistribution,
} from "./analytics";

// Execution history
export {
  createProgramExecution,
  getUserExecutionHistory,
  getProgramExecution,
  updateExecutionOutcome,
  updateExecutionReview,
  appendExecutionLog,
  linkCookSession,
  getExecutionsForProgram,
  getActiveExecution,
} from "./executions";

// Access control & settings
export {
  getSetting,
  setSetting,
  getAllSettings,
  getRegistrationConfig,
  setRegistrationConfig,
  createInviteCode,
  validateInviteCode,
  consumeInviteCode,
  listInviteCodes,
  deleteInviteCode,
  isEmailAllowed,
  addToAllowlist,
  removeFromAllowlist,
  listAllowlist,
  listAllUsers,
  updateUserRole,
  banUser,
  unbanUser,
  deleteUser,
  getPendingUsers,
  approveUser,
  type RegistrationMode,
  type RegistrationGate,
} from "./access-control";

// Pellet tracking
export {
  insertPelletLog,
  getRecentPelletLogs,
  getPelletLogsForSession,
  getPelletConsumptionSummary,
  getPelletTrend,
  persistPelletFromMqtt,
  type PelletConsumptionSummary,
} from "./pellet";
