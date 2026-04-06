// Traeger API types

export interface TraegerTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TraegerGrill {
  thingName: string;
  friendlyName: string;
  deviceTypeId: string;
  status: string;
}

export interface TraegerUserData {
  userId: string;
  givenName: string;
  familyName: string;
  email: string;
  things: TraegerGrill[];
}

export interface TraegerTelemetry {
  grill: number;
  set: number;
  ambient: number;
  pelletLevel: number;
  connected: boolean;
  systemStatus: number;
  probe: number;
  probeSet: number;
  probeCon: number;
  probeAlarmFired: number;
  keepwarm: number;
  smoke: number;
  units: number;
  cookTimerStart: number;
  cookTimerEnd: number;
  acc: unknown[];
}

export interface TraegerMqttCredentials {
  signedUrl: string;
  expirationSeconds: number;
  expiresAt: string;
}

// System status codes
export const SYSTEM_STATUS: Record<number, { label: string; color: string; description: string }> = {
  2: { label: "Sleeping", color: "gray", description: "Power on, screen off" },
  3: { label: "Idle", color: "blue", description: "Power on, ready" },
  4: { label: "Igniting", color: "yellow", description: "Ignition in progress" },
  5: { label: "Preheating", color: "orange", description: "Heating to target" },
  6: { label: "Cooking", color: "green", description: "At temp, cooking" },
  7: { label: "Custom Cook", color: "purple", description: "Running custom program" },
  8: { label: "Cool Down", color: "cyan", description: "Cooling after shutdown" },
  9: { label: "Shutdown", color: "red", description: "Shutdown complete" },
  99: { label: "Offline", color: "gray", description: "Not connected" },
};

export function getSystemStatus(code: number) {
  return SYSTEM_STATUS[code] || { label: "Unknown", color: "gray", description: `Unknown state (${code})` };
}

// Command codes
export const COMMANDS = {
  SET_TEMP: "11",
  SET_TIMER: "12",
  CLEAR_TIMER: "13",
  SET_PROBE_ALARM: "14",
  SHUTDOWN: "17",
  KEEP_WARM_ON: "18",
  KEEP_WARM_OFF: "19",
  SUPER_SMOKE_ON: "20",
  SUPER_SMOKE_OFF: "21",
  STATUS_REQUEST: "90",
} as const;

// Cooking method types
export type CookingMethod = "smoke" | "grill" | "reverse_sear" | "roast" | "bake";

export interface CookStage {
  name: string;
  grillTemp: number;
  triggerType: "time" | "probe_temp" | "manual";
  triggerValue: number; // seconds for time, degrees for probe_temp
  superSmoke: boolean;
  alertMessage: string;
}

/**
 * Extended stage for automation programs.
 * Adds alarm behavior, auto-commands, and escalation rules.
 */
export interface AutomationStage {
  name: string;
  grillTemp: number;                          // Target grill temp for this phase
  triggerType: "probe_temp" | "time" | "manual";
  triggerValue: number;                       // Probe °F or seconds
  superSmoke: boolean;
  alertMessage: string;
  // --- Automation extensions ---
  alertType: "notification" | "alarm";        // alarm = persistent, requires dismiss
  alarmIntervalDegrees?: number;              // Re-alarm every N°F (e.g., 5 = alarm at 160, 165, 170...)
  alarmMaxTemp?: number;                      // Stop re-alarming above this temp
  autoSetGrillTemp?: number;                  // Auto-send setTemp command when trigger fires
  autoSetSuperSmoke?: boolean;                // Auto-toggle super smoke when entering this phase
  autoSetKeepWarm?: boolean;                  // Auto-toggle keep warm when entering this phase
  holdAfterTrigger?: boolean;                 // Stay in this phase after trigger (for rest/hold)
  requireAcknowledge?: boolean;               // Block phase advance until user acknowledges
  // --- Compound trigger extensions ---
  secondaryTriggerType?: "probe_temp" | "time" | "manual";
  secondaryTriggerValue?: number;
  triggerLogic?: "or" | "and" | "fallback" | "priority";  // How primary + secondary combine
  primaryFired?: boolean;                     // Runtime: has primary trigger fired (for AND logic)
  secondaryFired?: boolean;                   // Runtime: has secondary trigger fired (for AND logic)
  timerStartedAt?: number;                    // Runtime: when timer-based trigger started counting
}

/**
 * Minimum grill temperature supported by Traeger API.
 * Most models support 165°F as the lowest (Smoke setting).
 */
export const MIN_GRILL_TEMP = 165;
export const MAX_GRILL_TEMP = 500;

export interface CookTemplate {
  id: string;
  name: string;
  category: "beef" | "pork" | "poultry" | "lamb" | "seafood" | "other";
  method: CookingMethod;
  cut: string;
  description: string;
  estimatedTime: string;
  stages: CookStage[];
  tips: string[];
  weightBased: boolean;
  timePerPound?: number; // minutes per pound
}

// Pellet consumption rates (lbs per hour)
export const PELLET_BURN_RATES: Record<string, number> = {
  low: 1.0,    // 180-225°F
  medium: 1.75, // 250-300°F
  high: 2.5,   // 350-450°F
};

export function estimatePelletBurnRate(temp: number): number {
  if (temp <= 225) return PELLET_BURN_RATES.low;
  if (temp <= 300) return PELLET_BURN_RATES.medium;
  return PELLET_BURN_RATES.high;
}
