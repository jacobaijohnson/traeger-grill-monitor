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
- [ ] Pellet consumption tracking over time
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
