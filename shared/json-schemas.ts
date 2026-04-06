/**
 * JSON Schema documentation for all JSON columns in the database.
 *
 * These schemas define the structure of data stored in JSON/TEXT columns
 * across the application's database tables. They serve as documentation
 * and can be used for runtime validation if needed.
 *
 * P2-DOC: Addresses the Spec Forge finding that JSON columns lacked
 * documented schemas, making it unclear what structure to expect.
 */

// ─── traeger_sessions.grills_json ──────────────────────────
/**
 * Array of Traeger grill devices associated with the user's account.
 * Stored in: traeger_sessions.grills_json
 */
export interface GrillDevice {
  /** Unique identifier for the grill (AWS IoT thingName) */
  thingName: string;
  /** User-assigned name for the grill (e.g., "Backyard Pro 780") */
  friendlyName: string;
  /** Model identifier (e.g., "TFB78GLE") */
  modelNumber?: string;
  /** Firmware version currently installed */
  firmwareVersion?: string;
}

export type GrillsJson = GrillDevice[];

// ─── cook_sessions.stages_json ─────────────────────────────
/**
 * Array of cook stages defining the multi-stage cook program.
 * Stored in: cook_sessions.stages_json
 */
export interface CookStage {
  /** Human-readable stage name (e.g., "Smoke Phase", "Sear") */
  name: string;
  /** Target grill temperature in °F */
  grillTemp: number;
  /** What triggers advancement to the next stage */
  triggerType: "time" | "probe_temp" | "manual";
  /** Trigger threshold: seconds for "time", °F for "probe_temp", 0 for "manual" */
  triggerValue: number;
  /** Whether Super Smoke mode should be active during this stage */
  superSmoke: boolean;
  /** Message to display when this stage completes */
  alertMessage: string;
}

export type StagesJson = CookStage[];

// ─── cook_sessions.alerts_json ─────────────────────────────
/**
 * Array of cook alerts (temperature markers, custom alerts).
 * Stored in: cook_sessions.alerts_json (persisted from MQTT state)
 */
export interface PersistedCookAlert {
  /** Unique alert ID (e.g., "marker-165-1712345678", "custom-1712345679") */
  id: string;
  /** Human-readable label (e.g., "Medium Rare", "Wrap Point") */
  label: string;
  /** Temperature threshold in °F that triggers this alert */
  triggerTemp: number;
  /** Which temperature source to monitor */
  triggerType: "probe" | "grill";
  /** How to notify the user */
  alertType: "notification" | "alarm";
  /** Current state of the alert */
  status: "pending" | "fired" | "dismissed";
  /** Optional message to display when fired */
  message?: string;
  /** Timestamp (ms) when the alert was fired */
  firedAt?: number;
}

export type AlertsJson = PersistedCookAlert[];

// ─── custom_cook_templates.stages_json ─────────────────────
/**
 * Same structure as CookStage[], used for custom user-created templates.
 * Stored in: custom_cook_templates.stages_json
 */
export type CustomTemplateStagesJson = CookStage[];

// ─── custom_cook_templates.tips_json ───────────────────────
/**
 * Array of pro tips / notes for the template.
 * Stored in: custom_cook_templates.tips_json
 */
export type CustomTemplateTipsJson = string[];

// ─── automation_programs.stages_json ───────────────────────
/**
 * Same structure as CookStage[], used for automation programs.
 * Stored in: automation_programs.stages_json
 */
export type AutomationStagesJson = CookStage[];

// ─── Validation helpers ────────────────────────────────────

/**
 * Safely parse a JSON column value. Returns the parsed value or a default.
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/**
 * Validate that a stages array has the expected shape.
 */
export function isValidStagesJson(value: unknown): value is CookStage[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      typeof s.name === "string" &&
      typeof s.grillTemp === "number" &&
      ["time", "probe_temp", "manual"].includes(s.triggerType) &&
      typeof s.triggerValue === "number" &&
      typeof s.superSmoke === "boolean" &&
      typeof s.alertMessage === "string"
  );
}

/**
 * Validate that an alerts array has the expected shape.
 */
export function isValidAlertsJson(value: unknown): value is PersistedCookAlert[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (a) =>
      typeof a === "object" &&
      a !== null &&
      typeof a.id === "string" &&
      typeof a.label === "string" &&
      typeof a.triggerTemp === "number" &&
      ["probe", "grill"].includes(a.triggerType) &&
      ["notification", "alarm"].includes(a.alertType) &&
      ["pending", "fired", "dismissed"].includes(a.status)
  );
}
