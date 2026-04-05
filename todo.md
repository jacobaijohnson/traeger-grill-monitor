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
- [ ] Server-Sent Events for real-time telemetry to browser
- [x] Telemetry recording to database

## Backend - Cook Intelligence
- [x] Cook templates data (all meat/cut/method combinations)
- [x] Multi-stage automation engine (state machine)
- [x] Pellet consumption estimator
- [ ] Smart alerts (temp deviation, probe fell out, stall prediction)

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
- [ ] Server-Sent Events for real-time telemetry push
- [ ] Smart alerts (temp deviation, probe fell out, stall prediction)
- [ ] Pellet consumption tracking over time
- [ ] Export cook session data as CSV
- [ ] Mobile-responsive optimizations

## Bug Fixes (Active)
- [x] Fix dashboard showing "Offline waiting..." — added server-side MQTT manager with live telemetry cache
- [x] Add grill.telemetry tRPC query backed by server-side MQTT cache (auto-connects MQTT)
- [x] Add grill.telemetryHistory tRPC query for charting from MQTT history buffer
- [x] Implement adaptive polling (10s cooking, 20s cooling, 30s idle)
- [x] Wire Dashboard to poll live telemetry with MQTT connection status display
- [x] Auto-refresh MQTT signed URL before expiry
- [ ] Tighten Cook Guide → Automation flow (Start Cook button creates and launches automation)
- [ ] Merge Cook Guide and Automation into unified workflow

## Rename to Traeger Smoker Insight
- [x] Update DashboardLayout sidebar branding to "Traeger Smoker Insight"
- [x] Update index.html title to "Traeger Smoker Insight"
- [x] Update Settings page branding references
- [x] Update any other page references from PitDeck to Traeger Smoker Insight
