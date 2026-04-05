/**
 * Meat Science Temperature Markers
 * 
 * Scientific temperature thresholds for different meats and cuts.
 * Used to overlay horizontal reference lines on the temperature graph
 * and configure automatic alerts during a cook.
 */

export interface TempMarker {
  temp: number;           // Temperature in °F
  label: string;          // Short label for graph overlay
  description: string;    // Longer description for tooltips/alerts
  color: string;          // CSS color for the line
  style: "line" | "band"; // Single line or a temperature band
  bandEnd?: number;       // End temp for bands
  alertType: "notification" | "alarm" | "none"; // Default alert behavior
  alertMessage?: string;  // Message when this threshold is crossed
}

export interface MeatProfile {
  id: string;
  name: string;
  category: string;       // beef, pork, poultry, seafood, lamb
  markers: TempMarker[];
}

// ─── BEEF ───────────────────────────────────────────────

export const BRISKET: MeatProfile = {
  id: "brisket",
  name: "Brisket",
  category: "beef",
  markers: [
    {
      temp: 130,
      label: "Fat Render",
      description: "Intramuscular fat begins to soften and render",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Fat rendering has begun — looking good!",
    },
    {
      temp: 150,
      label: "Stall Zone",
      description: "Evaporative cooling plateau — temp may stall here for hours",
      color: "#ef4444",
      style: "band",
      bandEnd: 170,
      alertType: "notification",
      alertMessage: "Entering the stall zone. Consider wrapping in butcher paper if desired.",
    },
    {
      temp: 160,
      label: "Collagen Breakdown",
      description: "Connective tissue starts converting to gelatin",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "Collagen breakdown in progress — connective tissue converting to gelatin.",
    },
    {
      temp: 190,
      label: "Gelatin Complete",
      description: "Gelatin conversion mostly complete — start checking tenderness",
      color: "#22c55e",
      style: "line",
      alertType: "notification",
      alertMessage: "Getting close! Start probe-testing for tenderness.",
    },
    {
      temp: 203,
      label: "TARGET — Pull",
      description: "Ideal pull temperature for brisket — probe should slide in like butter",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Pull your brisket! Probe should slide in like butter.",
    },
  ],
};

export const BEEF_RIBS: MeatProfile = {
  id: "beef_ribs",
  name: "Beef Ribs",
  category: "beef",
  markers: [
    {
      temp: 160,
      label: "Collagen Start",
      description: "Connective tissue begins breaking down",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "Collagen breakdown starting.",
    },
    {
      temp: 195,
      label: "Probe Tender",
      description: "Start checking — probe should slide in with little resistance",
      color: "#22c55e",
      style: "line",
      alertType: "notification",
      alertMessage: "Getting close — start checking for probe tenderness.",
    },
    {
      temp: 203,
      label: "TARGET — Pull",
      description: "Ideal pull temperature for beef ribs",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Pull your beef ribs!",
    },
  ],
};

export const STEAK: MeatProfile = {
  id: "steak",
  name: "Steak",
  category: "beef",
  markers: [
    {
      temp: 120,
      label: "Rare",
      description: "Cool red center",
      color: "#3b82f6",
      style: "line",
      alertType: "notification",
      alertMessage: "Probe at 120°F — Rare. Pull now for rare.",
    },
    {
      temp: 130,
      label: "Med Rare",
      description: "Warm red center — most popular doneness",
      color: "#22c55e",
      style: "line",
      alertType: "alarm",
      alertMessage: "Probe at 130°F — Medium Rare! Pull now!",
    },
    {
      temp: 140,
      label: "Medium",
      description: "Warm pink center",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Probe at 140°F — Medium.",
    },
    {
      temp: 150,
      label: "Med Well",
      description: "Slight pink center",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "Probe at 150°F — Medium Well.",
    },
    {
      temp: 160,
      label: "Well Done",
      description: "No pink — fully cooked through",
      color: "#ef4444",
      style: "line",
      alertType: "notification",
      alertMessage: "Probe at 160°F — Well Done.",
    },
  ],
};

export const TRI_TIP: MeatProfile = {
  id: "tri_tip",
  name: "Tri-Tip",
  category: "beef",
  markers: [
    {
      temp: 125,
      label: "Rare",
      description: "Cool red center",
      color: "#3b82f6",
      style: "line",
      alertType: "notification",
      alertMessage: "Tri-tip at 125°F — Rare.",
    },
    {
      temp: 135,
      label: "Med Rare",
      description: "Ideal for tri-tip — warm red center",
      color: "#22c55e",
      style: "line",
      alertType: "alarm",
      alertMessage: "Tri-tip at 135°F — Medium Rare! Pull now!",
    },
    {
      temp: 145,
      label: "Medium",
      description: "Warm pink — still juicy",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Tri-tip at 145°F — Medium.",
    },
  ],
};

// ─── PORK ───────────────────────────────────────────────

export const PORK_BUTT: MeatProfile = {
  id: "pork_butt",
  name: "Pork Butt / Shoulder",
  category: "pork",
  markers: [
    {
      temp: 150,
      label: "Stall Zone",
      description: "Evaporative cooling plateau — same physics as brisket",
      color: "#ef4444",
      style: "band",
      bandEnd: 170,
      alertType: "notification",
      alertMessage: "Entering the stall zone. Patience — or wrap to push through.",
    },
    {
      temp: 160,
      label: "Collagen Start",
      description: "Connective tissue breakdown begins",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "Collagen breakdown starting — the magic is happening.",
    },
    {
      temp: 195,
      label: "Pull Ready",
      description: "Start checking — should pull apart easily",
      color: "#22c55e",
      style: "line",
      alertType: "notification",
      alertMessage: "Getting close! Start checking for pull-apart tenderness.",
    },
    {
      temp: 203,
      label: "TARGET — Pull",
      description: "Ideal pull temperature — bone should twist out cleanly",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Pull your pork! Bone should twist out cleanly.",
    },
  ],
};

export const PORK_RIBS: MeatProfile = {
  id: "pork_ribs",
  name: "Pork Ribs (Baby Back / Spare)",
  category: "pork",
  markers: [
    {
      temp: 165,
      label: "Wrap Point",
      description: "Common wrap point for 3-2-1 method",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "165°F — Time to wrap if using the 3-2-1 method.",
    },
    {
      temp: 190,
      label: "Bend Test",
      description: "Rack should bend and crack when lifted from one end",
      color: "#22c55e",
      style: "band",
      bandEnd: 205,
      alertType: "notification",
      alertMessage: "Approaching done — do the bend test!",
    },
    {
      temp: 200,
      label: "TARGET — Pull",
      description: "Ideal pull temp — meat pulls back from bone",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Pull your ribs!",
    },
  ],
};

export const PORK_LOIN: MeatProfile = {
  id: "pork_loin",
  name: "Pork Loin / Tenderloin",
  category: "pork",
  markers: [
    {
      temp: 135,
      label: "Medium Rare",
      description: "Slightly pink — juicy and tender",
      color: "#22c55e",
      style: "line",
      alertType: "notification",
      alertMessage: "Pork loin at 135°F — pull for medium rare (will carryover to 140°F).",
    },
    {
      temp: 145,
      label: "TARGET — Medium",
      description: "USDA safe temperature — juicy and perfectly done",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Pull your pork loin! 145°F is perfect.",
    },
    {
      temp: 160,
      label: "Well Done",
      description: "Traditional done — may be dry",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Pork loin at 160°F — well done.",
    },
  ],
};

// ─── POULTRY ────────────────────────────────────────────

export const WHOLE_CHICKEN: MeatProfile = {
  id: "whole_chicken",
  name: "Whole Chicken",
  category: "poultry",
  markers: [
    {
      temp: 150,
      label: "Almost There",
      description: "Getting close — keep monitoring",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Chicken approaching safe temp — almost there.",
    },
    {
      temp: 165,
      label: "SAFE — Breast",
      description: "USDA safe minimum — breast meat done",
      color: "#22c55e",
      style: "line",
      alertType: "alarm",
      alertMessage: "165°F REACHED — Chicken is safe to eat! Pull if probing breast.",
    },
    {
      temp: 175,
      label: "TARGET — Thigh",
      description: "Ideal thigh/dark meat temperature — more tender and flavorful",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Thigh at 175°F! Perfect for dark meat.",
    },
  ],
};

export const TURKEY: MeatProfile = {
  id: "turkey",
  name: "Turkey",
  category: "poultry",
  markers: [
    {
      temp: 155,
      label: "Almost There",
      description: "Getting close — prepare for pull",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Turkey approaching safe temp.",
    },
    {
      temp: 165,
      label: "SAFE — Breast",
      description: "USDA safe minimum — breast done",
      color: "#22c55e",
      style: "line",
      alertType: "alarm",
      alertMessage: "165°F REACHED — Turkey breast is safe! Pull if probing breast.",
    },
    {
      temp: 175,
      label: "TARGET — Thigh",
      description: "Ideal thigh temperature",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Turkey thigh at 175°F!",
    },
  ],
};

// ─── LAMB ───────────────────────────────────────────────

export const LAMB_LEG: MeatProfile = {
  id: "lamb_leg",
  name: "Leg of Lamb",
  category: "lamb",
  markers: [
    {
      temp: 130,
      label: "Med Rare",
      description: "Warm red center — ideal for lamb",
      color: "#22c55e",
      style: "line",
      alertType: "notification",
      alertMessage: "Lamb at 130°F — Medium Rare.",
    },
    {
      temp: 140,
      label: "TARGET — Medium",
      description: "Warm pink — most popular for lamb",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Lamb at 140°F! Medium — pull now.",
    },
    {
      temp: 155,
      label: "Med Well",
      description: "Slight pink",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "Lamb at 155°F — Medium Well.",
    },
  ],
};

export const LAMB_RACK: MeatProfile = {
  id: "lamb_rack",
  name: "Rack of Lamb",
  category: "lamb",
  markers: [
    {
      temp: 125,
      label: "Rare",
      description: "Cool red center",
      color: "#3b82f6",
      style: "line",
      alertType: "notification",
      alertMessage: "Rack of lamb at 125°F — Rare.",
    },
    {
      temp: 135,
      label: "TARGET — Med Rare",
      description: "Ideal for rack of lamb",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Rack of lamb at 135°F! Pull now!",
    },
    {
      temp: 145,
      label: "Medium",
      description: "Warm pink center",
      color: "#eab308",
      style: "line",
      alertType: "notification",
      alertMessage: "Rack of lamb at 145°F — Medium.",
    },
  ],
};

// ─── SEAFOOD ────────────────────────────────────────────

export const SALMON: MeatProfile = {
  id: "salmon",
  name: "Salmon",
  category: "seafood",
  markers: [
    {
      temp: 120,
      label: "Med Rare",
      description: "Translucent center — sushi-grade texture",
      color: "#22c55e",
      style: "line",
      alertType: "notification",
      alertMessage: "Salmon at 120°F — Medium Rare.",
    },
    {
      temp: 130,
      label: "TARGET — Medium",
      description: "Opaque, flaky — ideal smoked salmon",
      color: "#4ade80",
      style: "line",
      alertType: "alarm",
      alertMessage: "TARGET REACHED — Salmon at 130°F! Pull now!",
    },
    {
      temp: 145,
      label: "Well Done",
      description: "Fully cooked through — may be dry",
      color: "#f97316",
      style: "line",
      alertType: "notification",
      alertMessage: "Salmon at 145°F — Well Done.",
    },
  ],
};

// ─── REGISTRY ───────────────────────────────────────────

export const MEAT_PROFILES: Record<string, MeatProfile> = {
  brisket: BRISKET,
  beef_ribs: BEEF_RIBS,
  steak: STEAK,
  tri_tip: TRI_TIP,
  pork_butt: PORK_BUTT,
  pork_ribs: PORK_RIBS,
  pork_loin: PORK_LOIN,
  whole_chicken: WHOLE_CHICKEN,
  turkey: TURKEY,
  lamb_leg: LAMB_LEG,
  lamb_rack: LAMB_RACK,
  salmon: SALMON,
};

/**
 * Get meat profile by ID, or try to match by meat type + cut name
 */
export function getMeatProfile(id?: string, meatType?: string, cutName?: string): MeatProfile | undefined {
  if (id && MEAT_PROFILES[id]) return MEAT_PROFILES[id];
  
  // Try to fuzzy match by name
  const search = (cutName || meatType || "").toLowerCase();
  if (!search) return undefined;
  
  for (const profile of Object.values(MEAT_PROFILES)) {
    if (search.includes(profile.name.toLowerCase()) || profile.name.toLowerCase().includes(search)) {
      return profile;
    }
  }
  
  // Category-level fallback matching
  const categoryMap: Record<string, string> = {
    beef: "steak",
    pork: "pork_loin",
    poultry: "whole_chicken",
    chicken: "whole_chicken",
    turkey: "turkey",
    lamb: "lamb_leg",
    seafood: "salmon",
    fish: "salmon",
  };
  
  for (const [key, profileId] of Object.entries(categoryMap)) {
    if (search.includes(key)) return MEAT_PROFILES[profileId];
  }
  
  return undefined;
}

/**
 * Get all available meat profiles grouped by category
 */
export function getMeatProfilesByCategory(): Record<string, MeatProfile[]> {
  const grouped: Record<string, MeatProfile[]> = {};
  for (const profile of Object.values(MEAT_PROFILES)) {
    if (!grouped[profile.category]) grouped[profile.category] = [];
    grouped[profile.category].push(profile);
  }
  return grouped;
}
