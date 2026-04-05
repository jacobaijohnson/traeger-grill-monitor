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
