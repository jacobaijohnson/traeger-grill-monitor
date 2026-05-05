/**
 * Cook Program types and preset library.
 * Programs are the richer automation model that replaces simple CookStage arrays.
 */

// ─── Types ──────────────────────────────────────────────

export interface ProgramVariable {
  name: string;             // e.g., "smoke_temp"
  label: string;            // e.g., "Smoke Temperature"
  type: "number" | "enum" | "text";
  default: string | number;
  options?: string[];       // For enum type
  min?: number;             // For number type
  max?: number;
  unit?: string;            // "°F", "lbs", "minutes"
  description?: string;
}

export type TriggerType =
  | "probe_temp"
  | "probe_temp_drop"
  | "grill_temp"
  | "grill_temp_drop"
  | "timer"
  | "pellet_low"
  | "manual"
  | "immediate";

/**
 * Compound trigger system.
 * - `type` + `value` = primary trigger
 * - `secondary` = optional second trigger
 * - `logic` controls how they combine:
 *     "or"       → whichever fires first advances the step
 *     "and"      → both must be satisfied before advancing
 *     "fallback" → primary is preferred, secondary is a safety net (same as "or" in execution)
 *     "priority" → secondary runs in background, primary takes precedence if it fires
 *   If no logic is set, only the primary trigger is used.
 */
export interface StepTrigger {
  type: TriggerType;
  value?: number | string;   // Supports {{variable}} references; optional for manual/immediate
  secondary?: {
    type: TriggerType;
    value?: number | string;
  };
  logic?: "or" | "and" | "fallback" | "priority";
}

export type ActionType =
  | "set_grill_temp"
  | "set_probe_alarm"
  | "set_timer"
  | "clear_timer"
  | "super_smoke_on"
  | "super_smoke_off"
  | "keep_warm_on"
  | "keep_warm_off"
  | "shutdown"
  | "send_notification"
  | "sound_alarm"
  | "escalating_alarm"
  | "wait_for_ack"
  | "log_event"
  | "end_session";

export interface StepAction {
  type: ActionType;
  params?: Record<string, number | string | boolean>;
}

export interface ProgramStep {
  name: string;
  description?: string;
  trigger: StepTrigger;
  actions: StepAction[];
  entryActions?: StepAction[];
  alertOnTrigger?: {
    type: "notification" | "alarm";
    message: string;
    escalating?: {
      intervalDegrees: number;
      maxTemp?: number;
    };
  };
}

export interface CookProgram {
  // Metadata
  name: string;
  description: string;
  category: "beef" | "pork" | "poultry" | "lamb" | "seafood" | "other";
  method: "smoke" | "grill" | "reverse_sear" | "roast" | "bake";
  meatCut?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime?: string;
  tags: string[];

  // Variables
  variables: ProgramVariable[];

  // Steps (executed in order)
  steps: ProgramStep[];

  // Tips & notes
  tips: string[];
}

// ─── Action Metadata (for UI builder) ───────────────────

export interface ActionMeta {
  type: ActionType;
  label: string;
  category: "hardware" | "alert" | "flow" | "software";
  description: string;
  params?: Array<{
    name: string;
    label: string;
    type: "number" | "string" | "boolean";
    min?: number;
    max?: number;
    unit?: string;
    required?: boolean;
  }>;
}

export const ACTION_CATALOG: ActionMeta[] = [
  // Hardware
  { type: "set_grill_temp", label: "Set Grill Temp", category: "hardware", description: "Change the grill target temperature", params: [{ name: "temp", label: "Temperature", type: "number", min: 165, max: 500, unit: "°F", required: true }] },
  { type: "set_probe_alarm", label: "Set Probe Alarm", category: "hardware", description: "Set the hardware probe temperature alarm", params: [{ name: "temp", label: "Temperature", type: "number", min: 100, max: 220, unit: "°F", required: true }] },
  { type: "set_timer", label: "Set Timer", category: "hardware", description: "Start a countdown timer on the grill", params: [{ name: "seconds", label: "Duration", type: "number", min: 60, max: 86400, unit: "seconds", required: true }] },
  { type: "clear_timer", label: "Clear Timer", category: "hardware", description: "Cancel the running grill timer" },
  { type: "super_smoke_on", label: "Super Smoke On", category: "hardware", description: "Enable super smoke mode" },
  { type: "super_smoke_off", label: "Super Smoke Off", category: "hardware", description: "Disable super smoke mode" },
  { type: "keep_warm_on", label: "Keep Warm On", category: "hardware", description: "Enable keep warm mode" },
  { type: "keep_warm_off", label: "Keep Warm Off", category: "hardware", description: "Disable keep warm mode" },
  { type: "shutdown", label: "Shutdown Grill", category: "hardware", description: "Initiate grill shutdown sequence" },
  // Alert
  { type: "send_notification", label: "Send Notification", category: "alert", description: "One-time browser notification", params: [{ name: "message", label: "Message", type: "string", required: true }] },
  { type: "sound_alarm", label: "Sound Alarm", category: "alert", description: "Persistent alarm requiring manual dismissal", params: [{ name: "message", label: "Message", type: "string", required: true }] },
  { type: "escalating_alarm", label: "Escalating Alarm", category: "alert", description: "Re-alarm every N°F above trigger", params: [{ name: "message", label: "Message", type: "string", required: true }, { name: "intervalDegrees", label: "Interval", type: "number", min: 1, max: 50, unit: "°F", required: true }, { name: "maxTemp", label: "Max Temp", type: "number", min: 100, max: 500, unit: "°F" }] },
  // Flow
  { type: "wait_for_ack", label: "Wait for Acknowledge", category: "flow", description: "Pause automation until user confirms" },
  // Software
  { type: "log_event", label: "Log Event", category: "software", description: "Record an event to the cook session history", params: [{ name: "message", label: "Message", type: "string", required: true }] },
  { type: "end_session", label: "End Session", category: "software", description: "Mark the cook session as complete" },
];

export const COMPOUND_LOGIC_OPTIONS: Array<{ value: StepTrigger["logic"]; label: string; description: string }> = [
  { value: "or", label: "Either (OR)", description: "Whichever trigger fires first advances the step" },
  { value: "and", label: "Both (AND)", description: "Both triggers must be satisfied before advancing" },
  { value: "fallback", label: "Fallback", description: "Primary is preferred; secondary is a safety net if primary takes too long" },
  { value: "priority", label: "Priority", description: "Primary takes precedence; secondary runs in background" },
];

export const TRIGGER_CATALOG: Array<{ type: TriggerType; label: string; description: string; valueLabel?: string; valueUnit?: string; valueMin?: number; valueMax?: number }> = [
  { type: "probe_temp", label: "Probe Temp Reached", description: "Fires when probe reaches target", valueLabel: "Target Temp", valueUnit: "°F", valueMin: 50, valueMax: 300 },
  { type: "probe_temp_drop", label: "Probe Temp Dropped", description: "Fires when probe drops below target", valueLabel: "Target Temp", valueUnit: "°F", valueMin: 50, valueMax: 300 },
  { type: "grill_temp", label: "Grill Temp Reached", description: "Fires when grill reaches target", valueLabel: "Target Temp", valueUnit: "°F", valueMin: 100, valueMax: 500 },
  { type: "grill_temp_drop", label: "Grill Temp Dropped", description: "Fires when grill drops below target", valueLabel: "Target Temp", valueUnit: "°F", valueMin: 100, valueMax: 500 },
  { type: "timer", label: "Timer Elapsed", description: "Fires after a duration", valueLabel: "Duration", valueUnit: "seconds", valueMin: 60, valueMax: 86400 },
  { type: "pellet_low", label: "Pellet Level Low", description: "Fires when pellets drop below threshold", valueLabel: "Threshold", valueUnit: "%", valueMin: 5, valueMax: 50 },
  { type: "manual", label: "Manual", description: "User manually advances to next step" },
  { type: "immediate", label: "Immediate", description: "Fires as soon as the step begins" },
];

// ─── Variable Resolution ────────────────────────────────

/**
 * Resolve {{variable}} references in a value.
 * Returns the resolved number or string.
 */
export function resolveVariable(
  value: number | string,
  variables: Record<string, string | number>
): number | string {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;

  // Check for {{variable}} pattern
  const match = value.match(/^\{\{(\w+)\}\}$/);
  if (match) {
    const varName = match[1];
    if (varName in variables) return variables[varName];
  }

  // Replace inline {{variable}} references in strings
  return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    if (varName in variables) return String(variables[varName]);
    return `{{${varName}}}`;
  });
}

/**
 * Resolve all variables in a program's steps.
 * Returns a new steps array with all {{variable}} references replaced.
 */
export function resolveProgram(
  program: CookProgram,
  variableValues: Record<string, string | number>
): ProgramStep[] {
  // Merge defaults with user-provided values
  const resolved: Record<string, string | number> = {};
  for (const v of program.variables) {
    resolved[v.name] = variableValues[v.name] ?? v.default;
  }

  return program.steps.map(step => ({
    ...step,
    trigger: {
      ...step.trigger,
      value: step.trigger.value != null ? resolveVariable(step.trigger.value, resolved) : undefined,
      secondary: step.trigger.secondary ? {
        ...step.trigger.secondary,
        value: step.trigger.secondary.value != null ? resolveVariable(step.trigger.secondary.value, resolved) : undefined,
      } : undefined,
    },
    entryActions: step.entryActions?.map(a => ({
      ...a,
      params: a.params ? resolveParams(a.params, resolved) : undefined,
    })),
    actions: step.actions.map(a => ({
      ...a,
      params: a.params ? resolveParams(a.params, resolved) : undefined,
    })),
    alertOnTrigger: step.alertOnTrigger ? {
      ...step.alertOnTrigger,
      message: String(resolveVariable(step.alertOnTrigger.message, resolved)),
    } : undefined,
  }));
}

function resolveParams(
  params: Record<string, number | string | boolean>,
  variables: Record<string, string | number>
): Record<string, number | string | boolean> {
  const result: Record<string, number | string | boolean> = {};
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "boolean") {
      result[key] = val;
    } else {
      result[key] = resolveVariable(val, variables);
    }
  }
  return result;
}

// ─── Doneness → Temperature Mapping ─────────────────────

export const DONENESS_TEMPS: Record<string, Record<string, number>> = {
  beef: { rare: 125, medium_rare: 135, medium: 145, medium_well: 155, well_done: 165, pull: 200 },
  pork: { medium: 145, medium_well: 155, well_done: 160, pull: 205 },
  poultry: { well_done: 165 },
  lamb: { rare: 130, medium_rare: 140, medium: 150, medium_well: 155, well_done: 165 },
  seafood: { medium: 130, medium_well: 140, well_done: 145 },
};

// ─── Preset Program Library ─────────────────────────────

export const PRESET_PROGRAMS: CookProgram[] = [
  {
    name: "Competition Brisket",
    description: "Low and slow smoke with automatic stall management. Alerts you at wrap point, cranks through the stall, and auto-drops to hold temp when done.",
    category: "beef",
    method: "smoke",
    meatCut: "Whole Packer Brisket",
    difficulty: "advanced",
    estimatedTime: "12-16 hours",
    tags: ["brisket", "low-and-slow", "competition", "beef"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 180, min: 165, max: 225, unit: "°F", description: "Initial low & slow temperature" },
      { name: "crank_temp", label: "Crank Temperature", type: "number", default: 225, min: 200, max: 275, unit: "°F", description: "Temperature to push through the stall" },
      { name: "wrap_point", label: "Wrap Point (Probe)", type: "number", default: 160, min: 150, max: 175, unit: "°F", description: "Probe temp to trigger wrap alert" },
      { name: "pull_temp", label: "Pull Temperature", type: "number", default: 200, min: 195, max: 210, unit: "°F", description: "Final probe temp to pull the brisket" },
      { name: "meat_weight_lbs", label: "Meat Weight", type: "number", default: 12, min: 4, max: 25, unit: "lbs", description: "Weight of the brisket" },
      { name: "hold_temp", label: "Hold Temperature", type: "number", default: 165, min: 165, max: 200, unit: "°F", description: "Grill temp during hold phase (165°F = Keep Warm mode)" },
      { name: "hold_time", label: "Hold Time", type: "number", default: 14400, min: 1800, max: 64800, unit: "seconds", description: "Maximum hold duration (default 4 hours, max 18 hours)" },
    ],
    steps: [
      {
        name: "Low & Slow",
        description: "Smoke at low temp until the stall/wrap point",
        trigger: {
          type: "probe_temp", value: "{{wrap_point}}",
          secondary: { type: "timer", value: 28800 },  // 8-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "super_smoke_on" },
          { type: "log_event", params: { message: "Starting low & slow smoke at {{smoke_temp}}°F" } },
        ],
        alertOnTrigger: {
          type: "alarm",
          message: "Brisket hit {{wrap_point}}°F — time to wrap!",
          escalating: { intervalDegrees: 5 },
        },
        actions: [
          { type: "wait_for_ack" },
        ],
      },
      {
        name: "The Crank",
        description: "Increase temp to push through the stall after wrapping",
        trigger: {
          type: "probe_temp", value: "{{pull_temp}}",
          secondary: { type: "timer", value: 21600 },  // 6-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{crank_temp}}" } },
          { type: "super_smoke_off" },
          { type: "send_notification", params: { message: "Cranking to {{crank_temp}}°F — pushing through the stall" } },
        ],
        alertOnTrigger: {
          type: "alarm",
          message: "Brisket hit {{pull_temp}}°F — PULL IT!",
        },
        actions: [
          { type: "set_grill_temp", params: { temp: 165 } },
          { type: "keep_warm_on" },
          { type: "sound_alarm", params: { message: "PULL THE BRISKET! Probe at {{pull_temp}}°F — grill dropping to 165°F" } },
        ],
      },
      {
        name: "Active Hold",
        description: "Grill holds at {{hold_temp}}°F to keep brisket at safe temp while collagen continues to render. Monitors probe temp for food safety.",
        trigger: {
          type: "timer", value: "{{hold_time}}",
          secondary: { type: "probe_temp_drop", value: 145 },  // Safety: alert if probe drops near danger zone
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{hold_temp}}" } },
          { type: "keep_warm_on" },
          { type: "log_event", params: { message: "Entered active hold — grill at {{hold_temp}}°F. Monitoring probe temp for safety." } },
          { type: "send_notification", params: { message: "Brisket in active hold at {{hold_temp}}°F. Hold timer started. Meat is safe and resting." } },
        ],
        alertOnTrigger: {
          type: "alarm",
          message: "Hold phase complete or probe temp dropped below safe threshold! Check your brisket.",
        },
        actions: [
          { type: "sound_alarm", params: { message: "HOLD COMPLETE — Time to slice or probe temp dropped below safe zone!" } },
        ],
      },
      {
        name: "End Cook",
        description: "Shutdown grill and end the session",
        trigger: { type: "manual" },
        entryActions: [
          { type: "send_notification", params: { message: "Ready to slice! End the cook when done." } },
        ],
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Fat side down for Traegers — heat comes from below",
      "The stall typically happens between 150-170°F and can last 2-4 hours",
      "Wrap in butcher paper (not foil) to preserve bark while pushing through stall",
      "For the hold: keep brisket wrapped — unwrapping causes moisture loss",
      "Longer holds (4-12 hours) at 165°F produce more tender results as collagen continues to render",
      "If brisket was pulled at 195°F (undercook method), hold for 8-18 hours for competition quality",
      "If brisket was pulled at 203°F+ (fully tender), limit hold to 2-4 hours to prevent mushiness",
      "Spritz with apple cider vinegar every hour during the low & slow phase",
    ],
  },
  {
    name: "Reverse Sear Steak",
    description: "Low smoke to bring the steak up slowly, then blast at max heat for the perfect sear.",
    category: "beef",
    method: "reverse_sear",
    meatCut: "Ribeye / NY Strip",
    difficulty: "intermediate",
    estimatedTime: "1-2 hours",
    tags: ["steak", "reverse-sear", "beef", "quick"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 225, min: 180, max: 250, unit: "°F" },
      { name: "pull_temp", label: "Pull Temp (before sear)", type: "number", default: 115, min: 100, max: 135, unit: "°F", description: "Pull 10-15°F below final target" },
      { name: "sear_temp", label: "Sear Temperature", type: "number", default: 500, min: 450, max: 500, unit: "°F" },
      { name: "sear_time", label: "Sear Time (per side)", type: "number", default: 90, min: 60, max: 180, unit: "seconds" },
    ],
    steps: [
      {
        name: "Low Smoke",
        description: "Bring the steak up slowly with smoke",
        trigger: {
          type: "probe_temp", value: "{{pull_temp}}",
          secondary: { type: "timer", value: 3600 },  // 1-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "super_smoke_on" },
        ],
        alertOnTrigger: { type: "alarm", message: "Steak at {{pull_temp}}°F — pull for rest, then sear!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "Rest & Preheat",
        description: "Rest the steak while the grill cranks to sear temp",
        trigger: { type: "grill_temp", value: "{{sear_temp}}" },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{sear_temp}}" } },
          { type: "super_smoke_off" },
          { type: "send_notification", params: { message: "Grill cranking to {{sear_temp}}°F for sear. Rest the steak." } },
        ],
        alertOnTrigger: { type: "alarm", message: "Grill at {{sear_temp}}°F — SEAR NOW!" },
        actions: [{ type: "set_timer", params: { seconds: "{{sear_time}}" } }],
      },
      {
        name: "Sear",
        description: "High heat sear — flip halfway",
        trigger: { type: "timer", value: "{{sear_time}}" },
        entryActions: [
          { type: "send_notification", params: { message: "Searing! Flip halfway through." } },
        ],
        alertOnTrigger: { type: "alarm", message: "Sear complete! Pull the steak." },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Pull the steak 10-15°F below your target doneness — carryover cooking will finish it",
      "Rest for 5-10 minutes before searing to let the surface dry",
      "For the sear, use cast iron grates if available",
      "Flip once during the sear for even crust",
    ],
  },
  {
    name: "Pulled Pork",
    description: "Classic low and slow pulled pork with automatic wrap point, pull temp monitoring, and configurable active hold.",
    category: "pork",
    method: "smoke",
    meatCut: "Pork Butt / Shoulder",
    difficulty: "beginner",
    estimatedTime: "10-14 hours",
    tags: ["pulled-pork", "low-and-slow", "pork", "beginner"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 225, min: 200, max: 250, unit: "°F" },
      { name: "wrap_point", label: "Wrap Point", type: "number", default: 165, min: 155, max: 175, unit: "°F" },
      { name: "pull_temp", label: "Pull Temperature", type: "number", default: 205, min: 195, max: 210, unit: "°F" },
      { name: "hold_temp", label: "Hold Temperature", type: "number", default: 165, min: 165, max: 200, unit: "°F", description: "Grill temp during hold phase" },
      { name: "hold_time", label: "Hold Time", type: "number", default: 14400, min: 3600, max: 43200, unit: "seconds", description: "Hold duration (default 4 hours, max 12 hours)" },
    ],
    steps: [
      {
        name: "Smoke",
        description: "Low and slow smoke until wrap point",
        trigger: {
          type: "probe_temp", value: "{{wrap_point}}",
          secondary: { type: "timer", value: 25200 },  // 7-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "super_smoke_on" },
        ],
        alertOnTrigger: { type: "alarm", message: "Pork at {{wrap_point}}°F — wrap it!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "Wrapped Push",
        description: "Push through the stall wrapped",
        trigger: {
          type: "probe_temp", value: "{{pull_temp}}",
          secondary: { type: "timer", value: 18000 },  // 5-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "super_smoke_off" },
          { type: "send_notification", params: { message: "Wrapped and pushing to {{pull_temp}}°F" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Pork at {{pull_temp}}°F — pull it!" },
        actions: [
          { type: "set_grill_temp", params: { temp: 165 } },
          { type: "keep_warm_on" },
          { type: "sound_alarm", params: { message: "PULL THE PORK! Probe at {{pull_temp}}°F" } },
        ],
      },
      {
        name: "Active Hold",
        description: "Hold at {{hold_temp}}°F until ready to shred. Monitors probe temp for food safety.",
        trigger: {
          type: "timer", value: "{{hold_time}}",
          secondary: { type: "probe_temp_drop", value: 145 },
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{hold_temp}}" } },
          { type: "keep_warm_on" },
          { type: "log_event", params: { message: "Pork in active hold at {{hold_temp}}°F — shred when ready" } },
          { type: "send_notification", params: { message: "Pork butt in active hold. Timer running. Shred when ready!" } },
        ],
        alertOnTrigger: {
          type: "alarm",
          message: "Hold timer complete or probe temp dropped below safe threshold!",
        },
        actions: [
          { type: "sound_alarm", params: { message: "HOLD COMPLETE — Shred the pork or check probe temp!" } },
        ],
      },
      {
        name: "End Cook",
        description: "Shutdown grill and end the session",
        trigger: { type: "manual" },
        entryActions: [
          { type: "send_notification", params: { message: "Ready to shred! End the cook when done." } },
        ],
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Apply rub the night before for best flavor penetration",
      "Spritz every hour with apple cider vinegar and apple juice (50/50)",
      "The stall is normal — don't panic, just wrap and push through",
      "Rest for at least 1 hour before pulling — the collagen continues to break down",
      "Pork butt is very forgiving — can hold safely for 12+ hours at 165°F",
      "Keep wrapped tightly during the hold for maximum moisture retention",
    ],
  },
  {
    name: "Baby Back Ribs (3-2-1)",
    description: "The classic 3-2-1 method: 3 hours smoke, 2 hours wrapped, 1 hour sauced.",
    category: "pork",
    method: "smoke",
    meatCut: "Baby Back Ribs",
    difficulty: "intermediate",
    estimatedTime: "6 hours",
    tags: ["ribs", "3-2-1", "pork", "classic"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 225, min: 200, max: 250, unit: "°F" },
      { name: "smoke_time", label: "Smoke Time", type: "number", default: 10800, min: 7200, max: 14400, unit: "seconds", description: "3 hours default" },
      { name: "wrap_time", label: "Wrap Time", type: "number", default: 7200, min: 3600, max: 10800, unit: "seconds", description: "2 hours default" },
      { name: "sauce_time", label: "Sauce Time", type: "number", default: 3600, min: 1800, max: 5400, unit: "seconds", description: "1 hour default" },
    ],
    steps: [
      {
        name: "Smoke (3 hrs)",
        description: "Unwrapped smoke for bark development",
        trigger: { type: "timer", value: "{{smoke_time}}" },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "super_smoke_on" },
        ],
        alertOnTrigger: { type: "alarm", message: "3 hours done — time to wrap the ribs!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "Wrap (2 hrs)",
        description: "Wrapped in foil with butter, brown sugar, honey",
        trigger: { type: "timer", value: "{{wrap_time}}" },
        entryActions: [
          { type: "super_smoke_off" },
          { type: "send_notification", params: { message: "Ribs wrapped — 2 hours to go" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Unwrap time — sauce those ribs!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "Sauce (1 hr)",
        description: "Unwrapped with sauce for caramelization",
        trigger: { type: "timer", value: "{{sauce_time}}" },
        entryActions: [
          { type: "send_notification", params: { message: "Ribs sauced and unwrapped — 1 hour to caramelize" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Ribs are done! Pull them!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Remove the membrane from the bone side before seasoning",
      "For the wrap: butter, brown sugar, honey, and a splash of apple juice",
      "Sauce in the last hour only — too early and it burns",
      "Test doneness: bones should twist easily and meat should pull back from the bone",
    ],
  },
  {
    name: "Burger Mode",
    description: "Quick preheat to high heat, timed cook with flip reminder. Simple and fast.",
    category: "beef",
    method: "grill",
    meatCut: "Ground Beef Patties",
    difficulty: "beginner",
    estimatedTime: "20-30 minutes",
    tags: ["burger", "quick", "grill", "beginner"],
    variables: [
      { name: "grill_temp", label: "Grill Temperature", type: "number", default: 450, min: 375, max: 500, unit: "°F" },
      { name: "cook_time_side1", label: "First Side Time", type: "number", default: 240, min: 180, max: 360, unit: "seconds", description: "4 minutes default" },
      { name: "cook_time_side2", label: "Second Side Time", type: "number", default: 240, min: 180, max: 360, unit: "seconds", description: "4 minutes default" },
    ],
    steps: [
      {
        name: "Preheat",
        description: "Get the grill ripping hot",
        trigger: { type: "grill_temp", value: "{{grill_temp}}" },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{grill_temp}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Grill at {{grill_temp}}°F — throw the burgers on!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "First Side",
        description: "Cook first side — don't press the patties!",
        trigger: { type: "timer", value: "{{cook_time_side1}}" },
        entryActions: [
          { type: "set_timer", params: { seconds: "{{cook_time_side1}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "FLIP THE BURGERS!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "Second Side",
        description: "Cook second side — add cheese in the last minute",
        trigger: { type: "timer", value: "{{cook_time_side2}}" },
        entryActions: [
          { type: "set_timer", params: { seconds: "{{cook_time_side2}}" } },
          { type: "send_notification", params: { message: "Flipped! Add cheese in the last minute." } },
        ],
        alertOnTrigger: { type: "alarm", message: "Burgers done! Pull them off!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Don't press the patties — you'll squeeze out the juices",
      "Make a thumbprint in the center to prevent puffing",
      "Add cheese in the last 60 seconds and close the lid",
      "Let burgers rest 2-3 minutes before serving",
    ],
  },
  {
    name: "Pizza Mode",
    description: "Max heat preheat for crispy crust, then timed cook. Works great with a pizza stone.",
    category: "other",
    method: "bake",
    meatCut: "Pizza",
    difficulty: "beginner",
    estimatedTime: "30-45 minutes",
    tags: ["pizza", "bake", "quick", "beginner"],
    variables: [
      { name: "preheat_temp", label: "Preheat Temperature", type: "number", default: 500, min: 450, max: 500, unit: "°F" },
      { name: "cook_time", label: "Cook Time", type: "number", default: 480, min: 300, max: 720, unit: "seconds", description: "8 minutes default" },
    ],
    steps: [
      {
        name: "Preheat",
        description: "Get the grill and pizza stone ripping hot (20+ min recommended)",
        trigger: { type: "grill_temp", value: "{{preheat_temp}}" },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{preheat_temp}}" } },
        ],
        alertOnTrigger: { type: "notification", message: "Grill at {{preheat_temp}}°F — let the stone heat for 10 more minutes" },
        actions: [{ type: "set_timer", params: { seconds: 600 } }],
      },
      {
        name: "Stone Soak",
        description: "Let the pizza stone absorb heat for a crispier crust",
        trigger: { type: "timer", value: 600 },
        entryActions: [],
        alertOnTrigger: { type: "alarm", message: "Stone is hot! Slide the pizza on!" },
        actions: [{ type: "wait_for_ack" }],
      },
      {
        name: "Cook",
        description: "Cook the pizza — rotate halfway for even browning",
        trigger: { type: "timer", value: "{{cook_time}}" },
        entryActions: [
          { type: "set_timer", params: { seconds: "{{cook_time}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Pizza is done! Pull it!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Use a pizza stone or steel for the best crust",
      "Preheat the stone for at least 20 minutes at max temp",
      "Use cornmeal or semolina on the peel to prevent sticking",
      "Rotate the pizza 180° halfway through for even cooking",
      "Less is more with toppings — overloading makes soggy pizza",
    ],
  },
  {
    name: "Spatchcock Chicken",
    description: "High heat roast for crispy skin and juicy meat. Spatchcocking ensures even cooking.",
    category: "poultry",
    method: "roast",
    meatCut: "Whole Chicken (Spatchcocked)",
    difficulty: "beginner",
    estimatedTime: "1-1.5 hours",
    tags: ["chicken", "spatchcock", "roast", "quick"],
    variables: [
      { name: "grill_temp", label: "Grill Temperature", type: "number", default: 375, min: 350, max: 425, unit: "°F" },
      { name: "pull_temp", label: "Pull Temperature", type: "number", default: 165, min: 160, max: 170, unit: "°F" },
    ],
    steps: [
      {
        name: "Roast",
        description: "High heat roast until probe hits target in the thickest part of the thigh",
        trigger: {
          type: "probe_temp", value: "{{pull_temp}}",
          secondary: { type: "timer", value: 5400 },  // 90-min fallback safety
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{grill_temp}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Chicken at {{pull_temp}}°F — pull it!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Spatchcock by removing the backbone with kitchen shears",
      "Place probe in the thickest part of the thigh, not touching bone",
      "Dry brine overnight for the crispiest skin",
      "Rest for 10 minutes before carving",
    ],
  },
  {
    name: "Smoked Salmon",
    description: "Low and slow smoke with a glaze finish. Perfect for lox-style or hot smoked salmon.",
    category: "seafood",
    method: "smoke",
    meatCut: "Salmon Fillet",
    difficulty: "intermediate",
    estimatedTime: "2-3 hours",
    tags: ["salmon", "seafood", "smoke", "fish"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 180, min: 165, max: 225, unit: "°F" },
      { name: "pull_temp", label: "Pull Temperature", type: "number", default: 145, min: 130, max: 155, unit: "°F" },
    ],
    steps: [
      {
        name: "Low Smoke",
        description: "Gentle smoke to build flavor without overcooking",
        trigger: {
          type: "probe_temp", value: "{{pull_temp}}",
          secondary: { type: "timer", value: 10800 },  // 3-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "super_smoke_on" },
        ],
        alertOnTrigger: { type: "alarm", message: "Salmon at {{pull_temp}}°F — pull it!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Dry brine with salt and brown sugar for 4-12 hours before smoking",
      "Let the salmon form a pellicle (tacky surface) before putting on the grill",
      "Use alder or cherry wood pellets for the best flavor with fish",
      "Don't overcook — salmon continues to cook after pulling",
    ],
  },
  {
    name: "Smoked Turkey",
    description: "Whole turkey smoked low then cranked for crispy skin. Perfect for holidays or meal prep.",
    category: "poultry",
    method: "smoke",
    meatCut: "Whole Turkey",
    difficulty: "intermediate",
    estimatedTime: "5-7 hours",
    tags: ["turkey", "poultry", "smoke", "holiday", "whole bird"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 225, min: 200, max: 250, unit: "°F" },
      { name: "crisp_temp", label: "Skin Crisp Temperature", type: "number", default: 350, min: 325, max: 400, unit: "°F" },
      { name: "skin_crisp_point", label: "Crisp Trigger (Probe)", type: "number", default: 145, min: 135, max: 155, unit: "°F", description: "Probe temp to switch from smoke to high heat for skin" },
      { name: "pull_temp", label: "Pull Temperature", type: "number", default: 165, min: 160, max: 170, unit: "°F" },
    ],
    steps: [
      {
        name: "Low Smoke",
        description: "Build deep smoke flavor at low temp",
        trigger: {
          type: "probe_temp", value: "{{skin_crisp_point}}",
          secondary: { type: "timer", value: 14400 },  // 4-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "super_smoke_on" },
        ],
        alertOnTrigger: { type: "notification", message: "Turkey at {{skin_crisp_point}}°F — cranking heat for crispy skin" },
        actions: [
          { type: "super_smoke_off" },
        ],
      },
      {
        name: "Crisp Skin",
        description: "High heat to crisp the skin and finish cooking",
        trigger: {
          type: "probe_temp", value: "{{pull_temp}}",
          secondary: { type: "timer", value: 7200 },  // 2-hour fallback
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{crisp_temp}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Turkey at {{pull_temp}}°F — pull it and rest for 30 minutes!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Dry brine for 24-48 hours for the juiciest results",
      "Place probe in the thickest part of the breast, not touching bone",
      "Spatchcocking the turkey cuts cook time nearly in half",
      "Tent loosely with foil and rest 30 minutes before carving",
      "Use hickory or pecan pellets for a classic smoked turkey flavor",
    ],
  },
  {
    name: "Pork Belly Burnt Ends",
    description: "Sweet, sticky, melt-in-your-mouth pork belly cubes. Three-phase cook: smoke, braise, glaze.",
    category: "pork",
    method: "smoke",
    meatCut: "Pork Belly",
    difficulty: "intermediate",
    estimatedTime: "4-5 hours",
    tags: ["pork belly", "burnt ends", "smoke", "bbq candy", "appetizer"],
    variables: [
      { name: "smoke_temp", label: "Smoke Temperature", type: "number", default: 250, min: 225, max: 275, unit: "°F" },
      { name: "smoke_time", label: "Smoke Time", type: "number", default: 10800, min: 7200, max: 14400, unit: "seconds", description: "Initial smoke phase (default 3 hours)" },
      { name: "braise_temp", label: "Braise Temperature", type: "number", default: 275, min: 250, max: 300, unit: "°F" },
      { name: "braise_time", label: "Braise Time", type: "number", default: 5400, min: 3600, max: 7200, unit: "seconds", description: "Covered braise phase (default 90 min)" },
      { name: "glaze_time", label: "Glaze Time", type: "number", default: 900, min: 600, max: 1800, unit: "seconds", description: "Final uncovered glaze (default 15 min)" },
    ],
    steps: [
      {
        name: "Smoke",
        description: "Smoke the pork belly cubes uncovered to build bark",
        trigger: { type: "timer", value: "{{smoke_time}}" },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{smoke_temp}}" } },
          { type: "set_timer", params: { seconds: "{{smoke_time}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Smoke phase done! Time to braise — put cubes in a pan with butter, honey, and BBQ sauce. Cover with foil." },
        actions: [],
      },
      {
        name: "Braise",
        description: "Cover and braise in butter/honey/sauce until tender",
        trigger: { type: "timer", value: "{{braise_time}}" },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{braise_temp}}" } },
          { type: "set_timer", params: { seconds: "{{braise_time}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Braise done! Remove foil, toss in more sauce, and put back uncovered for the glaze." },
        actions: [],
      },
      {
        name: "Glaze",
        description: "Uncovered final cook to caramelize the glaze",
        trigger: { type: "timer", value: "{{glaze_time}}" },
        entryActions: [
          { type: "set_timer", params: { seconds: "{{glaze_time}}" } },
        ],
        alertOnTrigger: { type: "alarm", message: "Burnt ends are done! Pull them off!" },
        actions: [
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "Cut pork belly into 1.5-inch cubes for the best texture",
      "Season generously — the cubes have a lot of surface area",
      "For the braise: 2 tbsp butter, 2 tbsp honey, 1/4 cup BBQ sauce per pound",
      "The glaze phase is where the magic happens — don't skip it",
      "These are best served immediately while the glaze is still tacky",
    ],
  },
  // ─── STANDALONE HOLD PROGRAM ──────────────────────────
  {
    name: "Active Hold (Any Meat)",
    description: "Standalone hold program for keeping cooked meat at a safe temperature. Use after any cook to hold meat on the grill until ready to serve. Configurable temperature and time with food safety monitoring.",
    category: "other",
    method: "smoke",
    meatCut: "Any",
    difficulty: "beginner",
    estimatedTime: "1-18 hours",
    tags: ["hold", "rest", "keep-warm", "food-safety", "any-meat"],
    variables: [
      { name: "hold_temp", label: "Hold Temperature", type: "number", default: 165, min: 165, max: 200, unit: "\u00b0F", description: "Grill temperature during hold (165\u00b0F = Keep Warm mode). Higher temps render collagen faster." },
      { name: "hold_time", label: "Hold Time", type: "number", default: 14400, min: 1800, max: 64800, unit: "seconds", description: "Maximum hold duration. Timer will alarm when complete. (30 min to 18 hours)" },
      { name: "safety_temp", label: "Safety Alert Temperature", type: "number", default: 145, min: 140, max: 160, unit: "\u00b0F", description: "Alarm fires if probe drops below this temp (USDA minimum: 140\u00b0F)" },
      { name: "meat_type", label: "Meat Type", type: "enum", default: "beef", options: ["beef", "pork", "poultry", "lamb", "other"], description: "Type of meat being held (affects safety thresholds)" },
    ],
    steps: [
      {
        name: "Confirm Ready",
        description: "Confirm meat is cooked and ready for hold. Place wrapped meat on grill.",
        trigger: { type: "immediate" },
        entryActions: [
          { type: "send_notification", params: { message: "Place your wrapped, cooked meat on the grill. Hold phase will begin immediately." } },
        ],
        actions: [],
      },
      {
        name: "Active Hold",
        description: "Holding at {{hold_temp}}\u00b0F. Probe temp monitored for food safety. Alarm sounds if probe drops below {{safety_temp}}\u00b0F or when hold timer completes.",
        trigger: {
          type: "timer", value: "{{hold_time}}",
          secondary: { type: "probe_temp_drop", value: "{{safety_temp}}" },
          logic: "or",
        },
        entryActions: [
          { type: "set_grill_temp", params: { temp: "{{hold_temp}}" } },
          { type: "keep_warm_on" },
          { type: "log_event", params: { message: "Active hold started at {{hold_temp}}\u00b0F. Safety threshold: {{safety_temp}}\u00b0F. Max time: {{hold_time}}s" } },
          { type: "send_notification", params: { message: "\ud83c\udf21\ufe0f Active Hold started at {{hold_temp}}\u00b0F. Monitoring probe temp for safety. You'll be alerted when done or if temp drops." } },
        ],
        alertOnTrigger: {
          type: "alarm",
          message: "Hold phase ended! Either timer completed or probe temp dropped below {{safety_temp}}\u00b0F. Check your meat!",
        },
        actions: [
          { type: "sound_alarm", params: { message: "HOLD ALERT \u2014 Timer complete or probe temp below safety threshold! Check your meat immediately." } },
        ],
      },
      {
        name: "End Hold",
        description: "Shutdown grill and end the hold session",
        trigger: { type: "manual" },
        entryActions: [
          { type: "send_notification", params: { message: "Hold complete. End the session when ready to serve." } },
        ],
        actions: [
          { type: "keep_warm_off" },
          { type: "shutdown" },
          { type: "end_session" },
        ],
      },
    ],
    tips: [
      "FOOD SAFETY: Meat must stay above 140\u00b0F (USDA minimum). The default alert at 145\u00b0F gives you a 5\u00b0F safety margin.",
      "Keep meat wrapped (butcher paper or foil) during the entire hold to prevent moisture loss",
      "Traeger minimum grill temp is 165\u00b0F \u2014 this is the lowest you can set for a hold",
      "For brisket pulled early (195\u00b0F): hold 8-18 hours at 165\u00b0F for competition-quality tenderness",
      "For brisket pulled at full tender (203\u00b0F+): limit hold to 2-4 hours to prevent mushiness",
      "Pork butt is very forgiving \u2014 can hold 12+ hours safely",
      "Poultry must stay above 165\u00b0F internal \u2014 set safety alert to 160\u00b0F for poultry",
      "Higher hold temps (180-200\u00b0F) render collagen faster \u2014 use for underdone cuts",
      "Lower hold temps (165\u00b0F) are gentler \u2014 use for fully cooked cuts to prevent overcooking",
      "If probe drops below safety temp, the grill is still at 165\u00b0F+ \u2014 the probe may have shifted. Reinsert and check.",
    ],
  },
];
