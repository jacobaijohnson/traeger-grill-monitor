/**
 * Cut Catalog — Comprehensive meat/fish sub-cut database
 * 
 * Powers the drill-down selectors in Live Cook:
 *   Category → Cut → Doneness / Thickness / Weight
 * 
 * Each cut includes:
 *   - Default doneness levels with pull temps (accounting for carryover)
 *   - Thickness options that affect cook time
 *   - Weight relevance (for large cuts)
 *   - Recommended grill temp and method
 *   - Which meat science profile to use for graph markers
 *   - Whether stall detection is relevant
 */

// ─── Types ─────────────────────────────────────────────

export interface DonenessLevel {
  id: string;
  label: string;
  pullTemp: number;      // Internal temp to pull at (accounts for ~5°F carryover)
  finalTemp: number;     // Expected final temp after rest
  description: string;
  isDefault?: boolean;   // Highlighted as recommended
  isSafe?: boolean;      // Meets USDA minimum
}

export interface ThicknessOption {
  id: string;
  label: string;
  inches: number;
  timeMultiplier: number; // 1.0 = baseline, 1.5 = 50% longer
}

export interface CutDefinition {
  id: string;
  name: string;
  category: "beef" | "pork" | "poultry" | "lamb" | "seafood" | "game";
  aliases: string[];              // Alternative names for search
  meatProfileId: string;          // Links to meat-science.ts profile for graph markers
  
  // Cooking defaults
  defaultMethod: "smoke" | "grill" | "reverse_sear" | "roast";
  defaultGrillTemp: number;
  
  // Doneness
  doneness: DonenessLevel[];
  
  // Size parameters
  thicknessOptions?: ThicknessOption[];   // For steaks, chops, fillets
  weightRelevant: boolean;                // For large cuts — show weight input
  defaultWeightLbs?: number;              // Suggested default weight
  timePerPoundMinutes?: number;           // For weight-based time estimates
  baseTimeMins?: number;                  // For non-weight-based time estimates
  
  // Cook characteristics
  hasStall: boolean;                      // Show stall detection
  wrapRecommended: boolean;              // Suggest wrapping at stall
  restMinutes: number;                    // Recommended rest time
  
  // Tips
  tips: string[];
}

// ─── BEEF CUTS ─────────────────────────────────────────

const BEEF_DONENESS: DonenessLevel[] = [
  { id: "rare", label: "Rare", pullTemp: 120, finalTemp: 125, description: "Cool red center", isSafe: false },
  { id: "medium_rare", label: "Medium Rare", pullTemp: 130, finalTemp: 135, description: "Warm red center — most popular", isDefault: true, isSafe: false },
  { id: "medium", label: "Medium", pullTemp: 140, finalTemp: 145, description: "Warm pink center", isSafe: true },
  { id: "medium_well", label: "Medium Well", pullTemp: 150, finalTemp: 155, description: "Slight pink center", isSafe: true },
  { id: "well_done", label: "Well Done", pullTemp: 160, finalTemp: 165, description: "No pink — fully cooked through", isSafe: true },
];

const STEAK_THICKNESS: ThicknessOption[] = [
  { id: "thin", label: '3/4"', inches: 0.75, timeMultiplier: 0.6 },
  { id: "standard", label: '1"', inches: 1.0, timeMultiplier: 0.8 },
  { id: "thick", label: '1.25"', inches: 1.25, timeMultiplier: 1.0 },
  { id: "extra_thick", label: '1.5"', inches: 1.5, timeMultiplier: 1.2 },
  { id: "tomahawk", label: '2"+', inches: 2.0, timeMultiplier: 1.5 },
];

const BEEF_CUTS: CutDefinition[] = [
  {
    id: "ribeye",
    name: "Ribeye",
    category: "beef",
    aliases: ["rib eye", "cowboy steak", "delmonico"],
    meatProfileId: "steak",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: BEEF_DONENESS,
    thicknessOptions: STEAK_THICKNESS,
    weightRelevant: false,
    baseTimeMins: 60,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 8,
    tips: [
      "Best for reverse sear at 1.5\"+ thickness",
      "Pat completely dry before searing for best crust",
      "The fat cap renders beautifully at low temps",
    ],
  },
  {
    id: "ny_strip",
    name: "New York Strip",
    category: "beef",
    aliases: ["NY strip", "strip steak", "kansas city strip", "ambassador steak"],
    meatProfileId: "steak",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: BEEF_DONENESS,
    thicknessOptions: STEAK_THICKNESS,
    weightRelevant: false,
    baseTimeMins: 55,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 8,
    tips: [
      "Trim the fat cap to 1/4\" for even rendering",
      "Great balance of tenderness and beefy flavor",
    ],
  },
  {
    id: "filet_mignon",
    name: "Filet Mignon",
    category: "beef",
    aliases: ["tenderloin steak", "filet", "chateaubriand"],
    meatProfileId: "steak",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: BEEF_DONENESS,
    thicknessOptions: [
      { id: "standard", label: '1.5"', inches: 1.5, timeMultiplier: 1.0 },
      { id: "thick", label: '2"', inches: 2.0, timeMultiplier: 1.3 },
      { id: "extra_thick", label: '2.5"', inches: 2.5, timeMultiplier: 1.6 },
    ],
    weightRelevant: false,
    baseTimeMins: 50,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 8,
    tips: [
      "Wrap with bacon for extra flavor and fat",
      "Very lean — don't overcook past medium",
      "Sear in a cast iron for best crust",
    ],
  },
  {
    id: "t_bone",
    name: "T-Bone / Porterhouse",
    category: "beef",
    aliases: ["t-bone", "porterhouse", "t bone"],
    meatProfileId: "steak",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: BEEF_DONENESS,
    thicknessOptions: STEAK_THICKNESS,
    weightRelevant: false,
    baseTimeMins: 65,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "Position the tenderloin side away from direct heat",
      "Porterhouse has a larger tenderloin section than T-bone",
      "Probe the strip side — it cooks slower than the tenderloin",
    ],
  },
  {
    id: "flank_steak",
    name: "Flank Steak",
    category: "beef",
    aliases: ["flank", "london broil"],
    meatProfileId: "steak",
    defaultMethod: "grill",
    defaultGrillTemp: 450,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 125, finalTemp: 130, description: "Best for flank — stays tender", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 135, finalTemp: 140, description: "Still good — slice thin", isSafe: true },
    ],
    thicknessOptions: [
      { id: "standard", label: '3/4" - 1"', inches: 0.875, timeMultiplier: 1.0 },
    ],
    weightRelevant: false,
    baseTimeMins: 12,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "MUST slice against the grain — this is critical for tenderness",
      "Marinate 4-24 hours for best flavor",
      "Don't cook past medium or it gets tough",
    ],
  },
  {
    id: "skirt_steak",
    name: "Skirt Steak",
    category: "beef",
    aliases: ["skirt", "fajita meat", "arrachera"],
    meatProfileId: "steak",
    defaultMethod: "grill",
    defaultGrillTemp: 450,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 125, finalTemp: 130, description: "Best for skirt — stays juicy", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 135, finalTemp: 140, description: "Still tender if sliced thin", isSafe: true },
    ],
    thicknessOptions: [
      { id: "thin", label: '1/2" (inside skirt)', inches: 0.5, timeMultiplier: 0.7 },
      { id: "standard", label: '3/4" (outside skirt)', inches: 0.75, timeMultiplier: 1.0 },
    ],
    weightRelevant: false,
    baseTimeMins: 8,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 5,
    tips: [
      "Outside skirt is thicker and more tender than inside skirt",
      "High heat, fast cook — don't overthink it",
      "Slice against the grain at a 45° angle",
    ],
  },
  {
    id: "round_steak",
    name: "Round Steak",
    category: "beef",
    aliases: ["top round", "bottom round", "eye of round", "london broil"],
    meatProfileId: "steak",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 125, finalTemp: 130, description: "Best for round — keeps moisture", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 135, finalTemp: 140, description: "Acceptable — slice very thin", isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 3,
    timePerPoundMinutes: 35,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 15,
    tips: [
      "Very lean — don't overcook or it gets tough and dry",
      "Great for deli-style roast beef when sliced paper-thin",
      "Consider a marinade or dry brine overnight",
    ],
  },
  {
    id: "brisket_whole",
    name: "Whole Packer Brisket",
    category: "beef",
    aliases: ["brisket", "packer brisket", "whole brisket"],
    meatProfileId: "brisket",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Probe Tender", pullTemp: 203, finalTemp: 205, description: "Probe slides in like butter", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 14,
    timePerPoundMinutes: 90,
    hasStall: true,
    wrapRecommended: true,
    restMinutes: 60,
    tips: [
      "Trim fat cap to 1/4\" for best bark",
      "The stall at 150-170°F is normal — wrap in butcher paper to push through",
      "Rest in a cooler for 1-4 hours for best results",
      "Done by feel (probe tender), not just temperature",
    ],
  },
  {
    id: "brisket_flat",
    name: "Brisket Flat",
    category: "beef",
    aliases: ["flat", "first cut brisket"],
    meatProfileId: "brisket",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Probe Tender", pullTemp: 200, finalTemp: 203, description: "Leaner than whole packer — pull slightly earlier", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 6,
    timePerPoundMinutes: 75,
    hasStall: true,
    wrapRecommended: true,
    restMinutes: 45,
    tips: [
      "Flats are leaner — wrap earlier to retain moisture",
      "Consider injecting with beef broth for extra moisture",
      "Slice against the grain — the grain runs lengthwise",
    ],
  },
  {
    id: "brisket_point",
    name: "Brisket Point",
    category: "beef",
    aliases: ["point", "deckle", "second cut brisket"],
    meatProfileId: "brisket",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Probe Tender", pullTemp: 205, finalTemp: 207, description: "Fattier cut — can go a bit higher", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 5,
    timePerPoundMinutes: 90,
    hasStall: true,
    wrapRecommended: false,
    restMinutes: 30,
    tips: [
      "Great for burnt ends — cube after smoking and toss in sauce",
      "More forgiving than the flat due to higher fat content",
    ],
  },
  {
    id: "beef_short_ribs",
    name: "Beef Short Ribs",
    category: "beef",
    aliases: ["short ribs", "plate ribs", "dino ribs", "beef ribs"],
    meatProfileId: "beef_ribs",
    defaultMethod: "smoke",
    defaultGrillTemp: 250,
    doneness: [
      { id: "target", label: "Probe Tender", pullTemp: 203, finalTemp: 205, description: "Fall-off-the-bone tender", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 420,
    hasStall: true,
    wrapRecommended: false,
    restMinutes: 30,
    tips: [
      "Look for plate ribs with thick meat above the bone",
      "No need to wrap — unwrapped produces better bark",
      "Season heavily — these are big cuts",
    ],
  },
  {
    id: "tri_tip",
    name: "Tri-Tip",
    category: "beef",
    aliases: ["tri tip", "santa maria steak", "bottom sirloin"],
    meatProfileId: "tri_tip",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 130, finalTemp: 135, description: "Ideal for tri-tip", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 140, finalTemp: 145, description: "Still juicy", isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 2.5,
    timePerPoundMinutes: 40,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "Tri-tip has two grain directions — find the seam and slice accordingly",
      "Santa Maria style: garlic, salt, pepper, and red oak smoke",
    ],
  },
  {
    id: "prime_rib",
    name: "Prime Rib / Standing Rib Roast",
    category: "beef",
    aliases: ["prime rib", "standing rib roast", "rib roast"],
    meatProfileId: "steak",
    defaultMethod: "roast",
    defaultGrillTemp: 225,
    doneness: BEEF_DONENESS.map(d => d.id === "medium_rare" ? { ...d, pullTemp: 125, finalTemp: 130 } : d),
    weightRelevant: true,
    defaultWeightLbs: 8,
    timePerPoundMinutes: 15,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 20,
    tips: [
      "Remove from fridge 2 hours before cooking",
      "Season generously with salt the night before",
      "Sear at 450°F at the end for a beautiful crust",
    ],
  },
];

// ─── PORK CUTS ─────────────────────────────────────────

const PORK_CHOP_DONENESS: DonenessLevel[] = [
  { id: "medium", label: "Medium (Juicy)", pullTemp: 140, finalTemp: 145, description: "USDA safe — juicy and tender", isDefault: true, isSafe: true },
  { id: "well_done", label: "Well Done", pullTemp: 155, finalTemp: 160, description: "Traditional — may be drier", isSafe: true },
];

const PORK_CUTS: CutDefinition[] = [
  {
    id: "pork_butt",
    name: "Pork Butt / Boston Butt",
    category: "pork",
    aliases: ["pork butt", "boston butt", "pork shoulder", "pulled pork"],
    meatProfileId: "pork_butt",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Pull-Apart Tender", pullTemp: 203, finalTemp: 205, description: "Bone twists out cleanly", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 8,
    timePerPoundMinutes: 90,
    hasStall: true,
    wrapRecommended: true,
    restMinutes: 60,
    tips: [
      "Don't trim the fat cap — it bastes the meat",
      "Wrap at 160°F to push through the stall",
      "Save the drippings to mix back into pulled pork",
    ],
  },
  {
    id: "pork_picnic",
    name: "Pork Picnic Shoulder",
    category: "pork",
    aliases: ["picnic shoulder", "picnic roast", "pork arm"],
    meatProfileId: "pork_butt",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Pull-Apart Tender", pullTemp: 203, finalTemp: 205, description: "Shreds easily", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 7,
    timePerPoundMinutes: 95,
    hasStall: true,
    wrapRecommended: true,
    restMinutes: 60,
    tips: [
      "Similar to pork butt but with more connective tissue",
      "Skin-on? Score it for better smoke penetration",
    ],
  },
  {
    id: "baby_back_ribs",
    name: "Baby Back Ribs",
    category: "pork",
    aliases: ["baby backs", "loin ribs", "back ribs"],
    meatProfileId: "pork_ribs",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Bend Test Done", pullTemp: 200, finalTemp: 203, description: "Rack bends and cracks when lifted", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 300,
    hasStall: false,
    wrapRecommended: true,
    restMinutes: 10,
    tips: [
      "Remove the membrane from the back before seasoning",
      "2-2-1 method for baby backs (shorter than spare ribs)",
      "Bump to 275°F in the final hour for sauce caramelization",
    ],
  },
  {
    id: "spare_ribs",
    name: "Spare Ribs / St. Louis Style",
    category: "pork",
    aliases: ["spare ribs", "st louis ribs", "st. louis", "spareribs"],
    meatProfileId: "pork_ribs",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Bend Test Done", pullTemp: 200, finalTemp: 203, description: "Meat pulls back from bone", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 360,
    hasStall: false,
    wrapRecommended: true,
    restMinutes: 10,
    tips: [
      "Full 3-2-1 method works best for spare ribs",
      "Trim rib tips for St. Louis style presentation",
      "Meatier and fattier than baby backs",
    ],
  },
  {
    id: "pork_loin",
    name: "Pork Loin",
    category: "pork",
    aliases: ["loin roast", "center cut loin", "pork loin roast"],
    meatProfileId: "pork_loin",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: PORK_CHOP_DONENESS,
    weightRelevant: true,
    defaultWeightLbs: 4,
    timePerPoundMinutes: 45,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "Very lean — do NOT overcook past 145°F",
      "Brine 4-12 hours for extra moisture",
      "Pull at 140°F — carryover brings to 145°F",
    ],
  },
  {
    id: "pork_tenderloin",
    name: "Pork Tenderloin",
    category: "pork",
    aliases: ["tenderloin", "pork tender"],
    meatProfileId: "pork_loin",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: PORK_CHOP_DONENESS,
    weightRelevant: false,
    baseTimeMins: 90,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 8,
    tips: [
      "Small and lean — cooks fast, watch closely",
      "Great with a sweet glaze applied in the last 15 minutes",
    ],
  },
  {
    id: "pork_chops",
    name: "Pork Chops",
    category: "pork",
    aliases: ["chops", "bone-in chops", "center cut chops"],
    meatProfileId: "pork_loin",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: PORK_CHOP_DONENESS,
    thicknessOptions: [
      { id: "thin", label: '3/4"', inches: 0.75, timeMultiplier: 0.7 },
      { id: "standard", label: '1"', inches: 1.0, timeMultiplier: 1.0 },
      { id: "thick", label: '1.5"', inches: 1.5, timeMultiplier: 1.3 },
      { id: "double", label: '2"', inches: 2.0, timeMultiplier: 1.6 },
    ],
    weightRelevant: false,
    baseTimeMins: 45,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 5,
    tips: [
      "Bone-in chops are more forgiving than boneless",
      "Brine for 30 min - 4 hours for juicier results",
      "Reverse sear works great for thick-cut chops",
    ],
  },
  {
    id: "pork_belly",
    name: "Pork Belly",
    category: "pork",
    aliases: ["belly", "bacon slab", "uncured belly"],
    meatProfileId: "pork_butt",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Rendered & Tender", pullTemp: 200, finalTemp: 203, description: "Fat fully rendered, meat jiggles", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 240,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "Great for burnt ends — cube, sauce, and finish at high heat",
      "Score the skin for crispier results",
    ],
  },
];

// ─── POULTRY CUTS ──────────────────────────────────────

const POULTRY_CUTS: CutDefinition[] = [
  {
    id: "whole_chicken",
    name: "Whole Chicken",
    category: "poultry",
    aliases: ["chicken", "roaster", "whole bird"],
    meatProfileId: "whole_chicken",
    defaultMethod: "roast",
    defaultGrillTemp: 350,
    doneness: [
      { id: "breast", label: "Breast Done", pullTemp: 165, finalTemp: 167, description: "USDA safe — breast meat done", isSafe: true },
      { id: "thigh", label: "Thigh Perfect", pullTemp: 175, finalTemp: 178, description: "Dark meat tender and flavorful", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 4,
    timePerPoundMinutes: 30,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 15,
    tips: [
      "Spatchcock for more even cooking and crispier skin",
      "Pat skin dry and rub with oil for crispiest skin",
      "Low temp too long = rubbery skin. Keep smoke phase to 1 hour max.",
    ],
  },
  {
    id: "chicken_breast",
    name: "Chicken Breast",
    category: "poultry",
    aliases: ["breast", "boneless breast", "chicken breasts"],
    meatProfileId: "whole_chicken",
    defaultMethod: "grill",
    defaultGrillTemp: 375,
    doneness: [
      { id: "safe", label: "Done", pullTemp: 162, finalTemp: 165, description: "USDA safe — juicy if not overcooked", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 25,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 5,
    tips: [
      "Pound to even thickness for uniform cooking",
      "Brine for 30 minutes for much juicier results",
      "Don't overcook — 165°F is the target, not higher",
    ],
  },
  {
    id: "chicken_thighs",
    name: "Chicken Thighs",
    category: "poultry",
    aliases: ["thighs", "bone-in thighs", "chicken thigh"],
    meatProfileId: "whole_chicken",
    defaultMethod: "smoke",
    defaultGrillTemp: 275,
    doneness: [
      { id: "target", label: "Perfect", pullTemp: 185, finalTemp: 190, description: "Collagen broken down — tender and juicy", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 90,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 5,
    tips: [
      "Dark meat is very forgiving — hard to overcook",
      "Finish at 400°F for crispy skin",
      "185°F+ is ideal — collagen needs to break down",
    ],
  },
  {
    id: "chicken_wings",
    name: "Chicken Wings",
    category: "poultry",
    aliases: ["wings", "party wings", "buffalo wings"],
    meatProfileId: "whole_chicken",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Crispy Done", pullTemp: 185, finalTemp: 190, description: "Crispy skin, tender meat", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 90,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Pat dry and toss with baking powder for extra crisp",
      "Smoke at 225°F for 45 min, then crank to 400°F to crisp",
      "Toss in sauce AFTER crisping",
    ],
  },
  {
    id: "whole_turkey",
    name: "Whole Turkey",
    category: "poultry",
    aliases: ["turkey", "thanksgiving turkey", "smoked turkey"],
    meatProfileId: "turkey",
    defaultMethod: "roast",
    defaultGrillTemp: 325,
    doneness: [
      { id: "breast", label: "Breast Done", pullTemp: 165, finalTemp: 167, description: "USDA safe minimum", isSafe: true },
      { id: "thigh", label: "Thigh Perfect", pullTemp: 175, finalTemp: 178, description: "Dark meat tender", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 12,
    timePerPoundMinutes: 20,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 30,
    tips: [
      "Keep under 14 lbs for food safety on the smoker",
      "Brine 12-24 hours for juiciest results",
      "Tent with foil if skin gets too dark",
    ],
  },
  {
    id: "turkey_breast",
    name: "Turkey Breast",
    category: "poultry",
    aliases: ["bone-in turkey breast", "boneless turkey breast"],
    meatProfileId: "turkey",
    defaultMethod: "smoke",
    defaultGrillTemp: 275,
    doneness: [
      { id: "target", label: "Done", pullTemp: 162, finalTemp: 165, description: "USDA safe — pull slightly early for carryover", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 6,
    timePerPoundMinutes: 25,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 20,
    tips: [
      "Great alternative to whole turkey for smaller gatherings",
      "Butter under the skin for extra moisture and flavor",
    ],
  },
];

// ─── LAMB CUTS ─────────────────────────────────────────

const LAMB_DONENESS: DonenessLevel[] = [
  { id: "rare", label: "Rare", pullTemp: 125, finalTemp: 130, description: "Cool red center", isSafe: false },
  { id: "medium_rare", label: "Medium Rare", pullTemp: 135, finalTemp: 140, description: "Warm red — ideal for most lamb", isDefault: true, isSafe: false },
  { id: "medium", label: "Medium", pullTemp: 145, finalTemp: 150, description: "Warm pink center", isSafe: true },
  { id: "medium_well", label: "Medium Well", pullTemp: 155, finalTemp: 160, description: "Slight pink", isSafe: true },
];

const LAMB_CUTS: CutDefinition[] = [
  {
    id: "lamb_rack",
    name: "Rack of Lamb",
    category: "lamb",
    aliases: ["lamb rack", "frenched rack", "lamb chops rack"],
    meatProfileId: "lamb_rack",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: LAMB_DONENESS,
    weightRelevant: false,
    baseTimeMins: 90,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "French the bones for elegant presentation",
      "Herb crust: Dijon + breadcrumbs + rosemary after searing",
    ],
  },
  {
    id: "lamb_leg",
    name: "Leg of Lamb",
    category: "lamb",
    aliases: ["leg of lamb", "bone-in leg", "boneless leg of lamb"],
    meatProfileId: "lamb_leg",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: LAMB_DONENESS,
    weightRelevant: true,
    defaultWeightLbs: 7,
    timePerPoundMinutes: 45,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 20,
    tips: [
      "Stud with garlic cloves and fresh rosemary",
      "Lamb fat renders beautifully at low temps",
    ],
  },
  {
    id: "lamb_chops",
    name: "Lamb Chops (Loin / Rib)",
    category: "lamb",
    aliases: ["lamb chops", "loin chops", "rib chops", "lamb lollipops"],
    meatProfileId: "lamb_rack",
    defaultMethod: "grill",
    defaultGrillTemp: 450,
    doneness: LAMB_DONENESS,
    thicknessOptions: [
      { id: "thin", label: '3/4"', inches: 0.75, timeMultiplier: 0.7 },
      { id: "standard", label: '1"', inches: 1.0, timeMultiplier: 1.0 },
      { id: "thick", label: '1.5"', inches: 1.5, timeMultiplier: 1.4 },
    ],
    weightRelevant: false,
    baseTimeMins: 12,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 5,
    tips: [
      "High heat, fast cook — like a steak",
      "Medium rare is ideal for lamb chops",
    ],
  },
  {
    id: "lamb_shoulder",
    name: "Lamb Shoulder",
    category: "lamb",
    aliases: ["lamb shoulder roast", "bone-in shoulder"],
    meatProfileId: "lamb_leg",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Pull-Apart Tender", pullTemp: 195, finalTemp: 200, description: "Shreds easily — like pulled pork", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 5,
    timePerPoundMinutes: 60,
    hasStall: true,
    wrapRecommended: true,
    restMinutes: 30,
    tips: [
      "Think of it as lamb pulled pork — same low and slow approach",
      "Wrap at 165°F to push through the stall",
    ],
  },
];

// ─── SEAFOOD CUTS ──────────────────────────────────────

const SEAFOOD_CUTS: CutDefinition[] = [
  {
    id: "salmon_fillet",
    name: "Salmon (Atlantic / King)",
    category: "seafood",
    aliases: ["salmon", "atlantic salmon", "king salmon", "chinook", "salmon fillet"],
    meatProfileId: "salmon",
    defaultMethod: "smoke",
    defaultGrillTemp: 220,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 120, finalTemp: 125, description: "Translucent center — sushi-grade texture", isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 130, finalTemp: 135, description: "Opaque, flaky — ideal smoked salmon", isDefault: true, isSafe: true },
      { id: "well_done", label: "Well Done (USDA)", pullTemp: 145, finalTemp: 148, description: "Fully cooked — may be dry", isSafe: true },
    ],
    thicknessOptions: [
      { id: "thin", label: '3/4" fillet', inches: 0.75, timeMultiplier: 0.7 },
      { id: "standard", label: '1" fillet', inches: 1.0, timeMultiplier: 1.0 },
      { id: "thick", label: '1.5" steak cut', inches: 1.5, timeMultiplier: 1.4 },
    ],
    weightRelevant: false,
    baseTimeMins: 60,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Dry brine with salt and brown sugar 4-12 hours",
      "Let pellicle form by air-drying 1-2 hours before smoking",
      "Don't go above 225°F or albumin (white stuff) pushes out",
    ],
  },
  {
    id: "steelhead",
    name: "Steelhead Trout",
    category: "seafood",
    aliases: ["steelhead", "steelhead trout", "ocean trout"],
    meatProfileId: "salmon",
    defaultMethod: "smoke",
    defaultGrillTemp: 220,
    doneness: [
      { id: "medium", label: "Medium", pullTemp: 130, finalTemp: 135, description: "Flaky and moist — similar to salmon", isDefault: true, isSafe: true },
      { id: "well_done", label: "Well Done (USDA)", pullTemp: 145, finalTemp: 148, description: "Fully cooked", isSafe: true },
    ],
    thicknessOptions: [
      { id: "thin", label: '1/2" fillet', inches: 0.5, timeMultiplier: 0.6 },
      { id: "standard", label: '3/4" fillet', inches: 0.75, timeMultiplier: 1.0 },
      { id: "thick", label: '1" fillet', inches: 1.0, timeMultiplier: 1.3 },
    ],
    weightRelevant: false,
    baseTimeMins: 50,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Slightly leaner than salmon — watch for overcooking",
      "Same smoking technique as salmon works great",
      "Skin-side down on the grate — don't flip",
    ],
  },
  {
    id: "rainbow_trout",
    name: "Rainbow Trout",
    category: "seafood",
    aliases: ["trout", "brook trout", "freshwater trout"],
    meatProfileId: "salmon",
    defaultMethod: "smoke",
    defaultGrillTemp: 200,
    doneness: [
      { id: "medium", label: "Medium", pullTemp: 135, finalTemp: 140, description: "Flaky and delicate", isDefault: true, isSafe: true },
      { id: "well_done", label: "Well Done (USDA)", pullTemp: 145, finalTemp: 148, description: "Fully cooked", isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 40,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Smaller and more delicate than salmon — lower temp",
      "Whole trout smokes beautifully — stuff cavity with lemon and herbs",
    ],
  },
  {
    id: "cod",
    name: "Cod",
    category: "seafood",
    aliases: ["pacific cod", "atlantic cod", "codfish"],
    meatProfileId: "salmon",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Done", pullTemp: 145, finalTemp: 148, description: "Flakes easily with a fork", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 45,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Very lean white fish — don't overcook",
      "Use a cedar plank for easy handling and extra flavor",
    ],
  },
  {
    id: "halibut",
    name: "Halibut",
    category: "seafood",
    aliases: ["pacific halibut", "halibut steak", "halibut fillet"],
    meatProfileId: "salmon",
    defaultMethod: "grill",
    defaultGrillTemp: 400,
    doneness: [
      { id: "target", label: "Done", pullTemp: 130, finalTemp: 135, description: "Opaque and flaky — don't overcook", isDefault: true, isSafe: true },
    ],
    thicknessOptions: [
      { id: "standard", label: '1" steak', inches: 1.0, timeMultiplier: 1.0 },
      { id: "thick", label: '1.5" steak', inches: 1.5, timeMultiplier: 1.4 },
    ],
    weightRelevant: false,
    baseTimeMins: 15,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Very lean — oil well to prevent sticking",
      "Grill marks look great on halibut steaks",
    ],
  },
  {
    id: "mahi_mahi",
    name: "Mahi-Mahi",
    category: "seafood",
    aliases: ["mahi", "dolphinfish", "dorado"],
    meatProfileId: "salmon",
    defaultMethod: "grill",
    defaultGrillTemp: 400,
    doneness: [
      { id: "target", label: "Done", pullTemp: 137, finalTemp: 140, description: "Firm and flaky", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 12,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Firm enough to grill directly on grates",
      "Great with a citrus or mango salsa",
    ],
  },
  {
    id: "shrimp",
    name: "Shrimp",
    category: "seafood",
    aliases: ["prawns", "jumbo shrimp", "grilled shrimp"],
    meatProfileId: "salmon",
    defaultMethod: "grill",
    defaultGrillTemp: 400,
    doneness: [
      { id: "target", label: "Done", pullTemp: 120, finalTemp: 125, description: "Pink and opaque — C-shape, not O-shape", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 6,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Use skewers or a grill basket to prevent falling through",
      "C-shape = done, O-shape = overcooked",
      "2-3 minutes per side max",
    ],
  },
  {
    id: "lobster_tail",
    name: "Lobster Tail",
    category: "seafood",
    aliases: ["lobster", "lobster tails"],
    meatProfileId: "salmon",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "Done", pullTemp: 140, finalTemp: 145, description: "Opaque white — don't overcook", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 45,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Butterfly the tail and baste with garlic butter every 15 min",
      "Don't overcook — lobster gets rubbery fast",
    ],
  },
  {
    id: "scallops",
    name: "Scallops",
    category: "seafood",
    aliases: ["sea scallops", "diver scallops"],
    meatProfileId: "salmon",
    defaultMethod: "grill",
    defaultGrillTemp: 450,
    doneness: [
      { id: "target", label: "Done", pullTemp: 125, finalTemp: 130, description: "Golden sear, translucent center", isDefault: true, isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 6,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 0,
    tips: [
      "Pat VERY dry — moisture prevents searing",
      "High heat, 2 min per side, don't touch",
      "Use a cast iron on the grill for best sear",
    ],
  },
  {
    id: "swordfish",
    name: "Swordfish",
    category: "seafood",
    aliases: ["swordfish steak"],
    meatProfileId: "salmon",
    defaultMethod: "grill",
    defaultGrillTemp: 400,
    doneness: [
      { id: "medium", label: "Medium", pullTemp: 130, finalTemp: 135, description: "Slightly pink center — best texture", isDefault: true, isSafe: true },
      { id: "well_done", label: "Well Done", pullTemp: 145, finalTemp: 148, description: "Fully opaque", isSafe: true },
    ],
    thicknessOptions: [
      { id: "standard", label: '1" steak', inches: 1.0, timeMultiplier: 1.0 },
      { id: "thick", label: '1.5" steak', inches: 1.5, timeMultiplier: 1.4 },
    ],
    weightRelevant: false,
    baseTimeMins: 12,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 2,
    tips: [
      "Meaty enough to grill like a steak",
      "Marinate briefly (30 min max) — acid breaks down the flesh",
    ],
  },
];

// ─── GAME CUTS ─────────────────────────────────────────

const GAME_CUTS: CutDefinition[] = [
  {
    id: "venison_loin",
    name: "Venison Loin / Backstrap",
    category: "game",
    aliases: ["venison", "deer loin", "backstrap", "deer backstrap"],
    meatProfileId: "steak",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: [
      { id: "rare", label: "Rare", pullTemp: 120, finalTemp: 125, description: "Best for venison — keeps moisture", isSafe: false },
      { id: "medium_rare", label: "Medium Rare", pullTemp: 130, finalTemp: 135, description: "Still excellent", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 140, finalTemp: 145, description: "Max recommended — gets dry past this", isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 60,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 10,
    tips: [
      "Very lean — wrap in bacon or baste frequently",
      "Don't cook past medium or it gets dry and gamey",
      "Pairs well with juniper, rosemary, and red wine",
    ],
  },
  {
    id: "elk_roast",
    name: "Elk Roast",
    category: "game",
    aliases: ["elk", "elk loin", "elk tenderloin"],
    meatProfileId: "steak",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 130, finalTemp: 135, description: "Ideal for elk", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 140, finalTemp: 145, description: "Still good — don't go higher", isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 4,
    timePerPoundMinutes: 35,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 15,
    tips: [
      "Treat like beef but leaner — don't overcook",
      "Elk is milder than venison",
    ],
  },
  {
    id: "wild_boar",
    name: "Wild Boar",
    category: "game",
    aliases: ["boar", "wild pig", "feral hog"],
    meatProfileId: "pork_butt",
    defaultMethod: "smoke",
    defaultGrillTemp: 225,
    doneness: [
      { id: "target", label: "USDA Safe", pullTemp: 160, finalTemp: 165, description: "Must reach 160°F for wild game safety", isDefault: true, isSafe: true },
    ],
    weightRelevant: true,
    defaultWeightLbs: 6,
    timePerPoundMinutes: 60,
    hasStall: true,
    wrapRecommended: true,
    restMinutes: 30,
    tips: [
      "MUST cook to 160°F — wild boar can carry trichinella",
      "Gamier than domestic pork — marinate or brine",
      "Treat like a lean pork shoulder",
    ],
  },
  {
    id: "duck_breast",
    name: "Duck Breast",
    category: "game",
    aliases: ["duck", "magret", "duck magret"],
    meatProfileId: "steak",
    defaultMethod: "reverse_sear",
    defaultGrillTemp: 225,
    doneness: [
      { id: "medium_rare", label: "Medium Rare", pullTemp: 130, finalTemp: 135, description: "Pink center — ideal for duck", isDefault: true, isSafe: false },
      { id: "medium", label: "Medium", pullTemp: 140, finalTemp: 145, description: "Slightly pink", isSafe: true },
    ],
    weightRelevant: false,
    baseTimeMins: 45,
    hasStall: false,
    wrapRecommended: false,
    restMinutes: 8,
    tips: [
      "Score the skin in a crosshatch pattern for fat rendering",
      "Start skin-side down to render fat before searing",
      "Duck breast is red meat — treat like steak, not chicken",
    ],
  },
];

// ─── REGISTRY & HELPERS ────────────────────────────────

export const ALL_CUTS: CutDefinition[] = [
  ...BEEF_CUTS,
  ...PORK_CUTS,
  ...POULTRY_CUTS,
  ...LAMB_CUTS,
  ...SEAFOOD_CUTS,
  ...GAME_CUTS,
];

export const CUT_CATEGORIES = [
  { id: "beef", label: "Beef", icon: "🥩" },
  { id: "pork", label: "Pork", icon: "🐖" },
  { id: "poultry", label: "Poultry", icon: "🍗" },
  { id: "lamb", label: "Lamb", icon: "🐑" },
  { id: "seafood", label: "Seafood", icon: "🐟" },
  { id: "game", label: "Game", icon: "🦌" },
] as const;

/**
 * Get cuts by category
 */
export function getCutsByCategory(category: string): CutDefinition[] {
  return ALL_CUTS.filter(c => c.category === category);
}

/**
 * Find a cut by ID
 */
export function getCutById(id: string): CutDefinition | undefined {
  return ALL_CUTS.find(c => c.id === id);
}

/**
 * Search cuts by name or alias (for combobox)
 */
export function searchCuts(query: string, category?: string): CutDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return category ? getCutsByCategory(category) : ALL_CUTS;
  
  let cuts = category ? getCutsByCategory(category) : ALL_CUTS;
  
  return cuts.filter(c => 
    c.name.toLowerCase().includes(q) ||
    c.aliases.some(a => a.toLowerCase().includes(q)) ||
    c.category.toLowerCase().includes(q)
  );
}

/**
 * Estimate cook time in minutes based on cut, weight, and thickness
 */
export function estimateCookTime(
  cut: CutDefinition,
  weightLbs?: number,
  thicknessId?: string
): { minMinutes: number; maxMinutes: number; label: string } {
  let baseMins: number;
  
  if (cut.weightRelevant && weightLbs && cut.timePerPoundMinutes) {
    baseMins = cut.timePerPoundMinutes * weightLbs;
  } else {
    baseMins = cut.baseTimeMins || 60;
  }
  
  // Apply thickness multiplier
  if (thicknessId && cut.thicknessOptions) {
    const thickness = cut.thicknessOptions.find(t => t.id === thicknessId);
    if (thickness) {
      baseMins = Math.round(baseMins * thickness.timeMultiplier);
    }
  }
  
  const minMinutes = Math.round(baseMins * 0.8);
  const maxMinutes = Math.round(baseMins * 1.2);
  
  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };
  
  return {
    minMinutes,
    maxMinutes,
    label: `${formatTime(minMinutes)} – ${formatTime(maxMinutes)}`,
  };
}

/**
 * Get the default doneness for a cut
 */
export function getDefaultDoneness(cut: CutDefinition): DonenessLevel {
  return cut.doneness.find(d => d.isDefault) || cut.doneness[0];
}

/**
 * Build a cook configuration from selections
 */
export interface CookConfig {
  cutId: string;
  cutName: string;
  category: string;
  meatProfileId: string;
  method: string;
  grillTemp: number;
  donenessId: string;
  donenessLabel: string;
  pullTemp: number;
  finalTemp: number;
  thicknessId?: string;
  thicknessLabel?: string;
  weightLbs?: number;
  estimatedTime: string;
  hasStall: boolean;
  wrapRecommended: boolean;
  restMinutes: number;
  tips: string[];
}

export function buildCookConfig(
  cut: CutDefinition,
  donenessId?: string,
  thicknessId?: string,
  weightLbs?: number,
  grillTempOverride?: number,
  methodOverride?: string,
): CookConfig {
  const doneness = donenessId 
    ? cut.doneness.find(d => d.id === donenessId) || getDefaultDoneness(cut)
    : getDefaultDoneness(cut);
  
  const thickness = thicknessId 
    ? cut.thicknessOptions?.find(t => t.id === thicknessId) 
    : undefined;
  
  const weight = cut.weightRelevant ? (weightLbs || cut.defaultWeightLbs) : undefined;
  const timeEst = estimateCookTime(cut, weight, thicknessId);
  
  return {
    cutId: cut.id,
    cutName: cut.name,
    category: cut.category,
    meatProfileId: cut.meatProfileId,
    method: methodOverride || cut.defaultMethod,
    grillTemp: grillTempOverride || cut.defaultGrillTemp,
    donenessId: doneness.id,
    donenessLabel: doneness.label,
    pullTemp: doneness.pullTemp,
    finalTemp: doneness.finalTemp,
    thicknessId: thickness?.id,
    thicknessLabel: thickness?.label,
    weightLbs: weight,
    estimatedTime: timeEst.label,
    hasStall: cut.hasStall,
    wrapRecommended: cut.wrapRecommended,
    restMinutes: cut.restMinutes,
    tips: cut.tips,
  };
}
