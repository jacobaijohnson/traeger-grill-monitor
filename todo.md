# Traeger Grill Command Center - TODO

## Core Infrastructure
- [x] Database schema: traeger_sessions, telemetry_readings, cook_sessions, automation_programs
- [x] Dark theme with fire/smoke color palette (amber/orange accents on charcoal)
- [x] DashboardLayout with sidebar navigation

## Backend - Traeger API Proxy
- [x] Traeger auth endpoint (POST /tokens proxy)
- [x] Traeger session management (encrypted token storage)
- [x] Grill discovery endpoint (GET /users/self proxy)
- [x] Command relay endpoint (POST /things/{thingName}/commands proxy)
- [x] MQTT credential proxy (POST /mqtt-connections)
- [x] Server-Sent Events for real-time telemetry to browser
- [x] Telemetry recording to database

## Backend - Cook Intelligence
- [x] Cook templates data (all meat/cut/method combinations)
- [x] Multi-stage automation engine (state machine)
- [x] Pellet consumption estimator
- [x] Smart alerts (temp deviation, probe fell out, stall prediction)

## Frontend - Authentication
- [x] Traeger login page (email/password)
- [x] Grill selector interface
- [x] Session persistence

## Frontend - Dashboard
- [x] Live telemetry display (grill temp, probe temp, ambient, pellet level)
- [x] System state decoder with color-coded badges
- [x] Quick control buttons (temp adjust, shutdown)
- [x] Pellet level gauge with consumption estimate
- [x] Active cook timer display

## Frontend - Controls
- [x] Temperature adjustment slider/input
- [x] Cook timer set/clear
- [x] Probe alarm temperature set
- [x] Super Smoke toggle
- [x] Keep Warm toggle
- [x] Shutdown button with confirmation

## Frontend - Temperature Graph
- [x] Real-time Recharts line graph (grill, probe, ambient, target)
- [x] Historical cook session graphs

## Frontend - Cook Guide
- [x] Browse templates by category (Beef, Pork, Poultry, Lamb, Seafood)
- [x] Filter by cooking method (Smoke, Grill, Reverse Sear, Roast)
- [x] Template detail view with stages and tips
- [x] Launch cook from template (auto-configure grill)

## Frontend - Automation
- [x] Create multi-stage cook programs
- [x] Stage builder (grill temp, trigger type, trigger value, super smoke, alerts)
- [x] Active automation status display
- [x] Pre-built programs (Brisket, 3-2-1 Ribs, Reverse Sear, Pulled Pork)

## Frontend - History
- [x] Cook session list with date, meat type, duration
- [x] Session detail with temperature graph replay
- [x] Cook notes and rating

## Tests
- [x] Cook template data validation tests
- [x] System status decoder tests
- [x] Command codes tests
- [x] Template router tests (list, get, filter)
- [x] Auth tests (me, logout)
- [x] Protected route tests
- [x] Input validation tests (temp ranges, timer bounds)

## Bug Fixes
- [x] Fix Traeger login 422 error - switched to direct Cognito InitiateAuth with correct CLIENT_ID, headers, and idToken usage
- [x] Fix Traeger login 400 error - switched to Traeger auth proxy with Cognito fallback, added detailed error logging

## UI Improvements
- [x] Add show/hide password toggle on Traeger login form in Settings
- [x] Make Traeger auth error messages more human-readable

## Design Redesign - PitDeck DIY/Open-Source Aesthetic
- [x] Research Traeger brand colors, typography, and design language
- [x] Design remixed color palette: warm copper/amber on dark slate (distinct from Traeger)
- [x] Update CSS theme variables (index.css) with new palette
- [x] Update typography: Inter + JetBrains Mono for maker/workshop aesthetic
- [x] Add DIY-inspired visual motifs (terminal-style elements, monospace labels)
- [x] Update DashboardLayout sidebar with PitDeck branding
- [x] Update all page components with new design language
- [x] Consistent application across Dashboard, Controls, Cook Guide, Automation, History, Settings

## Legal Disclaimer
- [x] Add comprehensive legal disclaimer/notice to Settings page
- [x] Include TOS awareness, right-to-repair context, and data isolation assurances
- [x] Trademark attribution and interoperability explanation
- [x] No-warranty and safety notice

## Custom Cook Templates & Community Sharing
- [x] Database schema for user-created cook templates (customTemplates table)
- [x] Backend routes for CRUD operations on custom templates
- [x] Custom template creation UI with stage builder
- [x] My Templates section in Cook Guide page
- [x] Community sharing: publish/unpublish templates
- [x] Browse and clone shared community templates
- [x] Fork community templates to personal collection
- [x] Security isolation: all data scoped by userId

## Future Enhancements
- [x] Server-Sent Events for real-time telemetry push
- [x] Smart alerts (temp deviation, probe fell out, stall prediction)
- [x] Pellet consumption tracking over time (pellet_logs + analytics)
- [x] Export cook session data as CSV
- [x] Mobile-responsive optimizations (touch swipe for timeline navigation)

## Bug Fixes (Active)
- [x] Fix dashboard showing "Offline waiting..." — added server-side MQTT manager with live telemetry cache
- [x] Add grill.telemetry tRPC query backed by server-side MQTT cache (auto-connects MQTT)
- [x] Add grill.telemetryHistory tRPC query for charting from MQTT history buffer
- [x] Implement adaptive polling (10s cooking, 20s cooling, 30s idle)
- [x] Wire Dashboard to poll live telemetry with MQTT connection status display
- [x] Auto-refresh MQTT signed URL before expiry
- [x] Cook Guide → Live Cook flow (Start Cook button creates and launches live cook session)
- [x] Merged: Live Cook redirects to Cook Guide when idle, Cook Guide launches Live Cook sessions

## Rename to Traeger Smoker Insight
- [x] Update DashboardLayout sidebar branding to "Traeger Smoker Insight"
- [x] Update index.html title to "Traeger Smoker Insight"
- [x] Update Settings page branding references
- [x] Update any other page references from PitDeck to Traeger Smoker Insight

## Live Cook Tracking & Advanced Features
- [x] Design architecture for interconnected cook tracking, notifications, and graph systems
- [x] Cook duration tracking: auto-detect cook start/end, persist session with all telemetry
- [x] Advanced temperature graph: 10min minimum to full cook range, zoom/pan/scale controls
- [x] Meat science markers: horizontal dotted lines for fat render, collagen breakdown, stall zone, target temp per meat type
- [x] Dual notification system: Ping (one-time browser notification) vs Alarm (persistent until dismissed)
- [x] Notification/alarm toggle controls per alert type
- [x] Rename Automation tab to "Live Cook" — shows active cook status when cooking, redirects to Cook Guide when idle
- [x] Live Cook summary: elapsed time, estimated remaining, current stage, probe trajectory
- [x] Stall detector: alert when probe temp plateaus for extended period
- [x] Cook Guide integration: "Start Cook" launches live cook with pre-configured alerts and stages
- [x] Cook Guide alarm integration: temp-based alerts that won't stop until dismissed
- [x] Telemetry persistence: save all readings to DB for historical graph replay
- [x] Graph time window selector: 10min, 30min, 1hr, 2hr, full cook
- [x] Historical cook replay with same advanced graph features

## Server-Side Persistence & Session Resilience
- [x] Server-side cook session state machine (survives browser close/restart)
- [x] Server-side alert evaluation (fires even when browser is closed)
- [x] Missed alerts queue: show alerts that fired while browser was away
- [x] Session rehydration: dashboard recovers full state from DB on reconnect

## Cook Guide Confirmation Flow
- [x] "Start this cook?" confirmation dialog when selecting a cook guide
- [x] "Active cook in progress" warning dialog if already in a live session
- [x] End current session and save to history before starting new cook

## PWA Support (iOS/Android/Desktop)
- [x] Add web app manifest (manifest.json) with app name, icons, theme color
- [x] Add service worker for offline caching and background notification support
- [x] Add "Install App" prompt/button in DashboardLayout (notification banner)
- [x] Configure PWA meta tags in index.html for iOS Add to Home Screen
- [x] Service worker configured for background notification delivery

## Enhanced Cook Guide — Drill-Down Selectors & Dynamic Parameters
- [x] Expand meat science data with comprehensive sub-cuts per category (e.g., Beef → Ribeye, NY Strip, Skirt, Flank, Brisket Flat/Point, etc.)
- [x] Add fish sub-types (Salmon, Steelhead, Trout, Cod, Halibut, Mahi-Mahi, etc.)
- [x] Add thickness/weight modifiers that dynamically adjust estimated cook time and target temp
- [x] Add doneness levels per cut (Rare, Medium-Rare, Medium, Medium-Well, Well-Done) with correct target temps
- [x] Build searchable/typeable single-select combobox component for cut selection
- [x] Build Cook Guide drill-down UI: Category → Cut → Parameters (thickness, weight, doneness)
- [x] Allow full user override of all auto-calculated values (temps, times, alerts)
- [x] Wire Cook Guide selection to Live Cook page — pre-load config without auto-starting
- [x] Live Cook "Start" button required to begin session (no auto-start on navigate)
- [x] Add Dashboard quick meat-type selector for graph reference lines without starting a cook
- [x] Update server routes to accept enhanced cook configuration with sub-cut details
- [x] Write tests for enhanced cook template data and parameter calculations

## Temperature Graph Timeline Navigation
- [x] Add back/forward arrow buttons to shift time window through cook history
- [x] Add "Jump to Now" button to snap back to latest data
- [x] Add drag-to-pan on graph to slide through timeline
- [x] Show current time window position indicator (e.g., "2:15 PM - 2:25 PM")
- [x] Auto-follow mode: graph follows latest data until user manually navigates backward

## Cook History Analytics
- [x] Server-side analytics queries: aggregate cook stats (total cooks, total time, avg duration)
- [x] Per-cut breakdown: average cook time, count, success rate per meat type and cut
- [x] Doneness success rate: how often target temp was reached vs. over/under-cooked
- [x] Trends over time: cooks per week/month, average ratings over time
- [x] Analytics page UI with stat cards, bar charts, and trend lines
- [x] Add Analytics navigation entry in sidebar
- [x] Write tests for analytics queries

## Bug Fixes
- [x] Dashboard temperature graph only showing 3 data points instead of 26+ (fixed: hydrate from DB on restart)
- [x] Hydrate telemetry history from DB on server startup so data survives restarts
- [x] Add session gap detection — identify contiguous vs. non-contiguous time segments
- [x] Add visual breaks/gaps in TemperatureGraph when sessions are non-contiguous
- [x] Add real time axis to graph showing actual clock time alongside elapsed
- [x] Fix Dashboard markers dropdown: selecting a meat profile should immediately overlay reference lines on existing data, not wait for new data

## Spec Forge P0 — Security & Data Integrity
- [x] Add userId ownership check to cookSession.get, cookSession.end, cookSession.updateNotes
- [x] Persist active cook session state to DB on every state change (not just telemetry)
- [x] Add server-side grill state validation before high-temp commands
- [x] Write tests: userId ownership enforcement (cross-user blocked)
- [x] Write tests: cook state persistence and recovery after restart
- [x] Write tests: grill state validation rejects unsafe commands

## Spec Forge P1 — Reliability & Resilience
- [x] Add retry with exponential backoff to Traeger API calls
- [x] Add Traeger API response validation (schema check on auth, user, MQTT responses)
- [x] Add user-facing error notification for MQTT disconnect during active cook
- [x] Write integration tests: MQTT lifecycle (connect, disconnect, reconnect)
- [x] Write integration tests: cook session state machine transitions
- [x] Write integration tests: alert firing and dismissal
- [x] Write integration tests: Traeger API retry and validation

## Spec Forge P2 — Code Quality & Maintainability
- [x] Split routers.ts into domain-specific files (traeger, cook, templates, analytics)
- [x] Split db.ts into domain-specific query files
- [ ] Extract CookGuide sub-components (template card, filter bar, detail dialog) — deferred
- [x] Standardize terminology: "cook session" everywhere
- [x] Add telemetry data retention policy (90-day raw, aggregate older)
- [x] Document JSON column schemas (stagesJson, alertsJson, grillsJson)

## Spec Forge P3 — Feature Enhancements
- [x] Server-Sent Events for real-time telemetry push (replace polling)
- [x] Smart alerts: temp deviation, probe fell out, predictive stall (via SSE push + MQTT disconnect notification)
- [x] Export cook session data as CSV
- [x] Mobile-responsive optimizations (touch swipe for timeline navigation)

## Cook Guide Search
- [x] Add text search bar to Cook Guide that filters by name, cut, method, and description across all tabs
- [x] Fix DB ECONNRESET errors in MQTT telemetry persist — RC-1: mysql2 pool with keepAlive + withDbRetry wrapper
- [x] Audit and fix all race conditions: RC-1 DB pool+retry, RC-2 connection mutex, RC-3 disconnect cleanup order, RC-4 persist backpressure

## Pellet Consumption Tracking
- [x] Create pellet_logs table (grillId, userId, timestamp, pelletLevel, estimatedLbs, sessionId)
- [x] Track pellet level changes from MQTT telemetry and log consumption per cook
- [x] Calculate burn rate (lbs/hr) per cook session
- [x] Add pellet consumption panel to Dashboard (pellet level card)
- [x] Add pellet trends chart to Analytics page

## Multi-Grill Support
- [x] Add grillId column to telemetry_readings table (already existed)
- [x] Add grillId column to cook_sessions table (already existed)
- [x] Update MQTT manager — added pellet persist callback with grill-aware wiring
- [x] Update all DB queries to filter by grillId
- [x] Update all router endpoints to accept/filter by grillId
- [x] Build grill switcher UI component in sidebar (GrillSwitcher.tsx)
- [x] Ensure all data (telemetry, sessions, analytics, pellets) is isolated by grillId

## DSS Audit — Confirm DSS-1 Classification
- [x] Scan all source code for Meta internal references (fbid, workplace, intern, phabricator, etc.)
- [x] Scan for Meta IP or proprietary code patterns
- [x] Scan for any DSS-2+ data (PII, employee data, internal URLs, internal tool references)
- [x] Confirm all external APIs used are public (Traeger, AWS Cognito, MQTT)
- [x] Confirm no Meta-specific MCP servers or internal tools are referenced in app code
- [x] Document DSS-1 classification rationale

## Full Session/Task DSS Audit — Content & Data Flow Review
- [x] Audit conversation content: no Meta internal data discussed or referenced
- [x] Audit data flows: no internal APIs, endpoints, or services used in app logic
- [x] Audit all external API endpoints: confirm all are public Traeger/AWS services
- [x] Audit Cognito Client ID: confirm publicly available (not proprietary)
- [x] Audit MQTT topics/endpoints: confirm from public Traeger IoT infrastructure
- [x] Audit sandbox artifacts: no internal docs, screenshots, or data cached in workspace — CLEANED (deleted 3 files)
- [x] Audit todo.md and SPEC_FORGE_REVIEW.md for any internal process references — SPEC_FORGE is dev artifact only
- [x] Audit database schema: no columns storing Meta/internal identifiers
- [x] Audit user data model: only stores Manus OAuth + Traeger account data (no FBID, no corp data)
- [x] Confirm no MCP server calls were made that injected internal data into the project
- [x] Establish guardrails: document what MUST NOT enter this project going forward — added to .gitignore + DSS doc
- [x] Write DSS-1 classification report with rationale — DSS_CLASSIFICATION.md

## Docker — LinuxServer.io Compatible
- [x] Rewrite Dockerfile to use LSIO base image with s6-overlay
- [x] Add PUID/PGID/TZ environment variable support
- [x] Create s6-overlay service definitions for Node process supervision
- [x] Create init scripts for /config volume setup and permissions
- [x] Add LSIO-standard labels and metadata
- [x] Update docker-compose.yml for LSIO conventions (/config volume, PUID/PGID)
- [x] Update ENV_TEMPLATE.md with LSIO-specific variables
- [x] Create .dockerignore for clean builds

## Multi-Phase Cook Programs (Automated Brisket etc.)
- [x] Audit existing Cook Guide, controls, and Traeger API for temp limits
- [x] Determine lowest grill temperature supported by API (165°F)
- [x] Design cook program data model (phases, triggers, alarms, auto-commands) — AUTOMATION_DESIGN.md
- [x] Create cook_programs and cook_program_phases DB schema (extended automation_programs table)
- [x] Build cook program DB module
- [x] Build cook program router (CRUD + activate/deactivate + presets + fork)
- [x] Integrate cook program phase monitoring into MQTT telemetry loop (evaluateAutomation)
- [x] Build persistent alarm component (audio + visual, requires manual dismissal)
- [x] Build cook program UI (preset library, variable config, live execution display)
- [x] Build brisket preset as default cook program template (Competition Brisket)
- [x] Auto-step grill temperature when phase triggers fire (via sendCommandCallback)
- [x] Alert escalation: alarm every 5°F until user acknowledges (escalating_alarm action)
- [x] Auto-reduce to lowest temp (165°F) when final target reached (prevent overcook)
- [x] Write tests for phase transitions, alarm logic, and auto-commands (27 tests)

## Compound Triggers — Temp + Timer with Priority Logic
- [x] Design compound trigger model: primary + secondary triggers with logic operator (OR/AND/fallback)
- [x] Update StepTrigger type in shared/cook-programs.ts to support compound triggers
- [x] Update resolveProgram to resolve variables in compound triggers
- [x] Update MQTT evaluateAutomation engine to evaluate compound trigger logic
- [x] Update automation router bridge (programStepsToAutomationStages) for compound triggers
- [x] Update all 10 preset templates with appropriate compound triggers (timer fallbacks, temp priorities)
- [x] Update Automation UI StepPreview to display both temp and timer triggers per step
- [x] Update Automation UI to allow configuring compound triggers when creating custom programs
- [x] Write tests for compound trigger evaluation (OR, AND, fallback, priority) — 20 tests
- [x] Verify existing tests still pass after trigger model changes (202/202 pass)
- [x] Ensure alert vs alarm distinction is visible in template step preview UI (AlertBadge component)
- [x] Show alert/alarm configuration options when creating/editing custom programs (AlertBadge + StepPreview)

## UX Redesign — Progressive Disclosure, Mobile-First, Shared Sessions
- [x] Design progressive disclosure pattern: at-a-glance → tap-to-expand → deep-dive (UX_DESIGN_NOTES.md)
- [x] Rewrite StepPreview: show compound triggers (primary + secondary with logic), alert vs alarm icons, expandable detail
- [x] Rewrite LiveExecution: mobile-first hero card, big status at top, expandable phase details
- [x] Make PresetLibrary mobile-responsive: single-column on mobile, smart card layout
- [x] Make program cards mobile-responsive with touch-friendly action buttons
- [x] Add shared session awareness: viewer count from SSE, eye icon when 2+ viewers
- [x] Ensure all touch targets are 44px+ for mobile (min-h-[44px] / min-h-[48px] on all buttons)
- [x] Add collapsible sections that remember state (Collapsible components, no forced popups)
- [x] Add contextual education: useFirstUseHint hook, localStorage-persisted, auto-dismiss
- [x] Mobile-first responsive breakpoints across all Automation components (useIsMobile + responsive classes)

## Merge Cook Guide + Automation → Unified "Cook Programs" Page
- [x] Design unified Cook Programs page architecture (library + builder + execution in one flow)
- [x] Build unified CookPrograms.tsx page merging preset library, custom templates, community sharing, and live execution
- [x] Build visual program builder GUI: step-by-step editor with trigger/action pickers, compound trigger config, variable definitions
- [x] Migrate legacy CookStage templates into CookProgram format for unified display (template-bridge.ts)
- [x] Add educational content (tips, pro tips, meat science) inline with program steps
- [x] Update sidebar navigation: replace Cook Guide + Automation with single "Cook Programs" entry
- [x] Update App.tsx routing: /cook-programs as primary route, redirect old routes
- [x] Clean up old CookGuide.tsx and Automation.tsx (kept as reference, routes redirect)
- [x] Update Live Cook page to link back to Cook Programs instead of Cook Guide
- [x] Write tests for unified page and builder (13 tests, 235 total pass)

## Drag-to-Reorder Steps in Builder
- [x] Install @dnd-kit library for accessible drag-and-drop
- [x] Add drag handles to each step in the builder step list
- [x] Implement sortable step list with visual drag feedback
- [x] Update step indices on reorder

## Program Execution History
- [x] Create program_executions DB table (programId, cookSessionId, startedAt, endedAt, status, metrics JSON)
- [x] Add server procedures for logging and querying execution history
- [x] Build Execution History tab/section in Cook Programs page
- [x] Link execution records to cook session data for post-cook analysis
- [x] Show performance metrics (duration, peak temps, completion status)

## Execution Comparison View
- [x] Add server procedure to fetch two executions with full details for comparison
- [x] Build side-by-side comparison UI (duration, temps, steps, ratings, variables, outcomes)
- [x] Add "Compare" selection mode in History tab (checkbox to select 2 runs, compare button)
- [x] Show delta indicators (better/worse/same) for key metrics

## Export Cook Log
- [x] Add server endpoint to generate CSV from execution data (timeline, temps, events, notes)
- [x] Add download button to individual execution cards in History tab
- [x] Include metadata header in CSV (program name, date, outcome, rating)
- [x] Include execution log entries, step transitions, and peak temps in CSV rows
