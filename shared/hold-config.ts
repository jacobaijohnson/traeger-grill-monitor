/**
 * Hold Configuration — Safety-bounded temperature and time settings
 * for holding cooked meat at safe temperatures after cooking.
 *
 * Based on:
 * - USDA food safety guidelines (minimum 140°F holding temp)
 * - Traeger hardware constraints (minimum 165°F grill temp)
 * - BBQ science (collagen rendering continues at hold temps)
 *
 * The "hold" phase keeps meat at a safe temperature after cooking
 * is complete, allowing collagen to continue rendering gently
 * without overcooking the muscle fibers.
 */

// ─── Safety Constants ──────────────────────────────────

/** USDA minimum safe holding temperature (°F) — below this is the danger zone */
export const USDA_MIN_SAFE_TEMP = 140;

/** Practical minimum with safety margin (°F) */
export const PRACTICAL_MIN_SAFE_TEMP = 145;

/** Traeger hardware minimum temperature (°F) — lowest the grill can be set */
export const TRAEGER_MIN_TEMP = 165;

/** Maximum reasonable hold temperature (°F) — above this continues active cooking */
export const MAX_HOLD_TEMP = 200;

/** Default hold temperature (°F) — Traeger Keep Warm mode */
export const DEFAULT_HOLD_TEMP = 165;

/** Minimum hold time (seconds) — 30 minutes */
export const MIN_HOLD_TIME = 1800;

/** Maximum hold time (seconds) — 18 hours (food safety limit for most scenarios) */
export const MAX_HOLD_TIME = 64800;

/** Default hold time (seconds) — 4 hours */
export const DEFAULT_HOLD_TIME = 14400;

/** Temperature below which a safety alarm fires (°F) */
export const DANGER_ZONE_ALERT_TEMP = 145;

// ─── Hold Presets by Meat Type ─────────────────────────

export interface HoldPreset {
  id: string;
  name: string;
  category: "beef" | "pork" | "poultry" | "lamb" | "seafood" | "other";
  meatCut: string;
  description: string;

  /** Target grill temperature during hold (°F) — clamped to [TRAEGER_MIN_TEMP, MAX_HOLD_TEMP] */
  holdTemp: number;

  /** Minimum safe internal meat temp (°F) — alarm fires below this */
  minSafeProbeTemp: number;

  /** Recommended hold duration (seconds) */
  recommendedTime: number;

  /** Minimum hold time (seconds) */
  minTime: number;

  /** Maximum safe hold time (seconds) */
  maxTime: number;

  /** Whether to use Keep Warm mode (true) or manual temp set (false) */
  useKeepWarm: boolean;

  /** Tips for this specific hold scenario */
  tips: string[];
}

export const HOLD_PRESETS: HoldPreset[] = [
  {
    id: "brisket_long_hold",
    name: "Brisket — Long Hold (Undercook Method)",
    category: "beef",
    meatCut: "Whole Packer Brisket",
    description: "Pull brisket early (~195°F) and hold on grill at 165°F for extended rest. Collagen continues to render gently, producing competition-quality results.",
    holdTemp: 165,
    minSafeProbeTemp: 140,
    recommendedTime: 43200, // 12 hours
    minTime: 7200,          // 2 hours
    maxTime: 64800,         // 18 hours
    useKeepWarm: true,
    tips: [
      "Pull brisket at 195°F for a long hold — collagen will finish rendering at hold temp",
      "Keep brisket wrapped in butcher paper during the entire hold",
      "Probe temp will slowly drop to match grill temp (165°F) — this is normal and safe",
      "The longer the hold (up to 18 hours), the more tender the result",
      "If brisket was cooked to full probe-tender (203°F+), limit hold to 4 hours max to prevent mushiness",
    ],
  },
  {
    id: "brisket_short_hold",
    name: "Brisket — Short Hold (Fully Cooked)",
    category: "beef",
    meatCut: "Whole Packer Brisket",
    description: "For brisket cooked to full probe-tender (203°F+). Short hold at minimum temp to keep warm without overcooking.",
    holdTemp: 165,
    minSafeProbeTemp: 140,
    recommendedTime: 7200,  // 2 hours
    minTime: 1800,          // 30 minutes
    maxTime: 14400,         // 4 hours (limit for fully cooked)
    useKeepWarm: true,
    tips: [
      "Fully cooked brisket should NOT be held for more than 4 hours — collagen is already rendered",
      "Consider resting on counter for 30-60 minutes first to stop carryover cooking",
      "Then place back on grill in Keep Warm mode until ready to slice",
      "If holding longer than 2 hours, monitor for mushiness",
    ],
  },
  {
    id: "pork_butt_hold",
    name: "Pulled Pork — Hold",
    category: "pork",
    meatCut: "Pork Butt / Shoulder",
    description: "Hold pulled pork at safe temp until ready to shred and serve. Pork butt is very forgiving for long holds.",
    holdTemp: 165,
    minSafeProbeTemp: 140,
    recommendedTime: 14400, // 4 hours
    minTime: 3600,          // 1 hour
    maxTime: 43200,         // 12 hours
    useKeepWarm: true,
    tips: [
      "Pork butt is very forgiving — can hold for 12+ hours safely",
      "Keep wrapped tightly in foil or butcher paper",
      "The longer the hold, the easier it pulls apart",
      "Shred just before serving for best texture",
    ],
  },
  {
    id: "beef_ribs_hold",
    name: "Beef Ribs — Hold",
    category: "beef",
    meatCut: "Beef Short Ribs",
    description: "Hold beef ribs at safe temp. Similar to brisket but shorter hold recommended due to smaller mass.",
    holdTemp: 165,
    minSafeProbeTemp: 140,
    recommendedTime: 7200,  // 2 hours
    minTime: 1800,          // 30 minutes
    maxTime: 14400,         // 4 hours
    useKeepWarm: true,
    tips: [
      "Beef ribs cool faster than brisket due to less mass",
      "Keep wrapped and hold for 1-4 hours",
      "Monitor probe temp — ribs can drop below safe zone faster",
    ],
  },
  {
    id: "pork_ribs_hold",
    name: "Pork Ribs — Hold",
    category: "pork",
    meatCut: "Baby Back / Spare Ribs",
    description: "Short hold for pork ribs. Ribs cool quickly so monitor closely.",
    holdTemp: 165,
    minSafeProbeTemp: 140,
    recommendedTime: 3600,  // 1 hour
    minTime: 1800,          // 30 minutes
    maxTime: 7200,          // 2 hours
    useKeepWarm: true,
    tips: [
      "Ribs are thin — they cool faster than large cuts",
      "Hold for 30-60 minutes max for best texture",
      "Keep wrapped in foil with a splash of apple juice",
    ],
  },
  {
    id: "poultry_hold",
    name: "Poultry — Hold",
    category: "poultry",
    meatCut: "Whole Chicken / Turkey",
    description: "Short hold for poultry. Keep above 165°F internal for food safety.",
    holdTemp: 170,
    minSafeProbeTemp: 160,
    recommendedTime: 1800,  // 30 minutes
    minTime: 900,           // 15 minutes
    maxTime: 7200,          // 2 hours
    useKeepWarm: true,
    tips: [
      "Poultry must stay above 165°F internal — higher safety threshold than red meat",
      "Hold for 15-30 minutes for juices to redistribute",
      "Do not hold poultry longer than 2 hours — skin gets rubbery",
      "Tent loosely with foil to prevent skin from getting soggy",
    ],
  },
  {
    id: "lamb_hold",
    name: "Lamb — Hold",
    category: "lamb",
    meatCut: "Leg of Lamb / Rack",
    description: "Short hold for lamb. Lamb fat solidifies quickly so keep warm.",
    holdTemp: 165,
    minSafeProbeTemp: 140,
    recommendedTime: 3600,  // 1 hour
    minTime: 900,           // 15 minutes
    maxTime: 7200,          // 2 hours
    useKeepWarm: true,
    tips: [
      "Lamb fat solidifies at higher temps than beef — keep it warm",
      "Hold for 15-60 minutes for best results",
      "Longer holds may affect texture negatively for lamb",
    ],
  },
];

// ─── Hold Configuration Validation ────────────────────

export interface HoldSettings {
  /** Grill temperature during hold (°F) — must be >= TRAEGER_MIN_TEMP and <= MAX_HOLD_TEMP */
  holdTemp: number;

  /** Maximum hold duration (seconds) — must be >= MIN_HOLD_TIME and <= MAX_HOLD_TIME */
  holdTime: number;

  /** Probe temperature below which a safety alarm fires (°F) */
  alertBelowTemp: number;

  /** Whether to use Traeger's Keep Warm mode */
  useKeepWarm: boolean;
}

/**
 * Validate and clamp hold settings to safe ranges.
 * Returns sanitized settings that are guaranteed to be within safety bounds.
 */
export function validateHoldSettings(input: Partial<HoldSettings>): HoldSettings {
  return {
    holdTemp: Math.max(TRAEGER_MIN_TEMP, Math.min(MAX_HOLD_TEMP, input.holdTemp ?? DEFAULT_HOLD_TEMP)),
    holdTime: Math.max(MIN_HOLD_TIME, Math.min(MAX_HOLD_TIME, input.holdTime ?? DEFAULT_HOLD_TIME)),
    alertBelowTemp: Math.max(USDA_MIN_SAFE_TEMP, Math.min(TRAEGER_MIN_TEMP, input.alertBelowTemp ?? DANGER_ZONE_ALERT_TEMP)),
    useKeepWarm: input.useKeepWarm ?? true,
  };
}

/**
 * Get the recommended hold preset for a given meat category and cut.
 */
export function getHoldPreset(category?: string, meatCut?: string): HoldPreset | undefined {
  if (!category && !meatCut) return undefined;

  const search = (meatCut || category || "").toLowerCase();

  // Try exact match by meat cut
  for (const preset of HOLD_PRESETS) {
    if (preset.meatCut.toLowerCase().includes(search) || search.includes(preset.meatCut.toLowerCase())) {
      return preset;
    }
  }

  // Try category match
  for (const preset of HOLD_PRESETS) {
    if (preset.category === category) {
      return preset;
    }
  }

  return undefined;
}

/**
 * Get all hold presets grouped by category.
 */
export function getHoldPresetsByCategory(): Record<string, HoldPreset[]> {
  const grouped: Record<string, HoldPreset[]> = {};
  for (const preset of HOLD_PRESETS) {
    if (!grouped[preset.category]) grouped[preset.category] = [];
    grouped[preset.category].push(preset);
  }
  return grouped;
}

/**
 * Format hold time for display.
 */
export function formatHoldTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
