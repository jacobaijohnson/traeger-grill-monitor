# Traeger Dashboard — Architecture & Code Quality Audit

## 1. Stack Assessment: React + Node/Express + tRPC + MySQL

### What's Working Well

**tRPC is an excellent choice for this project.** End-to-end type safety between server and client eliminates an entire class of bugs (mismatched API contracts). For a single-developer project that needs to iterate fast, this is arguably the best possible choice — you get typed procedures, automatic serialization via Superjson, and zero boilerplate for API clients. The alternative (REST + OpenAPI + codegen, or GraphQL) would add significant complexity for no real benefit at this scale.

**React 19 + Vite 7 is the right call.** React's ecosystem is unmatched for component libraries (shadcn/ui, Radix, Recharts). Vite gives fast HMR. The alternative (Next.js) would add SSR complexity that a dashboard app doesn't need — this is a client-heavy SPA with authenticated routes, not a content site that needs SEO.

**Express 4 as the server is fine.** It's battle-tested, the tRPC adapter works well, and the MQTT/SSE real-time features integrate cleanly. Fastify would be marginally faster but wouldn't change the architecture.

**MySQL/TiDB is adequate.** The data model is relational (users → sessions → telemetry, users → programs → executions), so a relational DB is correct. SQLite would be more portable for self-hosting but would struggle with concurrent MQTT writes.

### What Could Be Better (But Isn't Worth Changing)

**No SSR/ISR** — Not needed. This is an authenticated dashboard, not a public content site.

**No GraphQL** — tRPC is better here. GraphQL's query flexibility is overkill when you control both client and server.

**No WebSocket for real-time** — SSE is simpler and sufficient for one-directional telemetry push. WebSocket would only matter if the client needed to send real-time data back.

### Verdict: The stack is well-chosen. No architecture change needed.

---

## 2. Maintainability — ISSUES FOUND

### CRITICAL: CookPrograms.tsx is 3,325 lines (God Component)

This is the single biggest maintainability problem. The file contains 24 components/functions in one file:

| Component | Lines | Should Extract? |
|-----------|-------|-----------------|
| CookPrograms (main) | 643 | Keep but slim down |
| ExecutionHistoryTab | 465 | YES — separate file |
| ProgramBuilder | 345 | YES — separate file |
| CompareDialog | 340 | YES — separate file |
| SortableStepBuilder | 217 | YES — separate file |
| LiveExecution | 202 | YES — separate file |
| VariableBuilder | 144 | YES — separate file |
| ProgramDetailDialog | 141 | YES — separate file |
| StepCard | 132 | YES — separate file |
| TriggerEditor | 126 | Move with builder |
| ActionEditor | 107 | Move with builder |
| 13 utility functions | ~120 | YES — shared utils |

**Impact:** Hard to navigate, hard to test individual components, IDE performance degrades, git diffs are noisy.

### MODERATE: Duplicated Utility Functions

- `formatDate` defined 2x (lines 1553 and 2060)
- `formatDurationMs` defined 2x (lines 1563 and 2070) with slightly different signatures
- `outcomeBadge` defined once but could be shared
- `useIsMobile()` called 4x in separate components (fine, but shows they should be separate files)

### MODERATE: Legacy Dead Code

- `CookGuide.tsx` (1,013 lines) and `Automation.tsx` (1,073 lines) still exist but routes redirect. These should be deleted — they're in git history if needed.

### LOW: No shared component library for cook-program-specific UI

StepCard, TriggerDisplay, AlertBadge are reused across multiple parent components but live in the same mega-file.

---

## 3. Efficiency & Speed — ISSUES FOUND

### CRITICAL: No Database Indexes

Zero indexes on any table beyond primary keys. Every query that filters by `userId`, `grillId`, `status`, or `automationProgramId` does a full table scan.

Tables needing indexes:
- `telemetry_data`: (userId, grillId, recordedAt) — queried constantly for charts
- `automation_programs`: (userId, status), (userId, isActive)
- `cook_sessions`: (userId, grillId), (userId, startedAt)
- `program_executions`: (userId, automationProgramId), (userId, startedAt)
- `pellet_readings`: (userId, grillId, recordedAt)
- `session_alerts`: (userId, cookSessionId)

**Impact:** As data grows, queries will slow dramatically. Telemetry alone accumulates ~1000 rows per cook session.

### MODERATE: No React.lazy / Code Splitting

All pages are eagerly imported in App.tsx. CookPrograms.tsx alone is 3,325 lines that gets bundled even if the user never visits that page.

Pages that should be lazy-loaded:
- CookPrograms (largest page)
- Analytics
- Settings
- History
- ComponentShowcase

### MODERATE: No React.memo on Expensive Pure Components

ProgramCard, StepCard, and the library grid re-render on every parent state change (search typing, tab switching). These are pure components that should be memoized.

### LOW: 68 Production Dependencies

This is on the high side but most are Radix UI primitives (lightweight). The heaviest are:
- recharts (~200KB)
- framer-motion (~120KB)
- @aws-sdk (~large but tree-shakes well)
- mqtt (~50KB)

No immediate action needed, but worth auditing unused Radix packages.

---

## 4. Security — ISSUES FOUND

### CRITICAL: Traeger Tokens Stored in Plaintext

`accessToken`, `idToken`, and `refreshToken` are stored as plaintext `text()` columns. The schema comment says "encrypted server-side" but there is no encryption. If the database is compromised, all Traeger accounts are exposed.

**Fix:** Encrypt tokens at rest using AES-256-GCM with a key derived from JWT_SECRET or a dedicated encryption key.

### MODERATE: No Rate Limiting

No rate limiting on any endpoint. An attacker could:
- Brute-force the Traeger login flow
- Spam the LLM/image generation endpoints (cost attack)
- DoS the MQTT connection manager

**Fix:** Add express-rate-limit middleware, at minimum on auth and mutation endpoints.

### MODERATE: No Security Headers

No helmet, no CORS configuration, no CSP. The Express server serves responses without:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Strict-Transport-Security`

**Fix:** Add helmet middleware.

### MODERATE: Missing Input Length Validation

Several string inputs lack `.max()` constraints in Zod schemas:
- Program names, descriptions, notes could be arbitrarily long
- JSON fields (programJson, executionLogJson) have no size limits

### LOW: Publish Flow Doesn't Validate Ownership

The `onPublish` handler in the detail dialog only checks `source === "community"` but the actual publish mutation on `customTemplates.publish` does validate `userId` in `updateCustomTemplate`. However, the automation programs table has `isPublished` but no publish procedure — saved programs can't actually be published to community yet (the button only appears for community items, which is backwards).

---

## 5. Summary of Priority Fixes

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Add database indexes | 30 min |
| P0 | Encrypt Traeger tokens at rest | 1 hour |
| P1 | Extract CookPrograms.tsx into ~8 files | 2 hours |
| P1 | Add rate limiting | 30 min |
| P1 | Add security headers (helmet) | 15 min |
| P1 | Fix publish flow (My Programs → Community) | 1 hour |
| P2 | Add React.lazy code splitting | 30 min |
| P2 | Add React.memo to pure components | 30 min |
| P2 | Delete legacy CookGuide.tsx and Automation.tsx | 5 min |
| P2 | Deduplicate utility functions | 15 min |
| P3 | Add input length validation | 30 min |
| P3 | Add shareable links for community programs | 1 hour |
