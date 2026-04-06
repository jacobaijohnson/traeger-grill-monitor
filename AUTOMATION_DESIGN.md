# Cook Automation System — Design Document

## 1. Overview

The automation system allows users to create, reuse, share, and execute multi-phase cook programs on their Traeger grills. A cook program is a sequence of **steps**, where each step combines a **trigger** (when to act), one or more **actions** (what to do), and optional **alerts** (how to notify the user). Users can build programs from scratch using a visual builder, start from preset templates, or fork community-shared programs.

---

## 2. Traeger Capability Inventory

Every automation action must map to a real Traeger API command or a software-only behavior. Here is the complete set of capabilities available:

### 2.1 Hardware Commands (via Traeger IoT API)

| Command | Code | Parameters | Constraints | Description |
|---------|------|------------|-------------|-------------|
| Set Grill Temp | `11` | temp (165-500°F) | Min 165°F, Max 500°F | Set the grill target temperature |
| Set Timer | `12` | seconds (60-86400) | 1 min to 24 hours | Start a countdown timer on the grill |
| Clear Timer | `13` | none | — | Cancel the running timer |
| Set Probe Alarm | `14` | temp (100-220°F) | Hardware probe alarm | Set the built-in probe temperature alarm |
| Shutdown | `17` | none | — | Initiate grill shutdown sequence |
| Keep Warm On | `18` | none | — | Enable keep-warm mode |
| Keep Warm Off | `19` | none | — | Disable keep-warm mode |
| Super Smoke On | `20` | none | Model-dependent | Enable super smoke mode |
| Super Smoke Off | `21` | none | — | Disable super smoke mode |
| Status Request | `90` | none | — | Request current grill status |

### 2.2 Telemetry Readings (via MQTT)

| Reading | Field | Unit | Description |
|---------|-------|------|-------------|
| Grill Temperature | `grill` | °F | Current grill chamber temperature |
| Probe Temperature | `probe` | °F | Current meat probe temperature |
| Ambient Temperature | `ambient` | °F | Outside/ambient temperature |
| Target Temperature | `set` | °F | Current grill target temp |
| Probe Target | `probeSet` | °F | Current probe alarm target |
| Pellet Level | `pelletLevel` | % | Hopper pellet level (0-100) |
| System Status | `systemStatus` | code | Grill state (sleeping, cooking, etc.) |
| Probe Connected | `probeCon` | 0/1 | Whether probe is plugged in |
| Keep Warm | `keepwarm` | 0/1 | Keep warm mode active |
| Super Smoke | `smoke` | 0/1 | Super smoke mode active |
| Cook Timer Start | `cookTimerStart` | epoch | Timer start timestamp |
| Cook Timer End | `cookTimerEnd` | epoch | Timer end timestamp |

### 2.3 Software-Only Actions (no hardware command)

| Action | Description |
|--------|-------------|
| Send Notification | Browser notification (one-time, dismissible) |
| Sound Alarm | Persistent audio alarm requiring manual acknowledgment |
| Log Event | Record an event to the cook session history |
| Wait for Acknowledge | Pause automation until user confirms |
| End Cook Session | Mark the cook session as complete |

---

## 3. Trigger Types

A trigger defines **when** a step activates. Each step has exactly one primary trigger.

| Trigger | Parameters | Description |
|---------|------------|-------------|
| **Probe Temp Reached** | `targetTemp` (°F) | Fires when probe >= target |
| **Probe Temp Dropped** | `targetTemp` (°F) | Fires when probe <= target (for cooling/rest) |
| **Grill Temp Reached** | `targetTemp` (°F) | Fires when grill >= target |
| **Grill Temp Dropped** | `targetTemp` (°F) | Fires when grill <= target |
| **Timer Elapsed** | `duration` (seconds) | Fires after N seconds in this step |
| **Pellet Level Low** | `threshold` (%) | Fires when pellets drop below % |
| **Manual** | none | User manually advances to next step |
| **Immediate** | none | Fires as soon as the step begins (for setup steps) |

### 3.1 Compound Triggers (Future)

For v2, we could support AND/OR combinations:
- "Probe >= 160°F AND Timer >= 3600s" (whichever comes LAST)
- "Probe >= 200°F OR Timer >= 14400s" (whichever comes FIRST)

For v1, we keep it to one trigger per step. Users can achieve compound logic by chaining steps.

---

## 4. Action Catalog

Actions are what happen when a trigger fires. Each step can have **multiple actions** that execute simultaneously.

| Action | Category | Parameters | Description |
|--------|----------|------------|-------------|
| `set_grill_temp` | Hardware | `temp` (165-500°F) | Change grill target temperature |
| `set_probe_alarm` | Hardware | `temp` (100-220°F) | Set hardware probe alarm |
| `set_timer` | Hardware | `seconds` (60-86400) | Start grill timer |
| `clear_timer` | Hardware | none | Cancel grill timer |
| `super_smoke_on` | Hardware | none | Enable super smoke |
| `super_smoke_off` | Hardware | none | Disable super smoke |
| `keep_warm_on` | Hardware | none | Enable keep warm |
| `keep_warm_off` | Hardware | none | Disable keep warm |
| `shutdown` | Hardware | none | Shutdown the grill |
| `send_notification` | Alert | `message` | One-time browser notification |
| `sound_alarm` | Alert | `message` | Persistent alarm (requires dismiss) |
| `escalating_alarm` | Alert | `message`, `intervalDegrees`, `maxTemp` | Re-alarm every N°F |
| `wait_for_ack` | Flow | none | Pause until user acknowledges |
| `log_event` | Software | `message` | Record to session history |
| `end_session` | Software | none | Mark cook as complete |

### 4.1 Action Validation Rules

The system enforces these constraints at program creation time:

- `set_grill_temp`: temp must be 165-500°F
- `set_probe_alarm`: temp must be 100-220°F
- `set_timer`: seconds must be 60-86400
- `shutdown` should only appear in the final step
- `escalating_alarm` requires `intervalDegrees` > 0
- Hardware actions require grill to be connected and cooking

---

## 5. Variable System

Variables make programs reusable across different cooks. Users set variable values when they start a program.

### 5.1 Built-in Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `meat_weight_lbs` | number | — | Weight of the meat in pounds |
| `meat_thickness_in` | number | — | Thickness in inches |
| `doneness` | enum | "medium" | Target doneness level |
| `servings` | number | 4 | Number of servings |

### 5.2 Doneness → Temperature Mapping

| Doneness | Beef (°F) | Pork (°F) | Poultry (°F) | Lamb (°F) |
|----------|-----------|-----------|--------------|-----------|
| Rare | 125 | — | — | 130 |
| Medium Rare | 135 | — | — | 140 |
| Medium | 145 | 145 | — | 150 |
| Medium Well | 155 | 155 | — | 155 |
| Well Done | 165 | 160 | 165 | 165 |
| Pull Temp | 200-205 | 200-205 | — | — |

### 5.3 Variable Resolution

Variables can be referenced in action parameters using `{{variable_name}}` syntax. The system resolves them at program start time.

Example: A brisket program step might set `set_grill_temp` to `{{smoke_temp}}` where `smoke_temp` defaults to 180 but the user can override it to 195.

### 5.4 Computed Variables

Some variables are computed from others:

- `estimated_cook_time` = `meat_weight_lbs * time_per_pound_minutes`
- `target_probe_temp` = doneness lookup for the meat category
- `rest_time_minutes` = `meat_weight_lbs * 10` (rough rule: 10 min/lb for rest)

---

## 6. Program Structure

A program is a JSON document with metadata, variables, and an ordered list of steps.

```typescript
interface CookProgram {
  // Metadata
  id: string;
  name: string;
  description: string;
  category: "beef" | "pork" | "poultry" | "lamb" | "seafood" | "other";
  method: "smoke" | "grill" | "reverse_sear" | "roast" | "bake";
  meatCut?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime?: string;
  tags: string[];           // "brisket", "low-and-slow", "competition"

  // Variables
  variables: ProgramVariable[];

  // Steps (executed in order)
  steps: ProgramStep[];

  // Tips & notes
  tips: string[];

  // Sharing
  isPublished: boolean;
  authorId?: number;
  authorName?: string;
  forkCount: number;
  forkedFromId?: string;
}

interface ProgramVariable {
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

interface ProgramStep {
  name: string;             // "Low & Slow", "The Crank", "Rest Hold"
  description?: string;

  // Trigger
  trigger: StepTrigger;

  // Actions (execute when trigger fires)
  actions: StepAction[];

  // Entry actions (execute when step begins)
  entryActions?: StepAction[];

  // Alert behavior
  alertOnTrigger?: {
    type: "notification" | "alarm";
    message: string;
    escalating?: {
      intervalDegrees: number;
      maxTemp?: number;
    };
  };
}

interface StepTrigger {
  type: "probe_temp" | "probe_temp_drop" | "grill_temp" |
        "grill_temp_drop" | "timer" | "pellet_low" |
        "manual" | "immediate";
  value: number | string;   // Supports {{variable}} references
}

interface StepAction {
  type: "set_grill_temp" | "set_probe_alarm" | "set_timer" |
        "clear_timer" | "super_smoke_on" | "super_smoke_off" |
        "keep_warm_on" | "keep_warm_off" | "shutdown" |
        "send_notification" | "sound_alarm" | "escalating_alarm" |
        "wait_for_ack" | "log_event" | "end_session";
  params?: Record<string, number | string | boolean>;
}
```

---

## 7. Example: Custom Brisket Program

```json
{
  "name": "Competition Brisket",
  "category": "beef",
  "method": "smoke",
  "meatCut": "Whole Packer Brisket",
  "difficulty": "advanced",
  "estimatedTime": "12-16 hours",
  "tags": ["brisket", "low-and-slow", "competition"],
  "variables": [
    { "name": "smoke_temp", "label": "Smoke Temperature", "type": "number", "default": 180, "min": 165, "max": 225, "unit": "°F" },
    { "name": "crank_temp", "label": "Crank Temperature", "type": "number", "default": 225, "min": 200, "max": 275, "unit": "°F" },
    { "name": "wrap_point", "label": "Wrap Point (Probe)", "type": "number", "default": 160, "min": 150, "max": 175, "unit": "°F" },
    { "name": "pull_temp", "label": "Pull Temperature", "type": "number", "default": 200, "min": 195, "max": 210, "unit": "°F" },
    { "name": "meat_weight_lbs", "label": "Meat Weight", "type": "number", "default": 12, "min": 4, "max": 25, "unit": "lbs" }
  ],
  "steps": [
    {
      "name": "Low & Slow",
      "description": "Smoke at low temp until the stall point",
      "trigger": { "type": "probe_temp", "value": "{{wrap_point}}" },
      "entryActions": [
        { "type": "set_grill_temp", "params": { "temp": "{{smoke_temp}}" } },
        { "type": "super_smoke_on" }
      ],
      "alertOnTrigger": {
        "type": "alarm",
        "message": "Brisket hit {{wrap_point}}°F — time to wrap!",
        "escalating": { "intervalDegrees": 5 }
      },
      "actions": [
        { "type": "wait_for_ack" }
      ]
    },
    {
      "name": "The Crank",
      "description": "Increase temp to push through the stall",
      "trigger": { "type": "probe_temp", "value": "{{pull_temp}}" },
      "entryActions": [
        { "type": "set_grill_temp", "params": { "temp": "{{crank_temp}}" } },
        { "type": "super_smoke_off" },
        { "type": "send_notification", "params": { "message": "Cranking to {{crank_temp}}°F — pushing through the stall" } }
      ],
      "alertOnTrigger": {
        "type": "alarm",
        "message": "Brisket hit {{pull_temp}}°F — pull it!"
      },
      "actions": [
        { "type": "set_grill_temp", "params": { "temp": 165 } },
        { "type": "keep_warm_on" },
        { "type": "sound_alarm", "params": { "message": "PULL THE BRISKET! Probe at {{pull_temp}}°F" } }
      ]
    },
    {
      "name": "Rest Hold",
      "description": "Grill drops to minimum temp to prevent overcooking",
      "trigger": { "type": "manual" },
      "entryActions": [
        { "type": "log_event", "params": { "message": "Entered rest hold — grill at minimum temp" } }
      ],
      "actions": [
        { "type": "shutdown" },
        { "type": "end_session" }
      ]
    }
  ],
  "tips": [
    "Fat side up for offset smokers, fat side down for Traegers (heat comes from below)",
    "The stall typically happens between 150-170°F and can last 2-4 hours",
    "Wrap in butcher paper (not foil) to preserve bark while pushing through stall",
    "Rest for at least 1 hour — longer is better (up to 4 hours in a cooler)"
  ]
}
```

---

## 8. Preset Program Library

These programs ship as built-in templates. Users can start them directly or fork to customize.

| Program | Category | Method | Difficulty | Key Phases |
|---------|----------|--------|------------|------------|
| Competition Brisket | Beef | Smoke | Advanced | Low & Slow → Crank → Rest Hold |
| Reverse Sear Steak | Beef | Reverse Sear | Intermediate | Low Smoke → Rest → High Sear |
| Pulled Pork | Pork | Smoke | Beginner | Smoke → Wrap → Pull → Rest |
| Baby Back Ribs (3-2-1) | Pork | Smoke | Intermediate | Smoke 3hr → Wrap 2hr → Sauce 1hr |
| Spatchcock Chicken | Poultry | Roast | Beginner | High Heat → Probe Target |
| Smoked Turkey | Poultry | Smoke | Intermediate | Low Smoke → Crank → Rest |
| Burger Mode | Beef | Grill | Beginner | Preheat → Cook → Flip Timer → Pull |
| Pizza Mode | Other | Bake | Beginner | Max Heat Preheat → Timer Cook |
| Smoked Salmon | Seafood | Smoke | Intermediate | Low Smoke → Glaze → Pull |
| Pork Belly Burnt Ends | Pork | Smoke | Advanced | Smoke → Cube & Sauce → Caramelize |

---

## 9. UX Architecture

### 9.1 Program Library Page

A browsable library with:
- **Category filters**: Beef, Pork, Poultry, Seafood, Other
- **Method filters**: Smoke, Grill, Reverse Sear, Roast, Bake
- **Difficulty badges**: Beginner (green), Intermediate (amber), Advanced (red)
- **Search**: By name, tags, meat cut
- **Tabs**: "Presets" | "My Programs" | "Community"
- Each card shows: name, estimated time, difficulty, phase count, fork count

### 9.2 Program Builder (Visual)

A step-by-step builder with:
1. **Program Info**: Name, category, method, description, tags
2. **Variables**: Add/edit variables with defaults and constraints
3. **Steps**: Drag-to-reorder list of steps, each expandable to show:
   - Step name and description
   - Trigger picker (dropdown of trigger types + value input)
   - Entry actions (what happens when this step starts)
   - Trigger actions (what happens when the trigger fires)
   - Alert configuration (notification/alarm/escalating)
4. **Preview**: Read-only flow diagram showing the program phases
5. **Test**: Dry-run with simulated telemetry (future)

### 9.3 Live Execution Display

When a program is running:
- **Phase stepper**: Horizontal progress bar showing all phases, current highlighted
- **Current phase card**: Shows trigger condition, progress toward trigger, entry actions completed
- **Alert panel**: Active alarms with dismiss/acknowledge buttons
- **Manual override**: User can manually advance, skip, or abort at any time
- **Auto-command log**: Shows what the automation has done (set temp, toggled smoke, etc.)
- **Override indicator**: If user manually changes temp, show "Manual Override" badge

### 9.4 Sharing & Forking

- Programs can be published to the community library
- Other users can fork (copy + customize) published programs
- Fork count shown on program cards
- Original author credited on forked programs

---

## 10. Manual Override Philosophy

The automation system is an **assistant, not a dictator**. At any point during execution:

- User can manually change grill temp (automation notes the override but doesn't fight it)
- User can manually advance to the next step
- User can skip steps
- User can abort the entire program
- User can add ad-hoc alerts during execution
- The program continues from wherever the user leaves it

If the user manually sets a different grill temp than what the automation expects, the system logs "Manual Override" and continues monitoring triggers normally. It does not attempt to "correct" the user's manual input.

---

## 11. Implementation Phases

### Phase 1 (Current Sprint)
- Core execution engine with trigger evaluation and action dispatch
- `set_grill_temp`, `set_probe_alarm`, `super_smoke`, `keep_warm`, `shutdown` actions
- `probe_temp`, `timer`, `manual`, `immediate` triggers
- Notification and alarm alerts (including escalating)
- Variable resolution at program start
- Brisket preset as first template

### Phase 2
- Visual program builder UI
- Program library with category/method/difficulty filters
- Fork and share functionality
- All remaining preset templates

### Phase 3 (Future)
- Compound triggers (AND/OR)
- Computed variables (weight-based time estimates)
- Dry-run simulator
- Community ratings and reviews
- AI-suggested programs based on what you're cooking

---

## 12. Data Model Changes

The existing `automation_programs` table needs these additions:

| Column | Type | Description |
|--------|------|-------------|
| `grillId` | varchar(128) | Which grill this program runs on |
| `programJson` | json | Full CookProgram JSON |
| `variableValuesJson` | json | Resolved variable values for active run |
| `executionLogJson` | json | Log of actions taken during execution |
| `status` | enum | "draft", "ready", "running", "completed", "aborted" |

The `stagesJson` column is replaced by `programJson` which contains the full program definition including variables and the richer step structure.
