# Live Cook System Architecture

## The Three Interconnected Systems

After dissecting the requirements, there are three systems that need to work together as a unified experience. They share data, trigger each other, and present a cohesive workflow.

### System 1: Temperature Graph Engine

The graph is the centerpiece — it needs to be both beautiful and scientifically useful.

**Time Window Controls:**
- Preset buttons: 10min, 30min, 1hr, 2hr, Full Cook
- The graph always shows at minimum 10 minutes of data (even if the cook just started, pad the left side)
- "Full Cook" shows everything from cook start to now
- Smooth zoom/pan via mouse wheel + drag on the time axis
- Auto-scroll follows the latest data point (toggleable — user can "freeze" to inspect history)

**Data Lines (Recharts):**
- Grill Temp (copper/orange solid line)
- Probe Temp (red solid line, thicker — this is the star)
- Ambient Temp (blue thin line)
- Target Grill Temp (copper dashed line)
- Target Probe Temp (red dashed line)

**Meat Science Markers (horizontal dotted lines):**
These are the key innovation. When a cook guide is active (or meat type is identified), overlay horizontal reference lines at scientifically significant temperatures:

| Meat Type | Marker | Temp (°F) | Color | Description |
|-----------|--------|-----------|-------|-------------|
| Brisket | Fat Render Start | 130 | yellow | Fat begins to soften |
| Brisket | Collagen Breakdown | 160 | orange | Connective tissue starts converting to gelatin |
| Brisket | The Stall Zone | 150-170 | red band | Evaporative cooling plateau |
| Brisket | Collagen Complete | 190 | green | Gelatin conversion complete, probe tender |
| Brisket | Target Pull | 203 | bright green | Ideal pull temperature |
| Pork Butt | Collagen Start | 160 | orange | Connective tissue breakdown begins |
| Pork Butt | Stall Zone | 150-170 | red band | Same evaporative cooling effect |
| Pork Butt | Pull Ready | 195-205 | green band | Fork tender range |
| Ribs | Bend Test | 190-200 | green band | Rack bends and cracks when lifted |
| Steak | Rare | 120 | blue | Cool red center |
| Steak | Medium Rare | 130 | green | Warm red center |
| Steak | Medium | 140 | yellow | Warm pink center |
| Steak | Medium Well | 150 | orange | Slight pink |
| Steak | Well Done | 160 | red | No pink |
| Poultry | Safe Minimum | 165 | red | USDA safe temperature |
| Poultry | Thigh Ideal | 175-180 | green | Dark meat optimal |
| Pork Loin | Medium | 145 | green | USDA safe, juicy |
| Pork Loin | Well | 160 | yellow | Traditional done |
| Salmon | Medium Rare | 120 | green | Translucent center |
| Salmon | Medium | 130 | yellow | Opaque, flaky |
| Salmon | Well | 140 | orange | Fully cooked |

**Marker Behavior:**
- Markers appear as horizontal dotted lines across the full graph width
- Each marker has a small label on the right edge (e.g., "Fat Render 130°F")
- When the probe temp FIRST crosses a marker, a small event dot appears on the probe line at that point
- The marker line changes from dotted to solid after the probe passes it (visual confirmation)
- Stall zones render as a semi-transparent colored band, not a single line

### System 2: Notification & Alert Engine

Two distinct alert types that serve different purposes:

**Notifications (Ping):**
- One-time browser push notification
- Shows a toast in the app
- Sound plays once
- Auto-dismisses after 10 seconds
- Use case: "Probe hit 160°F — entering the stall zone"
- Toggle: ON/OFF per alert

**Alarms:**
- Persistent browser notification that re-fires every 30 seconds
- Modal overlay in the app that blocks interaction until dismissed
- Continuous alarm sound (beeping pattern)
- Will NOT stop until the user explicitly acknowledges
- Use case: "Probe hit 203°F — PULL YOUR BRISKET NOW"
- Toggle: ON/OFF per alert

**Alert Configuration per Cook Guide:**
Each cook guide template defines which alerts fire and their type:

```
Brisket Example:
  - 130°F probe → Notification: "Fat rendering has begun"
  - 150°F probe → Notification: "Entering the stall zone. Consider wrapping."
  - 160°F probe → Notification: "Collagen breakdown in progress"
  - 195°F probe → Notification: "Getting close — start checking tenderness"
  - 203°F probe → ALARM: "TARGET REACHED — Pull your brisket!"
  - Stall detected → Notification: "Temperature stall detected for 30+ min"
```

**User Controls:**
- Master toggle: All Notifications ON/OFF
- Master toggle: All Alarms ON/OFF
- Per-alert override: Can promote a notification to alarm or demote an alarm to notification
- Custom alerts: User can add their own temp-based alerts at any temperature

### System 3: Live Cook Page (replaces Automation)

The Automation tab becomes "Live Cook" — a context-aware page:

**When NO cook is active (grill off/idle):**
- Shows a friendly "No active cook" state
- "Start a Cook" button → navigates to Cook Guide
- Shows recent cook history cards (last 3 cooks)
- Quick-start buttons for favorite/recent cook guides

**When a cook IS active:**
The page becomes a rich command center with these sections:

**A. Cook Summary Header:**
- Meat type + cut (from cook guide, or "Custom Cook" if manual)
- Cook start time
- Elapsed time (large, prominent counter: "2h 34m")
- Estimated time remaining (based on probe temp trajectory + historical data)
- Current stage name (e.g., "Stage 2: The Stall — Wrap Phase")
- Progress bar showing stages completed

**B. The Temperature Graph (System 1):**
- Full advanced graph with meat science markers
- Time window controls
- Auto-scrolling with freeze toggle

**C. Active Alerts Panel:**
- List of all configured alerts for this cook
- Each shows: temp threshold, type (notification/alarm), status (pending/fired/dismissed)
- Toggle switches to enable/disable each
- "Add Custom Alert" button
- Fired alerts show the time they triggered

**D. Stall Detector:**
- Monitors probe temp over rolling 30-minute window
- If temp change < 2°F over 30 minutes → "Stall Detected"
- Shows: stall duration, temp at stall start, suggestion ("Consider wrapping in butcher paper")
- Visual indicator on the graph (highlighted band over the stall period)

**E. Cook Stages Timeline:**
- Visual timeline showing all stages from the cook guide
- Current stage highlighted
- Completed stages checked off with actual times
- Future stages show estimated times

### Data Flow

```
MQTT Telemetry → Server Cache → Frontend Poll (10s)
                      ↓
              Save to DB (every 30s)
                      ↓
              Alert Engine checks thresholds
                      ↓
              Fire Notification or Alarm
```

**Cook Session Lifecycle:**
1. User starts cook from Cook Guide → creates cook_session in DB with meat type, guide ID, stages, alerts
2. OR system auto-detects cook start (grill transitions to Cooking status) → creates session with "Custom Cook"
3. Telemetry streams in → saved to telemetry_readings table every 30s
4. Alert engine evaluates each reading against configured thresholds
5. When probe hits target (or user manually ends) → cook session marked complete
6. All data persisted for historical replay

**Telemetry Persistence:**
- Save to `telemetry_readings` table every 30 seconds during active cook
- Fields: timestamp, grillTemp, probeTemp, ambientTemp, targetGrill, targetProbe, pelletLevel, systemStatus
- For a 12-hour brisket cook: ~1,440 readings (very manageable)
- Historical replay loads all readings for a session and renders the same advanced graph

### Navigation Flow

```
Dashboard → Quick overview, mini graph, quick controls
   ↓
Live Cook → Full cook experience (if cooking) OR redirect to Cook Guide (if idle)
   ↓
Cook Guide → Browse templates, "Start This Cook" button
   ↓
Live Cook → Now active with all stages, alerts, markers from the guide
   ↓
History → After cook ends, full replay with same graph
```

### Implementation Order

1. Meat science data (shared/meat-science.ts) — all temp markers per meat type
2. DB schema updates — telemetry_readings enhancement, cook session alerts
3. Backend — telemetry persistence, alert engine, cook session lifecycle
4. Frontend — Advanced graph component (reusable between Live Cook and History)
5. Frontend — Live Cook page (replace Automation)
6. Frontend — Notification/Alarm system with browser Notification API
7. Frontend — Cook Guide "Start Cook" integration
8. Wire everything together and test
